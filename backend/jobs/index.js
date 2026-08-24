import cron from 'node-cron';
import { expireStaleHolds } from '../services/slotService.js';
import { retryFailedNotifications } from '../services/emailService.js';
import { sendDueReminders } from '../services/reminderService.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import { sendAppointmentReminder } from '../services/emailService.js';

let jobsStarted = false;

export const startBackgroundJobs = () => {
  if (jobsStarted) return;
  jobsStarted = true;

  console.log('[Jobs] Starting background jobs...');

  // ── Every minute: expire stale slot holds ──────────────────────────────────
  cron.schedule('* * * * *', async () => {
    try {
      const expired = await expireStaleHolds();
      if (expired > 0) console.log(`[Jobs] Expired ${expired} stale slot hold(s).`);
    } catch (err) {
      console.error('[Jobs] Slot hold expiry error:', err.message);
    }
  });

  // ── Every 5 minutes: retry failed email notifications ─────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      const retried = await retryFailedNotifications();
      if (retried > 0) console.log(`[Jobs] Retried ${retried} failed notification(s).`);
    } catch (err) {
      console.error('[Jobs] Notification retry error:', err.message);
    }
  });

  // ── Every hour: send medication reminders ─────────────────────────────────
  cron.schedule('0 * * * *', async () => {
    try {
      const sent = await sendDueReminders();
      if (sent > 0) console.log(`[Jobs] Sent ${sent} medication reminder(s).`);
    } catch (err) {
      console.error('[Jobs] Medication reminder error:', err.message);
    }
  });

  // ── Every day at 8am: send appointment reminders for next-day appointments ─
  cron.schedule('0 8 * * *', async () => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const appointments = await Appointment.find({
        date: tomorrowStr,
        status: 'CONFIRMED',
      })
        .populate('patientId', 'firstName lastName email')
        .populate('doctorId', 'firstName lastName specialty');

      let sent = 0;
      for (const appt of appointments) {
        if (appt.patientId && appt.doctorId) {
          await sendAppointmentReminder(appt.patientId, appt.doctorId, appt).catch(() => {});
          sent++;
        }
      }

      if (sent > 0) console.log(`[Jobs] Sent ${sent} appointment reminder(s) for ${tomorrowStr}.`);
    } catch (err) {
      console.error('[Jobs] Appointment reminder error:', err.message);
    }
  });

  console.log('[Jobs] All background jobs scheduled.');
};
