const Classroom = require('../models/Classroom');
const Child = require('../models/Child');

// In-memory store for dynamic stream settings (privacy mode, stream overrides)
// This persists during runtime and can be augmented per classroom
const roomStreamOverrides = new Map();

// Preset ambient daycare telemetry generators for authentic CCTV realism
const getRoomTelemetry = (roomId, roomName = '') => {
  const seed = (roomId.toString().charCodeAt(roomId.toString().length - 1) || 0) % 5;
  const temps = ['21.5°C', '22.0°C', '22.8°C', '21.8°C', '22.4°C'];
  const humids = ['42%', '45%', '48%', '44%', '46%'];
  const angles = ['Main Play Area', 'Activity Corner', 'Reading Circle', 'Nap & Rest Zone', 'Art & Craft Station'];
  
  return {
    temperature: temps[seed],
    humidity: humids[seed],
    primaryAngle: angles[seed],
    bitrate: '4.5 Mbps',
    fps: 30,
    resolution: '1080p HD',
    audioLevel: 'Normal (34 dB)',
  };
};

/**
 * @desc    Get live stream rooms based on User Role (RBAC)
 * @route   GET /api/live-stream/rooms
 * @access  Private (Admin, Reception, Teacher, Parent)
 */
const getLiveStreamRooms = async (req, res) => {
  try {
    const user = req.user;
    const role = user.role;

    let classrooms = [];
    let parentChildrenMap = new Map(); // For parent role: maps roomId -> list of user's children
    let parentAllChildren = [];

    // ── 1. Admin & Reception: Full Access to ALL active classrooms ──
    if (role === 'admin' || role === 'reception') {
      classrooms = await Classroom.find({ status: { $ne: 'inactive' } })
        .populate('teacher', 'fullName email phone avatar')
        .sort({ name: 1 })
        .lean();
    }

    // ── 2. Teacher (Nanny): Access ONLY to her assigned classroom ──
    else if (role === 'teacher') {
      classrooms = await Classroom.find({
        teacher: user._id,
        status: { $ne: 'inactive' }
      })
        .populate('teacher', 'fullName email phone avatar')
        .lean();
    }

    // ── 3. Parent: Access ONLY to classroom(s) where their children are enrolled ──
    else if (role === 'parent') {
      // Find all approved children belonging to this parent
      const myChildren = await Child.find({
        parents: user._id,
        status: 'approved'
      })
        .select('firstName lastName dateOfBirth gender photoUrl classroom')
        .lean();

      // Extract unique classroom IDs that children are assigned to
      const roomIds = myChildren
        .filter(c => c.classroom)
        .map(c => c.classroom.toString());

      const uniqueRoomIds = [...new Set(roomIds)];

      if (uniqueRoomIds.length > 0) {
        classrooms = await Classroom.find({
          _id: { $in: uniqueRoomIds },
          status: { $ne: 'inactive' }
        })
          .populate('teacher', 'fullName email avatar')
          .lean();

        // Group the parent's children by classroom
        myChildren.forEach(child => {
          if (!child.classroom) return;
          const rId = child.classroom.toString();
          if (!parentChildrenMap.has(rId)) {
            parentChildrenMap.set(rId, []);
          }
          const childObj = {
            _id: child._id,
            firstName: child.firstName,
            lastName: child.lastName,
            gender: child.gender,
            photoUrl: child.photoUrl || null,
            dateOfBirth: child.dateOfBirth,
            classroomId: rId
          };
          parentChildrenMap.get(rId).push(childObj);
        });

        // Build flat list of all parent children with their classroom details for the dropdown
        parentAllChildren = myChildren
          .filter(c => c.classroom)
          .map(c => {
            const room = classrooms.find(r => r._id.toString() === c.classroom.toString());
            return {
              _id: c._id,
              firstName: c.firstName,
              lastName: c.lastName,
              gender: c.gender,
              photoUrl: c.photoUrl || null,
              dateOfBirth: c.dateOfBirth,
              classroomId: c.classroom.toString(),
              classroomName: room ? room.name : 'Classroom',
              classroomNumber: room ? (room.room || 'Room 1') : 'Room 1'
            };
          });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have permissions to view live streams.'
      });
    }

    // Fetch children details to attach to each classroom
    const roomData = await Promise.all(
      classrooms.map(async (room) => {
        const roomIdStr = room._id.toString();
        const overrides = roomStreamOverrides.get(roomIdStr) || {};
        const telemetry = getRoomTelemetry(room._id, room.name);

        // Compute camera identifier e.g. CAM-101, CAM-SUNSHINE
        const camNumber = room.room
          ? room.room.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
          : room.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
        const cameraId = `CAM-${camNumber || room._id.toString().slice(-3).toUpperCase()}`;

        // Get count of all approved children in this classroom
        const totalEnrolled = await Child.countDocuments({
          classroom: room._id,
          status: 'approved'
        });

        // Child payload based on role:
        // Parents ONLY see their OWN child info (for privacy of other families)
        // Admin, Reception & Teacher see all children in the room
        let visibleChildren = [];
        if (role === 'parent') {
          visibleChildren = parentChildrenMap.get(roomIdStr) || [];
        } else {
          visibleChildren = await Child.find({
            classroom: room._id,
            status: 'approved'
          })
            .select('firstName lastName gender photoUrl dateOfBirth')
            .limit(20)
            .lean();
        }

        return {
          id: room._id,
          roomId: room._id,
          name: room.name,
          roomNumber: room.room || 'Room 1',
          ageGroup: room.ageGroup || 'All Ages',
          capacity: room.capacity || 15,
          color: room.color || '#00ADB5',
          description: room.description || '',
          teacher: room.teacher
            ? {
                _id: room.teacher._id,
                fullName: room.teacher.fullName,
                email: room.teacher.email,
                avatar: room.teacher.avatar || null
              }
            : null,
          totalEnrolled,
          enrolledCount: totalEnrolled,
          visibleChildren,
          myChildren: role === 'parent' ? (parentChildrenMap.get(roomIdStr) || []) : [],
          
          // Camera & Stream Parameters
          cameraId,
          cameraName: `${room.name} HD-1`,
          status: overrides.status || 'online', // 'online' | 'offline' | 'maintenance'
          privacyMode: overrides.privacyMode !== undefined ? overrides.privacyMode : false,
          activeAngle: overrides.activeAngle || telemetry.primaryAngle,
          telemetry: {
            temperature: telemetry.temperature,
            humidity: telemetry.humidity,
            bitrate: telemetry.bitrate,
            fps: telemetry.fps,
            resolution: telemetry.resolution,
            audioLevel: telemetry.audioLevel,
          }
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: roomData.length,
      role,
      data: roomData,
      myChildren: parentAllChildren
    });
  } catch (error) {
    console.error('getLiveStreamRooms error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update camera settings (privacy mode, angle, status)
 * @route   PUT /api/live-stream/rooms/:id/settings
 * @access  Private (Admin, Reception, assigned Teacher)
 */
const updateCameraSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const { privacyMode, status, activeAngle } = req.body;
    const user = req.user;

    const classroom = await Classroom.findById(id);
    if (!classroom) {
      return res.status(404).json({ success: false, message: 'Classroom not found' });
    }

    // Role check: Admin and Reception can update any room.
    // Teacher can only update their own assigned room.
    if (
      user.role !== 'admin' &&
      user.role !== 'reception' &&
      !(user.role === 'teacher' && classroom.teacher && classroom.teacher.toString() === user._id.toString())
    ) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied. You can only control your assigned classroom camera.'
      });
    }

    const current = roomStreamOverrides.get(id.toString()) || {};
    const updated = {
      ...current,
      ...(privacyMode !== undefined && { privacyMode: Boolean(privacyMode) }),
      ...(status !== undefined && { status }),
      ...(activeAngle !== undefined && { activeAngle })
    };

    roomStreamOverrides.set(id.toString(), updated);

    return res.status(200).json({
      success: true,
      message: 'Camera settings updated successfully',
      data: {
        roomId: id,
        ...updated
      }
    });
  } catch (error) {
    console.error('updateCameraSettings error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getLiveStreamRooms,
  updateCameraSettings
};
