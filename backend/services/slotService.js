import Appointment from '../models/Appointment.js';
import SlotHold from '../models/SlotHold.js';
import DoctorLeave from '../models/DoctorLeave.js';

/**
 * Convert "HH:MM" to minutes since midnight
 */
const toMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Convert minutes since midnight to "HH:MM"
 */
const toTimeStr = (mins) => {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

/**
 * Generate all possible time slots for a doctor on a given date.
 * @param {Object} doctor - Doctor Mongoose document
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {Array<{startTime, endTime}>}
 */
export const generateAllSlots = (doctor, dateStr) => {
  const date = new Date(dateStr + 'T00:00:00Z');
  // 0=Sun, 1=Mon ... 6=Sat  — use UTC day to avoid timezone shifts
  const dayOfWeek = date.getUTCDay();

  const daySchedule = doctor.workingHours?.find((d) => d.dayOfWeek === dayOfWeek);

  if (!daySchedule || !daySchedule.isWorking || !daySchedule.slots?.length) {
    return [];
  }

  const duration = doctor.slotDurationMinutes || 30;
  const allSlots = [];

  for (const slot of daySchedule.slots) {
    let current = toMinutes(slot.start);
    const end = toMinutes(slot.end);

    while (current + duration <= end) {
      allSlots.push({
        startTime: toTimeStr(current),
        endTime: toTimeStr(current + duration),
      });
      current += duration;
    }
  }

  return allSlots;
};

/**
 * Get booked (HELD + CONFIRMED) slot start times for a doctor on a date.
 * @returns {Set<string>} set of startTime strings
 */
export const getBlockedStartTimes = async (doctorId, dateStr) => {
  const blocked = new Set();

  // Active appointments
  const appointments = await Appointment.find({
    doctorId,
    date: dateStr,
    status: { $in: ['HELD', 'CONFIRMED'] },
  }).select('startTime');

  appointments.forEach((a) => blocked.add(a.startTime));

  // Active slot holds
  const holds = await SlotHold.find({
    doctorId,
    date: dateStr,
    status: 'HELD',
    expiresAt: { $gt: new Date() },
  }).select('startTime');

  holds.forEach((h) => blocked.add(h.startTime));

  return blocked;
};

/**
 * Return truly available slots (all generated minus blocked).
 */
export const getAvailableSlots = async (doctor, dateStr) => {
  // Check if doctor is on leave
  const leave = await DoctorLeave.findOne({
    doctorId: doctor._id,
    date: dateStr,
  });

  if (leave) return [];

  const all = generateAllSlots(doctor, dateStr);
  if (!all.length) return [];

  const blocked = await getBlockedStartTimes(doctor._id, dateStr);

  return all.filter((slot) => !blocked.has(slot.startTime));
};

/**
 * Attempt to place a 5-minute slot hold.
 * Returns the SlotHold document or throws an error.
 */
export const holdSlot = async (doctorId, dateStr, startTime, endTime, patientId) => {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  try {
    const hold = await SlotHold.create({
      doctorId,
      date: dateStr,
      startTime,
      endTime,
      patientId,
      expiresAt,
      status: 'HELD',
    });
    return hold;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error('SLOT_ALREADY_HELD');
    }
    throw error;
  }
};

/**
 * Release a slot hold (mark as CONFIRMED or EXPIRED).
 */
export const releaseHold = async (doctorId, dateStr, startTime, newStatus = 'CONFIRMED') => {
  await SlotHold.findOneAndUpdate(
    { doctorId, date: dateStr, startTime, status: 'HELD' },
    { status: newStatus }
  );
};

/**
 * Clean up expired holds (called by background job).
 * MongoDB TTL index handles document deletion, but we update status for audit.
 */
export const expireStaleHolds = async () => {
  const result = await SlotHold.updateMany(
    { status: 'HELD', expiresAt: { $lte: new Date() } },
    { status: 'EXPIRED' }
  );
  return result.modifiedCount;
};
