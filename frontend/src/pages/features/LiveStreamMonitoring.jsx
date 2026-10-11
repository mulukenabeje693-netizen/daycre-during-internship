import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/useLanguage';
import {
  Lock,
  ShieldCheck,
  Users,
  User,
  Sun,
  Video,
  Mic,
  Volume2,
  VolumeX,
  Camera,
  Maximize2,
  Minimize2,
  Settings,
  Wifi,
  Heart,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Grid,
  Square,
  ChevronDown,
  Check,
  Baby
} from 'lucide-react';

const LiveStreamMonitoring = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  // Data state
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Parent multi-child states
  const [parentChildren, setParentChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [isChildDropdownOpen, setIsChildDropdownOpen] = useState(false);
  const childDropdownRef = useRef(null);

  // Interactive video controls
  const [volume, setVolume] = useState(65);
  const [isMuted, setIsMuted] = useState(false);
  const [isMicActive, setIsMicActive] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [streamQuality, setStreamQuality] = useState('1080p');
  const [nightVision, setNightVision] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Room switcher dropdown state
  const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Admin view toggle (single vs matrix)
  const [viewMode, setViewMode] = useState('single');

  const playerContainerRef = useRef(null);
  const videoRef = useRef(null);

  // Live real-time clock updating every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Synchronize audio volume and mute state with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = isMuted ? 0 : volume / 100;
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, [isMuted, volume]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsRoomDropdownOpen(false);
      }
      if (childDropdownRef.current && !childDropdownRef.current.contains(e.target)) {
        setIsChildDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Map room name to its corresponding video feed if available (Rainbow Room video feed)
  const getRoomVideo = (name = '', angle = 1) => {
    const lower = (name || '').toLowerCase();
    if (
      lower.includes('rainbow') ||
      lower.includes('rain bow') ||
      lower.includes('rein bow') ||
      lower.includes('reinbow') ||
      (angle === 2 && !lower.includes('sunshine') && !lower.includes('play'))
    ) {
      return '/assets/images/rein%20bow%20room.mp4';
    }
    return null;
  };

  // Map room name and optional angle index to its corresponding camera feed photo
  const getRoomImage = (name = '', angle = 1) => {
    if (angle === 2) return '/assets/images/daycare-rainbow-room.jpg';
    if (angle === 3) return '/assets/images/daycare-play-area.jpg';
    const lower = (name || '').toLowerCase();
    if (lower.includes('rainbow') || lower.includes('art') || lower.includes('color')) {
      return '/assets/images/daycare-rainbow-room.jpg';
    }
    if (lower.includes('play') || lower.includes('activity')) {
      return '/assets/images/daycare-play-area.jpg';
    }
    return '/assets/images/daycare-sunshine-room.jpg';
  };

  // Format timestamp: "Sep 21, 2026  12:31:24 PM" exactly like reference image
  const formatLiveTimestamp = (date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${month} ${day}, ${year}  ${hours}:${minutes}:${seconds} ${ampm}`;
  };

  // Fetch permitted rooms from backend
  const fetchRooms = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/live-stream/rooms');
      if (res.data.success) {
        const roomList = res.data.data || [];
        setRooms(roomList);
        const myKids = res.data.myChildren || [];
        setParentChildren(myKids);

        if (myKids.length > 0) {
          setSelectedChildId(prev => prev || myKids[0]._id);
          if (myKids[0].classroomId) {
            setSelectedRoomId(prev => prev || myKids[0].classroomId);
          }
        } else if (roomList.length > 0 && !selectedRoomId) {
          setSelectedRoomId(roomList[0].roomId);
        }
      }
    } catch (err) {
      // For teachers with no assigned classroom yet, or any other non-critical error,
      // just log it — the page still renders with placeholder content.
      console.warn('Live stream rooms fetch:', err.response?.data?.message || err.message);
      // Only show an error if it's truly unexpected (not a "no rooms" situation)
      if (err.response?.status && err.response.status !== 404 && err.response.status !== 403) {
        setError(err.response?.data?.message || 'Failed to connect to daycare live monitoring server.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const selectedRoom = rooms.find(r => r.roomId === selectedRoomId) || rooms[0] || null;
  const selectedChild = parentChildren.find(c => c._id === selectedChildId) || parentChildren[0] || null;

  // Derive display values matching the screenshot
  const roomName = selectedRoom?.name || selectedChild?.classroomName || 'Sunshine Room';
  const childrenCount = selectedRoom ? (selectedRoom.enrolledCount || selectedRoom.visibleChildren?.length || 8) : 8;
  const nannyName = selectedRoom?.teacher?.fullName?.split(' ')[0] || user?.fullName?.split(' ')[0] || 'Sarah';

  // Toggle Mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Volume Change
  const handleVolumeChange = (e) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (val === 0) setIsMuted(true);
    else if (isMuted) setIsMuted(false);
  };

  // Toggle Mic
  const toggleMic = () => {
    setIsMicActive(!isMicActive);
    setActionSuccess(isMicActive ? 'Classroom audio muted' : 'Classroom audio active');
    setTimeout(() => setActionSuccess(''), 2500);
  };

  // Fullscreen Handler
  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Take Snapshot Download
  const handleTakeSnapshot = () => {
    try {
      if (videoRef.current && getRoomVideo(roomName)) {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Watermark
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(30, canvas.height - 80, 520, 50);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`${roomName} - Camera 01  |  ${formatLiveTimestamp(currentTime)}`, 45, canvas.height - 48);

        const dataUrl = canvas.toDataURL('image/png');
        const filename = `Mint-Daycare-${roomName.replace(/\s+/g, '-')}-${Date.now()}.png`;
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();

        setActionSuccess('Snapshot saved to downloads!');
        setTimeout(() => setActionSuccess(''), 3000);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = getRoomImage(roomName);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1920;
        canvas.height = img.naturalHeight || 1080;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Watermark
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(30, canvas.height - 80, 520, 50);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(`${roomName} - Camera 01  |  ${formatLiveTimestamp(currentTime)}`, 45, canvas.height - 48);

        const dataUrl = canvas.toDataURL('image/png');
        const filename = `Mint-Daycare-${roomName.replace(/\s+/g, '-')}-${Date.now()}.png`;
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();

        setActionSuccess('Snapshot saved to downloads!');
        setTimeout(() => setActionSuccess(''), 3000);
      };
    } catch (err) {
      console.error('Snapshot failed:', err);
    }
  };

  // Privacy Toggle
  const handleTogglePrivacy = async (roomId, currentPrivacy) => {
    try {
      const res = await api.put(`/live-stream/rooms/${roomId}/settings`, {
        privacyMode: !currentPrivacy
      });
      if (res.data.success) {
        setRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, privacyMode: !currentPrivacy } : r));
        setActionSuccess(!currentPrivacy ? 'Privacy mode enabled (Camera masked)' : 'Privacy mode disabled (Feed restored)');
        setTimeout(() => setActionSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update camera privacy.');
    }
  };

  const isAdminOrReception = user?.role === 'admin' || user?.role === 'reception';
  const isTeacher = user?.role === 'teacher';
  const isParent = user?.role === 'parent';

  return (
    <div className="space-y-5 animate-fade-in text-slate-800 dark:text-slate-100 font-sans select-none">
      {/* ── 1. Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Side: Glowing Green Lock + Title + Live Badge */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl lg:text-[26px] font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                {t('liveStream') || 'Live Stream'}
              </h1>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                LIVE
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Real-Time Live Video Streaming & Room Monitoring
            </p>
          </div>
        </div>

        {/* Right Side: Focus & Multi-Cam Switcher + Role Scope Banner */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Focus & Multi-Cam Toggle Pill */}
          <div className="flex items-center bg-slate-100 dark:bg-[#071f30] p-1 rounded-xl border border-slate-200 dark:border-teal-500/40 shadow-inner">
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'single'
                  ? 'bg-[#00b4d8] text-white shadow-md shadow-cyan-500/25'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Square className="w-3.5 h-3.5 stroke-[2.5]" />
              Focus
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-[#00b4d8] text-white shadow-md shadow-cyan-500/25'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Grid className="w-3.5 h-3.5 stroke-[2.5]" />
              Multi-Cam
            </button>
          </div>

          {/* Access Scope Banner matching user mockup */}
          <div className="bg-white dark:bg-[#071f30] border border-slate-200 dark:border-teal-500/40 rounded-2xl px-5 py-2.5 flex items-center gap-3.5 shadow-sm dark:shadow-lg transition-colors">
            <div className="w-9 h-9 rounded-full bg-teal-500/10 dark:bg-teal-500/15 border border-teal-500/20 dark:border-teal-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white leading-tight">
                {isAdminOrReception && 'Full Campus Access'}
                {isTeacher && 'Assigned Classroom Access'}
                {isParent && 'Child Monitoring Access'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isAdminOrReception && 'Monitoring all active classrooms'}
                {isTeacher && 'Monitoring your assigned classroom feeds'}
                {isParent && (parentChildren.length > 1 ? "Monitoring your children's feeds" : "Monitoring your child's classroom")}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 dark:border-teal-500/30 text-emerald-600 dark:text-teal-400 flex items-center justify-center ml-2 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Success / Error Banners */}
      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Multi-Room Selector Tabs for Admin ── */}
      {isAdminOrReception && rooms.length > 1 && viewMode === 'single' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {rooms.map(room => (
            <button
              key={room.roomId}
              type="button"
              onClick={() => setSelectedRoomId(room.roomId)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${room.roomId === selectedRoom?.roomId ? 'bg-teal-600 text-white border-teal-500 shadow-md shadow-teal-500/20' : 'bg-white dark:bg-[#081827] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-teal-900/40 hover:border-teal-500/40'}`}
            >
              <span className={`w-2 h-2 rounded-full ${room.privacyMode ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
              <span>{room.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── 2. Main Content Grid (65% Left / 35% Right) ── */}
      {viewMode === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ──── LEFT COLUMN: THE LIVE STREAM VIDEO (8 Cols) ──── */}
          <div className="lg:col-span-8">
            <div className="bg-white dark:bg-[#081827] border border-slate-200/80 dark:border-teal-900/50 rounded-2xl p-4 sm:p-5 shadow-sm dark:shadow-2xl space-y-4 transition-colors">
              {/* Inner Card Top Header */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Left: Icon, Sun, Room Name */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/20 border border-teal-200 dark:border-teal-500/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 shadow-sm shadow-teal-500/10">
                    {isParent ? <Baby className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                  </div>
                  <Sun className="w-6 h-6 text-amber-500 dark:text-amber-400 shrink-0" />
                  <div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-none">
                      {isParent ? 'My Child’s Classroom' : 'My Assigned Classroom'}
                    </p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mt-1 leading-tight tracking-wide">
                      {isParent && selectedChild ? `${selectedChild.firstName}'s Classroom (${roomName})` : roomName}
                    </p>
                  </div>
                </div>

                {/* Right: Live Pill, Real-time badge, Dynamic Timestamp */}
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-600 text-white font-bold text-[11px] shadow-sm shadow-red-600/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                    LIVE
                  </span>
                  <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-medium text-xs">
                    <Wifi className="w-3.5 h-3.5" />
                    Real-time
                  </span>
                  <span className="text-slate-500 dark:text-slate-300 font-mono text-[11px] whitespace-nowrap">
                    {formatLiveTimestamp(currentTime)}
                  </span>
                </div>
              </div>

              {/* Video Player Display */}
              <div
                ref={playerContainerRef}
                className="relative rounded-2xl overflow-hidden aspect-video bg-black shadow-inner border border-slate-800/80 group select-none"
              >
                {/* Privacy Mode Overlay */}
                {selectedRoom?.privacyMode ? (
                  <div className="absolute inset-0 z-20 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 animate-pulse">
                      <EyeOff className="w-8 h-8" />
                    </div>
                    <h4 className="text-lg font-bold text-white">Privacy Shield Active</h4>
                    <p className="text-xs text-slate-400 max-w-sm mt-1">
                      Camera feed is temporarily shielded for children's privacy.
                    </p>
                    {isAdminOrReception && (
                      <button
                        type="button"
                        onClick={() => handleTogglePrivacy(selectedRoom.roomId, true)}
                        className="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold transition-all shadow-md"
                      >
                        Disable Privacy Mode
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* The Crisp Classroom Feed (Video for Rainbow Room, Image for others) */}
                    {getRoomVideo(roomName) ? (
                      <video
                        ref={videoRef}
                        key={roomName}
                        src={getRoomVideo(roomName)}
                        autoPlay
                        loop
                        muted={isMuted}
                        playsInline
                        className="w-full h-full object-cover transition-all duration-300"
                        style={{
                          filter: nightVision ? 'invert(10%) contrast(150%) hue-rotate(90deg)' : 'none'
                        }}
                      />
                    ) : (
                      <img
                        src={getRoomImage(roomName)}
                        alt="Daycare Live Stream"
                        className="w-full h-full object-cover transition-all duration-300"
                        style={{
                          filter: nightVision ? 'invert(10%) contrast(150%) hue-rotate(90deg)' : 'none'
                        }}
                      />
                    )}

                    {/* Subtle CCTV Ambient Scanlines Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30 pointer-events-none" />

                    {/* Top-Left: "● LIVE" Badge */}
                    <div className="absolute top-3.5 left-3.5 z-10 pointer-events-none">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md text-white font-bold text-xs border border-white/10 shadow-md">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        LIVE
                      </span>
                    </div>

                    {/* Security Watermark for Parent Feed */}
                    {isParent && (
                      <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center opacity-20 px-4">
                        <p className="text-white text-xs sm:text-sm font-mono tracking-widest transform -rotate-12 select-none text-center">
                          MINT DAYCARE SECURE FEED • PARENT: {user?.fullName?.toUpperCase()} • CHILD: {selectedChild ? `${selectedChild.firstName} ${selectedChild.lastName}`.toUpperCase() : 'STUDENT'} • {currentTime.toISOString().split('T')[0]}
                        </p>
                      </div>
                    )}

                    {/* Bottom-Left: Room & Camera Tag */}
                    <div className="absolute bottom-3.5 left-3.5 z-10 pointer-events-none">
                      <span className="px-3 py-1.5 rounded-md bg-black/60 backdrop-blur-md text-white font-medium text-xs border border-white/10 shadow-md">
                        {roomName} – Camera 01
                      </span>
                    </div>

                    {/* Bottom Floating Control Dock */}
                    <div className="absolute bottom-3.5 right-3.5 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-10 bg-black/75 backdrop-blur-md border border-white/15 px-4 py-2 rounded-2xl flex items-center gap-3.5 shadow-2xl">
                      {/* Volume Icon + Range Slider */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={toggleMute}
                          className="text-white hover:text-teal-400 transition-colors cursor-pointer"
                          title={isMuted ? 'Unmute' : 'Mute'}
                        >
                          {isMuted || volume === 0 ? (
                            <VolumeX className="w-4 h-4 text-slate-400" />
                          ) : (
                            <Volume2 className="w-4 h-4 text-teal-400" />
                          )}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={isMuted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="w-16 sm:w-20 accent-teal-400 h-1 bg-white/20 rounded-lg cursor-pointer"
                          title={`Volume: ${isMuted ? 0 : volume}%`}
                        />
                      </div>

                      {/* Mic Button */}
                      <button
                        type="button"
                        onClick={toggleMic}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${isMicActive ? 'bg-teal-500 text-white shadow-md shadow-teal-500/30' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}
                        title={isMicActive ? 'Mute Classroom Microphone' : 'Enable Classroom Microphone'}
                      >
                        <Mic className="w-4 h-4" />
                      </button>

                      {/* Snapshot Camera Button */}
                      <button
                        type="button"
                        onClick={handleTakeSnapshot}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title="Capture Instant Snapshot"
                      >
                        <Camera className="w-4 h-4" />
                      </button>

                      {/* Fullscreen Button */}
                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm"
                        title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
                      >
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                      </button>

                      {/* Settings Gear */}
                      <button
                        type="button"
                        onClick={() => setShowSettings(!showSettings)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm ${showSettings ? 'bg-teal-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                        title="Stream Settings"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quick Settings Dropdown Overlay */}
                    {showSettings && (
                      <div className="absolute bottom-16 right-3.5 sm:right-auto sm:left-1/2 sm:-translate-x-1/2 z-30 bg-[#081827]/95 backdrop-blur-md border border-teal-500/30 rounded-2xl p-4 w-64 shadow-2xl text-xs space-y-3">
                        <p className="font-bold text-white border-b border-white/10 pb-2">Stream Configuration</p>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">Resolution</span>
                          <select
                            value={streamQuality}
                            onChange={(e) => setStreamQuality(e.target.value)}
                            className="bg-slate-900 border border-teal-500/40 text-teal-300 text-xs rounded-lg px-2 py-1 outline-none"
                          >
                            <option value="1080p">1080p Full HD</option>
                            <option value="720p">720p HD</option>
                            <option value="480p">480p SD</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">Night Vision (IR)</span>
                          <button
                            type="button"
                            onClick={() => setNightVision(!nightVision)}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${nightVision ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400'}`}
                          >
                            {nightVision ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        {(isAdminOrReception || isTeacher) && (
                          <div className="pt-2 border-t border-white/10">
                            <button
                              type="button"
                              onClick={() => handleTogglePrivacy(selectedRoom?.roomId, selectedRoom?.privacyMode)}
                              className="w-full py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold"
                            >
                              {selectedRoom?.privacyMode ? 'Turn Off Privacy Shield' : 'Turn On Privacy Shield'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ──── RIGHT COLUMN: ROOM INFO & STATUS CARDS (4 Cols) ──── */}
          <div className="lg:col-span-4 space-y-5">
            {isParent ? (
              /* ─── PARENT VIEW: CHILD & CLASSROOM INFORMATION ─── */
              <div className="bg-white dark:bg-[#081827] border border-slate-200/80 dark:border-teal-900/50 rounded-2xl p-5 shadow-sm dark:shadow-2xl space-y-4 transition-colors">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Child & Room Information</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30">
                    Parent Portal
                  </span>
                </div>

                {/* If Parent has 2 or more children: Interactive Child Dropdown */}
                {parentChildren.length >= 2 ? (
                  <div ref={childDropdownRef} className="relative">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-1.5 flex items-center justify-between">
                      <span>Select Child:</span>
                      <span className="text-teal-600 dark:text-teal-400 text-[10px] font-semibold">{parentChildren.length} children registered</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsChildDropdownOpen(!isChildDropdownOpen)}
                      className="w-full bg-slate-50 hover:bg-slate-100 dark:bg-[#0b2438] dark:hover:bg-[#0c2e47] border border-slate-200 dark:border-teal-500/30 hover:border-teal-500/40 dark:hover:border-teal-500/50 rounded-xl p-3.5 flex items-center justify-between gap-3.5 transition-all text-left group cursor-pointer shadow-sm"
                      title="Click to switch between your children"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-500 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md shadow-teal-500/20 group-hover:scale-105 transition-transform">
                          {selectedChild?.firstName?.[0]}{selectedChild?.lastName?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-teal-700 dark:text-teal-400 font-bold leading-none flex items-center gap-1.5">
                            <span>{selectedChild?.firstName} {selectedChild?.lastName}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-normal">Active</span>
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-tight truncate">
                            Classroom: <strong className="text-slate-900 dark:text-white">{selectedChild?.classroomName || roomName}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors shrink-0">
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isChildDropdownOpen ? 'rotate-180 text-teal-600 dark:text-teal-400' : ''}`} />
                      </div>
                    </button>

                    {/* Dropdown Menu for Children */}
                    {isChildDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-white dark:bg-[#071929]/95 backdrop-blur-xl border border-slate-200 dark:border-teal-500/40 rounded-2xl p-2 shadow-2xl space-y-1 animate-fade-in">
                        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/5 uppercase tracking-wider flex items-center justify-between">
                          <span>Your Enrolled Children</span>
                          <span className="text-teal-600 dark:text-teal-400 font-normal lowercase">{parentChildren.length} total</span>
                        </div>

                        <div className="max-h-56 overflow-y-auto space-y-1 pt-1 pr-1 scrollbar-thin">
                          {parentChildren.map((child) => {
                            const isSelected = child._id === selectedChild?._id;
                            return (
                              <button
                                key={child._id}
                                type="button"
                                onClick={() => {
                                  setSelectedChildId(child._id);
                                  if (child.classroomId) {
                                    setSelectedRoomId(child.classroomId);
                                  }
                                  setIsChildDropdownOpen(false);
                                  setActionSuccess(`Switched camera to ${child.firstName}'s classroom (${child.classroomName})`);
                                  setTimeout(() => setActionSuccess(''), 2500);
                                }}
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-teal-50 dark:bg-teal-600/30 border border-teal-300 dark:border-teal-500/50 text-teal-900 dark:text-white font-bold'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0c2e47] hover:text-slate-900 dark:hover:text-white border border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-full bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-300 font-bold text-xs flex items-center justify-center shrink-0">
                                    {child.firstName?.[0]}{child.lastName?.[0]}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold">{child.firstName} {child.lastName}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                      {child.classroomName} • {child.classroomNumber || 'Room 1'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Single Child Card for Parent */
                  <div className="bg-slate-50 dark:bg-[#0b2438] border border-slate-200 dark:border-teal-500/20 rounded-xl p-3.5 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/20 dark:border-teal-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-teal-500/20">
                      <Baby className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-none">
                        {selectedChild ? `${selectedChild.firstName} ${selectedChild.lastName}` : 'Enrolled Child'}
                      </p>
                      <p className="text-base font-bold text-slate-900 dark:text-white mt-1 leading-tight tracking-wide">
                        {roomName}
                      </p>
                    </div>
                  </div>
                )}

                {/* Parent Metrics Rows */}
                <div className="space-y-3 pt-1">
                  {/* Row 1: Selected Child */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <Baby className="w-3.5 h-3.5" />
                      </div>
                      <span>Child</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedChild ? `${selectedChild.firstName} ${selectedChild.lastName}` : 'My Child'}
                    </span>
                  </div>

                  {/* Row 2: Classroom */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <Sun className="w-3.5 h-3.5" />
                      </div>
                      <span>Classroom</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{roomName}</span>
                  </div>

                  {/* Row 3: Nanny on Duty */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span>Nanny on Duty</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{nannyName}</span>
                  </div>

                  {/* Row 4: Camera Feed Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <Video className="w-3.5 h-3.5" />
                      </div>
                      <span>Camera</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                      Online
                    </span>
                  </div>

                  {/* Row 5: Secure Watermarked Stream */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <span>Secure Stream</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                      Encrypted & Watermarked
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* ─── NON-PARENT VIEW: ROOM INFORMATION FOR NANNY / ADMIN ─── */
              <div className="bg-white dark:bg-[#081827] border border-slate-200/80 dark:border-teal-900/50 rounded-2xl p-5 shadow-sm dark:shadow-2xl space-y-4 transition-colors">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Room Information</h3>

                {/* Assigned Room Dropdown Box */}
                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsRoomDropdownOpen(!isRoomDropdownOpen)}
                    className="w-full bg-slate-50 hover:bg-slate-100 dark:bg-[#0b2438] dark:hover:bg-[#0c2e47] border border-slate-200 dark:border-teal-500/20 hover:border-teal-500/40 dark:hover:border-teal-500/40 rounded-xl p-3.5 flex items-center justify-between gap-3.5 transition-all text-left group cursor-pointer shadow-sm"
                    title="Click to select another assigned room"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20 group-hover:scale-105 transition-transform">
                        <Sun className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-none flex items-center gap-1.5">
                          <span>Assigned Room</span>
                          {rooms.length > 1 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-transparent font-semibold">
                              {rooms.length} rooms
                            </span>
                          )}
                        </p>
                        <p className="text-base font-bold text-slate-900 dark:text-white mt-1 leading-tight tracking-wide truncate">
                          {roomName}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors shrink-0">
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isRoomDropdownOpen ? 'rotate-180 text-teal-600 dark:text-teal-400' : ''}`} />
                    </div>
                  </button>

                  {/* Interactive Dropdown Menu */}
                  {isRoomDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-white dark:bg-[#071929]/95 backdrop-blur-xl border border-slate-200 dark:border-teal-500/30 rounded-2xl p-2 shadow-2xl space-y-1 animate-fade-in">
                      <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-white/5 uppercase tracking-wider flex items-center justify-between">
                        <span>Select Assigned Room</span>
                        <span className="text-teal-600 dark:text-teal-400 font-normal lowercase">{rooms.length} available</span>
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-1 pt-1 pr-1 scrollbar-thin">
                        {rooms.map((room) => {
                          const isSelected = room.roomId === selectedRoom?.roomId;
                          return (
                            <button
                              key={room.roomId}
                              type="button"
                              onClick={() => {
                                setSelectedRoomId(room.roomId);
                                setIsRoomDropdownOpen(false);
                                setActionSuccess(`Switched camera to ${room.name}`);
                                setTimeout(() => setActionSuccess(''), 2500);
                              }}
                              className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-teal-50 dark:bg-teal-600/30 border border-teal-300 dark:border-teal-500/50 text-teal-900 dark:text-white font-bold'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0c2e47] hover:text-slate-900 dark:hover:text-white border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-2 h-2 rounded-full shrink-0 ${room.privacyMode ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'}`} />
                                <div className="min-w-0">
                                  <p className="truncate font-semibold">{room.name}</p>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{room.roomNumber || 'Classroom'}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-mono">
                                  {room.enrolledCount || 8} kids
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Information Rows matching mockup */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <span>Children Present</span>
                    </div>
                    <span className="text-base font-bold text-slate-900 dark:text-white">{childrenCount}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span>Nanny</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{nannyName}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <Video className="w-3.5 h-3.5" />
                      </div>
                      <span>Camera</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                      Online
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <span>Secure Encrypted Stream</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                      Yes
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Room Monitoring Status Card */}
            <div className="bg-white dark:bg-[#081827] border border-slate-200/80 dark:border-teal-900/50 rounded-2xl p-5 shadow-sm dark:shadow-2xl space-y-4 transition-colors">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Room Monitoring Status</h3>

              {/* 3 Status Mini Cards Grid */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                {/* Status 1: Camera Online */}
                <div className="bg-slate-50 hover:bg-slate-100 dark:bg-[#071f30] border border-slate-200/80 dark:border-teal-500/30 hover:border-teal-500/40 dark:hover:border-teal-400/50 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-2 transition-all shadow-sm group">
                  <Video className="w-5 h-5 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform" />
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight">
                    Camera<br />Online
                  </p>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
                </div>

                {/* Status 2: Audio Active */}
                <div className="bg-slate-50 hover:bg-slate-100 dark:bg-[#071f30] border border-slate-200/80 dark:border-teal-500/30 hover:border-teal-500/40 dark:hover:border-teal-400/50 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-2 transition-all shadow-sm group">
                  <Mic className="w-5 h-5 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform" />
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight">
                    Audio<br />Active
                  </p>
                  <span className={`w-2 h-2 rounded-full ${isMicActive ? 'bg-emerald-500 dark:bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-slate-300 dark:bg-slate-500'}`}></span>
                </div>

                {/* Status 3: Secure Connection */}
                <div className="bg-slate-50 hover:bg-slate-100 dark:bg-[#071f30] border border-slate-200/80 dark:border-teal-500/30 hover:border-teal-500/40 dark:hover:border-teal-400/50 rounded-xl p-3 flex flex-col items-center justify-center text-center gap-2 transition-all shadow-sm group">
                  <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform" />
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-tight">
                    Secure<br />Connection
                  </p>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-sm shadow-emerald-400/50"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Multi-Cam Matrix Grid (Role-Based for Parent, Nanny, and Admin) ── */}
      {viewMode === 'matrix' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between px-1 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
                {isParent && (parentChildren.length > 1 ? "Multi-Cam Monitoring: All Your Children" : `Multi-Cam Angle View: ${selectedChild?.firstName || 'Your Child'}'s Room`)}
                {isTeacher && (rooms.length > 1 ? "Multi-Cam Monitoring: Your Assigned Rooms" : `Multi-Cam Angle View: ${roomName}`)}
                {isAdminOrReception && "Full Campus Multi-Cam Surveillance"}
              </span>
            </div>
            <span className="text-xs text-teal-600 dark:text-teal-400 font-medium font-mono">
              {formatLiveTimestamp(currentTime)}
            </span>
          </div>

          {/* 1. PARENT MULTI-CAM: For parent its child only */}
          {isParent && (
            parentChildren.length >= 2 ? (
              // Multi-child parent: show dedicated camera feed for each child
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {parentChildren.map((child) => {
                  const childRoomName = child.classroomName || 'Classroom';
                  const childImg = getRoomImage(childRoomName);
                  const isCurrent = child._id === selectedChildId;
                  return (
                    <div
                      key={child._id}
                      className={`bg-white dark:bg-[#081827] rounded-2xl overflow-hidden border transition-all shadow-sm dark:shadow-xl group ${
                        isCurrent ? 'border-teal-500 shadow-teal-500/20' : 'border-slate-200/80 dark:border-teal-900/50 hover:border-teal-500/40'
                      }`}
                    >
                      <div className="p-3 bg-slate-50 dark:bg-black/70 flex items-center justify-between text-slate-900 dark:text-white text-xs border-b border-slate-200 dark:border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <Baby className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          <span className="font-bold text-slate-900 dark:text-white">{child.firstName} {child.lastName}</span>
                        </div>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-medium border border-teal-200 dark:border-teal-500/30">
                          {childRoomName} {child.classroomNumber ? `(${child.classroomNumber})` : ''}
                        </span>
                      </div>

                      <div className="aspect-video relative bg-slate-900 overflow-hidden">
                        {getRoomVideo(childRoomName) ? (
                          <video
                            src={getRoomVideo(childRoomName)}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        ) : (
                          <img
                            src={childImg}
                            alt={`${child.firstName}'s Classroom`}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        )}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-red-600/90 text-white font-bold text-[10px] flex items-center gap-1 shadow">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                            LIVE
                          </span>
                          <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] text-teal-300 font-mono">
                            Camera 01
                          </span>
                        </div>
                        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono text-slate-200">
                          {formatLiveTimestamp(currentTime)}
                        </div>
                        {/* Security Watermark HUD */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-25">
                          <p className="text-[11px] font-mono font-black text-white/70 tracking-widest uppercase rotate-[-12deg] text-center select-none">
                            PARENT: {user?.fullName || 'VERIFIED'} • CHILD: {child.firstName} {child.lastName}
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-50 dark:bg-[#0b2438] flex items-center justify-between text-xs border-t border-slate-200 dark:border-white/5">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Live & Encrypted</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedChildId(child._id);
                            if (child.classroomId) setSelectedRoomId(child.classroomId);
                            setViewMode('single');
                            setActionSuccess(`Focused on ${child.firstName}'s classroom feed`);
                            setTimeout(() => setActionSuccess(''), 2500);
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition-all shadow-md shadow-teal-600/20 cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5 stroke-[2.5]" />
                          Focus Child
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Single child parent: show multiple camera angles for that child's room only
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  { id: 'cam1', name: 'Main Activity Area', label: 'Camera 01', angle: 1 },
                  { id: 'cam2', name: 'Play & Learning Zone', label: 'Camera 02', angle: 2 },
                  { id: 'cam3', name: 'Rest & Reading Corner', label: 'Camera 03', angle: 3 }
                ].map((cam) => (
                  <div
                    key={cam.id}
                    className="bg-white dark:bg-[#081827] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-teal-900/50 hover:border-teal-500/40 transition-all shadow-sm dark:shadow-xl group"
                  >
                    <div className="p-3 bg-slate-50 dark:bg-black/70 flex items-center justify-between text-slate-900 dark:text-white text-xs border-b border-slate-200 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="font-bold text-slate-900 dark:text-white">{cam.label} • {cam.name}</span>
                      </div>
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 font-mono">{roomName}</span>
                    </div>

                    <div className="aspect-video relative bg-slate-900 overflow-hidden">
                      {getRoomVideo(roomName, cam.angle) ? (
                        <video
                          src={getRoomVideo(roomName, cam.angle)}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <img
                          src={getRoomImage(roomName, cam.angle)}
                          alt={cam.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      )}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-red-600/90 text-white font-bold text-[10px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                          LIVE
                        </span>
                      </div>
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono text-slate-200">
                        {formatLiveTimestamp(currentTime)}
                      </div>
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-25">
                        <p className="text-[10px] font-mono font-black text-white/70 tracking-widest uppercase rotate-[-12deg] text-center select-none">
                          PARENT: {user?.fullName || 'VERIFIED'} • {selectedChild?.firstName || 'CHILD'}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-[#0b2438] flex items-center justify-between text-xs border-t border-slate-200 dark:border-white/5">
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">Nanny: <strong className="text-slate-900 dark:text-white">{nannyName}</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          setViewMode('single');
                          setActionSuccess(`Focused on ${cam.label} (${cam.name})`);
                          setTimeout(() => setActionSuccess(''), 2500);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition-all shadow-md shadow-teal-600/20 cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5 stroke-[2.5]" />
                        Focus Feed
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* 2. NANNY MULTI-CAM: For nanny its assigned room only */}
          {isTeacher && (
            rooms.length > 1 ? (
              // Nanny with multiple assigned rooms
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {rooms.map((room) => {
                  const isCurrent = room.roomId === selectedRoom?.roomId;
                  return (
                    <div
                      key={room.roomId}
                      className={`bg-white dark:bg-[#081827] rounded-2xl overflow-hidden border transition-all shadow-sm dark:shadow-xl group ${
                        isCurrent ? 'border-teal-500 shadow-teal-500/20' : 'border-slate-200/80 dark:border-teal-900/50 hover:border-teal-500/40'
                      }`}
                    >
                      <div className="p-3 bg-slate-50 dark:bg-black/70 flex items-center justify-between text-slate-900 dark:text-white text-xs border-b border-slate-200 dark:border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="font-bold text-slate-900 dark:text-white">{room.name}</span>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-mono border border-teal-200 dark:border-transparent">
                          {room.roomNumber || 'Classroom'}
                        </span>
                      </div>

                      <div className="aspect-video relative bg-slate-900 overflow-hidden">
                        {getRoomVideo(room.name) ? (
                          <video
                            src={getRoomVideo(room.name)}
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        ) : (
                          <img
                            src={getRoomImage(room.name)}
                            alt={room.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        )}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-red-600/90 text-white font-bold text-[10px] flex items-center gap-1 shadow">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                            LIVE
                          </span>
                          <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] text-teal-300 font-mono">
                            Camera 01
                          </span>
                        </div>
                        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono text-slate-200">
                          {formatLiveTimestamp(currentTime)}
                        </div>
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-25">
                          <p className="text-[11px] font-mono font-black text-white/70 tracking-widest uppercase rotate-[-12deg] text-center select-none">
                            NANNY: {user?.fullName || 'STAFF'} • ROOM: {room.name}
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-50 dark:bg-[#0b2438] flex items-center justify-between text-xs border-t border-slate-200 dark:border-white/5">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">Present: <strong className="text-slate-900 dark:text-white">{room.enrolledCount || 8} Children</strong></span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRoomId(room.roomId);
                            setViewMode('single');
                            setActionSuccess(`Switched focus to ${room.name}`);
                            setTimeout(() => setActionSuccess(''), 2500);
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition-all shadow-md shadow-teal-600/20 cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5 stroke-[2.5]" />
                          Focus Room
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Nanny with 1 assigned room: multi-angle cameras for her room
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  { id: 'cam1', name: 'Main Teaching & Group Area', label: 'Camera 01', angle: 1 },
                  { id: 'cam2', name: 'Activity & Craft Zone', label: 'Camera 02', angle: 2 },
                  { id: 'cam3', name: 'Rest & Nap Station', label: 'Camera 03', angle: 3 }
                ].map((cam) => (
                  <div
                    key={cam.id}
                    className="bg-white dark:bg-[#081827] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-teal-900/50 hover:border-teal-500/40 transition-all shadow-sm dark:shadow-xl group"
                  >
                    <div className="p-3 bg-slate-50 dark:bg-black/70 flex items-center justify-between text-slate-900 dark:text-white text-xs border-b border-slate-200 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="font-bold text-slate-900 dark:text-white">{cam.label} • {cam.name}</span>
                      </div>
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 font-mono">{roomName}</span>
                    </div>

                    <div className="aspect-video relative bg-slate-900 overflow-hidden">
                      {getRoomVideo(roomName, cam.angle) ? (
                        <video
                          src={getRoomVideo(roomName, cam.angle)}
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <img
                          src={getRoomImage(roomName, cam.angle)}
                          alt={cam.name}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      )}
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-red-600/90 text-white font-bold text-[10px] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                          LIVE
                        </span>
                      </div>
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono text-slate-200">
                        {formatLiveTimestamp(currentTime)}
                      </div>
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-25">
                        <p className="text-[10px] font-mono font-black text-white/70 tracking-widest uppercase rotate-[-12deg] text-center select-none">
                          NANNY: {user?.fullName || 'STAFF'} • {roomName}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-[#0b2438] flex items-center justify-between text-xs border-t border-slate-200 dark:border-white/5">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">Present: <strong className="text-slate-900 dark:text-white">{childrenCount} Children</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          setViewMode('single');
                          setActionSuccess(`Focused on ${cam.label} (${cam.name})`);
                          setTimeout(() => setActionSuccess(''), 2500);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition-all shadow-md shadow-teal-600/20 cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5 stroke-[2.5]" />
                        Focus Feed
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* 3. ADMIN / RECEPTION MULTI-CAM: Full campus classrooms */}
          {isAdminOrReception && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {rooms.map(room => (
                <div
                  key={room.roomId}
                  className="bg-white dark:bg-[#081827] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-teal-900/50 shadow-sm dark:shadow-xl relative group transition-all hover:border-teal-500/50"
                >
                  <div className="p-3 bg-slate-50 dark:bg-black/60 flex items-center justify-between text-slate-900 dark:text-white text-xs font-mono border-b border-slate-200 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="font-bold text-slate-900 dark:text-white">{room.name}</span>
                    </div>
                    <span className="text-slate-500 dark:text-slate-400">{room.roomNumber}</span>
                  </div>
                  <div className="aspect-video relative bg-slate-900 overflow-hidden">
                    {getRoomVideo(room.name) ? (
                      <video
                        src={getRoomVideo(room.name)}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <img
                        src={getRoomImage(room.name)}
                        alt={room.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    )}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-red-600/90 text-white font-bold text-[10px] flex items-center gap-1 shadow">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                        LIVE
                      </span>
                      <span className="px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] text-teal-300 font-mono">
                        Camera 01
                      </span>
                    </div>
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-[10px] font-mono text-slate-200">
                      {formatLiveTimestamp(currentTime)}
                    </div>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-[#0b2438] flex items-center justify-between text-xs border-t border-slate-200 dark:border-white/5">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">Present: {room.enrolledCount || 8} Children</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoomId(room.roomId);
                        setViewMode('single');
                        setActionSuccess(`Switched focus to ${room.name}`);
                        setTimeout(() => setActionSuccess(''), 2500);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition-all shadow-md shadow-teal-600/20 cursor-pointer"
                    >
                      <Square className="w-3.5 h-3.5 stroke-[2.5]" />
                      Focus Feed
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 3. Bottom Footer Banner matching reference mockup ── */}
      <div className="bg-white dark:bg-[#081d2e]/90 border border-slate-200 dark:border-teal-900/50 rounded-2xl px-5 py-3.5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs shadow-sm dark:shadow-xl transition-colors">
        {/* Left: Glowing Cyan Lock + Message */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/20 dark:border-teal-500/30 flex items-center justify-center shrink-0 shadow-sm shadow-teal-500/10">
            <Lock className="w-4 h-4" />
          </div>
          <p className="text-slate-600 dark:text-slate-300 font-medium text-xs leading-relaxed">
            Your assigned classroom is being monitored in real-time. &nbsp;|&nbsp; Keep children safe &nbsp;•&nbsp; Ensure a positive learning environment
          </p>
        </div>

        {/* Right: MinT ♡ brand typography */}
        <div className="text-right flex flex-col items-center md:items-end shrink-0">
          <div className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-serif text-lg font-bold tracking-wider leading-none">
            <span>MinT</span>
            <Heart className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 fill-teal-500/20 stroke-teal-600 dark:stroke-teal-400" />
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-light">
            Together for a brighter tomorrow
          </p>
        </div>
      </div>
    </div>
  );
};

export default LiveStreamMonitoring;
