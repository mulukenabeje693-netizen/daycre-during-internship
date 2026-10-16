const mongoose = require('mongoose');
const Child = require('../models/Child');
const Classroom = require('../models/Classroom');

const ELIGIBLE_CHILD_STATUSES = ['active', 'approved'];
const VACCINATION_STATUSES = ['Up to Date', 'Upcoming', 'Overdue'];

const parseDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

const getScope = async user => {
  const scope = { status: { $in: ELIGIBLE_CHILD_STATUSES } };
  if (user.role === 'parent') {
    scope.parents = user._id;
    return scope;
  }
  if (user.role !== 'teacher') return scope;

  const classrooms = await Classroom.find({ teacher: user._id, status: 'active' })
    .select('_id')
    .lean()
    .maxTimeMS(5000);
  scope.classroom = { $in: classrooms.map(classroom => classroom._id) };
  return scope;
};

const normalizeRecord = (body, user) => {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const dateGiven = parseDate(body.dateGiven);
  const nextDueDate = body.nextDueDate ? parseDate(body.nextDueDate) : null;
  const status = body.status;
  const doseNumber = body.doseNumber === '' || body.doseNumber === undefined || body.doseNumber === null
    ? undefined
    : Number(body.doseNumber);
  const provider = typeof body.provider === 'string' ? body.provider.trim() : '';
  const givenBy = user.fullName || '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

  if (!name || name.length > 120) return { error: 'Enter a vaccine name of 1 to 120 characters.' };
  if (!dateGiven) return { error: 'Enter a valid administration date in YYYY-MM-DD format.' };
  if (dateGiven > new Date(new Date().setHours(23, 59, 59, 999))) {
    return { error: 'Administration date cannot be in the future.' };
  }
  if (body.nextDueDate && !nextDueDate) return { error: 'Enter a valid next due date in YYYY-MM-DD format.' };
  if (nextDueDate && nextDueDate < dateGiven) return { error: 'Next due date cannot be before the administration date.' };
  if (doseNumber !== undefined && (!Number.isInteger(doseNumber) || doseNumber < 1 || doseNumber > 100)) {
    return { error: 'Dose number must be a whole number from 1 to 100.' };
  }
  if (!VACCINATION_STATUSES.includes(status)) return { error: 'Select a valid vaccination status.' };
  if (provider.length > 120 || givenBy.length > 120 || notes.length > 1000) {
    return { error: 'Provider and recorded-by fields must be at most 120 characters; notes must be at most 1000 characters.' };
  }

  return {
    record: {
      name,
      dateGiven,
      ...(doseNumber === undefined ? {} : { doseNumber }),
      ...(nextDueDate ? { nextDueDate } : {}),
      provider,
      givenBy,
      notes,
      status
    }
  };
};

const getVaccinations = async (req, res) => {
  try {
    const scope = await getScope(req.user);
    const children = await Child.find(scope)
      .select('firstName lastName dateOfBirth photoUrl status vaccinationStatus vaccinationLog classroom')
      .populate('classroom', 'name room')
      .sort({ lastName: 1, firstName: 1 })
      .lean()
      .maxTimeMS(8000);

    return res.status(200).json({ success: true, count: children.length, data: children });
  } catch (error) {
    console.error('Vaccination roster retrieval failed:', {
      role: req.user?.role || 'unknown',
      errorName: error.name || 'Error'
    });
    return res.status(500).json({
      success: false,
      code: 'VACCINATION_ROSTER_UNAVAILABLE',
      message: 'Could not load vaccination records right now. Please retry.'
    });
  }
};

