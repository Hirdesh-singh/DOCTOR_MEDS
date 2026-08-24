import Prescription from '../models/Prescription.js';
import User from '../models/User.js';
import { sendMedicationReminder } from './emailService.js';

/**
 * Map frequency string to reminder times.
 */
const getTimesForFrequency = (frequency) => {
  const freq = frequency?.toLowerCase() || '';

  if (freq.includes('once') || freq.includes('once_daily') || freq.includes('od')) {
    return ['08:00'];
  }
  if (freq.includes('twice') || freq.includes('twice_daily') || freq.includes('bd') || freq.includes('bid')) {
    return ['08:00', '20:00'];
  }
  if (freq.includes('three') || freq.includes('thrice') || freq.includes('tid') || freq.includes('three_daily')) {
    return ['08:00', '14:00', '20:00'];
  }
  if (freq.includes('four') || freq.includes('qid')) {
    return ['07:00', '12:00', '17:00', '21:00'];
  }
  // Default to once in morning
  return ['08:00'];
};

/**
 * Calculate reminder times for all medicines in a prescription
 * and save them back to the prescription record.
 */
export const scheduleMedicationReminders = async (prescriptionId) => {
  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) return;

  // Gather all unique reminder times across all medicines
  const allTimes = new Set();
  for (const med of prescription.medicines || []) {
    const times = getTimesForFrequency(med.frequency);
    times.forEach((t) => allTimes.add(t));
  }

  // Also handle legacy single-medicine prescriptions
  if (prescription.frequency && prescription.medicines?.length === 0) {
    getTimesForFrequency(prescription.frequency).forEach((t) => allTimes.add(t));
  }

  prescription.reminderTimes = [...allTimes].sort();
  prescription.reminderEnabled = true;
  await prescription.save();
};

/**
 * Send due medication reminders.
 * Called every hour by background job.
 * Sends to patients whose reminder time matches the current hour.
 */
export const sendDueReminders = async () => {
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // Match current hour (e.g. "08:00" matches any minute from 08:00 to 08:59)
  const currentHour = `${now.getHours().toString().padStart(2, '0')}:00`;

  const today = now.toISOString().split('T')[0]; // 'YYYY-MM-DD'

  // Find prescriptions that are active and have reminders enabled
  const prescriptions = await Prescription.find({
    reminderEnabled: true,
    reminderTimes: { $in: [currentHour] },
    startDate: { $lte: now },
    $or: [{ endDate: null }, { endDate: { $gte: now } }],
  });

  let sent = 0;
  for (const prescription of prescriptions) {
    try {
      const patient = await User.findById(prescription.patientId);
      if (!patient) continue;

      // Determine which medicines to remind about at this hour
      for (const medicine of prescription.medicines || []) {
        const medicineTimes = getTimesForFrequency(medicine.frequency);
        if (medicineTimes.includes(currentHour)) {
          await sendMedicationReminder(patient, prescription, medicine);
          sent++;
        }
      }

      // Legacy single-medicine
      if (prescription.medication && (!prescription.medicines || prescription.medicines.length === 0)) {
        await sendMedicationReminder(patient, prescription, {
          name: prescription.medication,
          dosage: prescription.dosage,
          frequency: prescription.frequency,
          instructions: '',
        });
        sent++;
      }
    } catch (err) {
      console.error('[Reminder] Error sending reminder:', err.message);
    }
  }

  return sent;
};