const createVaccination = async (req, res) => {
  try {
    const { childId } = req.body || {};
    if (!mongoose.isValidObjectId(childId)) {
      return res.status(400).json({ success: false, message: 'Select a valid child.' });
    }
    const normalized = normalizeRecord(req.body || {}, req.user);
    if (normalized.error) return res.status(400).json({ success: false, message: normalized.error });

    const scope = await getScope(req.user);
    const dateStart = normalized.record.dateGiven;
    const dateEnd = new Date(dateStart.getFullYear(), dateStart.getMonth(), dateStart.getDate() + 1);
    const duplicateFilter = {
      _id: childId,
      ...scope,
      vaccinationLog: {
        $not: {
          $elemMatch: {
            name: normalized.record.name,
            dateGiven: { $gte: dateStart, $lt: dateEnd },
            doseNumber: normalized.record.doseNumber ?? null
          }
        }
      }
    };
    const child = await Child.findOneAndUpdate(
      duplicateFilter,
      { $push: { vaccinationLog: normalized.record } },
      { new: true, runValidators: true }
    );
    if (!child) {
      const existing = await Child.findOne({ _id: childId, ...scope }).select('_id').lean();
      if (!existing) return res.status(404).json({ success: false, message: 'Eligible child not found in your authorized scope.' });
      return res.status(409).json({ success: false, message: 'This vaccine, dose, and administration date are already recorded for this child.' });
    }

    const log = child.vaccinationLog[child.vaccinationLog.length - 1];
    return res.status(201).json({ success: true, data: { childId: child._id, log } });
  } catch (error) {
    console.error('Vaccination record creation failed:', {
      role: req.user?.role || 'unknown',
      errorName: error.name || 'Error'
    });
    return res.status(500).json({ success: false, message: 'Could not save the vaccination record. Please retry.' });
  }
};

const updateVaccination = async (req, res) => {
  try {
    const { childId, logId } = req.params;
    if (!mongoose.isValidObjectId(childId) || !mongoose.isValidObjectId(logId)) {
      return res.status(400).json({ success: false, message: 'Invalid child or vaccination record ID.' });
    }
    const normalized = normalizeRecord(req.body || {}, req.user);
    if (normalized.error) return res.status(400).json({ success: false, message: normalized.error });

    const scope = await getScope(req.user);
    const child = await Child.findOne({ _id: childId, ...scope });
    if (!child) return res.status(404).json({ success: false, message: 'Eligible child not found in your authorized scope.' });
    const log = child.vaccinationLog.id(logId);
    if (!log) return res.status(404).json({ success: false, message: 'Vaccination record not found.' });
    const duplicate = child.vaccinationLog.some(entry =>
      String(entry._id) !== String(logId) &&
      entry.name === normalized.record.name &&
      entry.dateGiven &&
      entry.dateGiven.toDateString() === normalized.record.dateGiven.toDateString() &&
      (entry.doseNumber ?? undefined) === normalized.record.doseNumber
    );
    if (duplicate) return res.status(409).json({ success: false, message: 'Another matching vaccine, dose, and date is already recorded.' });

    Object.assign(log, normalized.record);
    await child.save();
    return res.status(200).json({ success: true, data: { childId: child._id, log } });
  } catch (error) {
    console.error('Vaccination record update failed:', {
      role: req.user?.role || 'unknown',
      errorName: error.name || 'Error'
    });
    return res.status(500).json({ success: false, message: 'Could not update the vaccination record. Please retry.' });
  }
};

const deleteVaccination = async (req, res) => {
  try {
    const { childId, logId } = req.params;
    if (!mongoose.isValidObjectId(childId) || !mongoose.isValidObjectId(logId)) {
      return res.status(400).json({ success: false, message: 'Invalid child or vaccination record ID.' });
    }
    const scope = await getScope(req.user);
    const child = await Child.findOne({ _id: childId, ...scope });
    if (!child) return res.status(404).json({ success: false, message: 'Eligible child not found in your authorized scope.' });
    const log = child.vaccinationLog.id(logId);
    if (!log) return res.status(404).json({ success: false, message: 'Vaccination record not found.' });

    log.deleteOne();
    await child.save();
    return res.status(200).json({ success: true, message: 'Vaccination record deleted.' });
  } catch (error) {
    console.error('Vaccination record deletion failed:', {
      role: req.user?.role || 'unknown',
      errorName: error.name || 'Error'
    });
    return res.status(500).json({ success: false, message: 'Could not delete the vaccination record. Please retry.' });
  }
};

module.exports = { getVaccinations, createVaccination, updateVaccination, deleteVaccination };
