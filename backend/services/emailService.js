import nodemailer from 'nodemailer';
import Notification from '../models/Notification.js';

/**
 * Create Nodemailer transport.
 * Returns null if credentials are not configured.
 */
const createTransport = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true', // false for 587 (STARTTLS)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD, // Gmail App Password
    },
  });
};

/**
 * Send an email and record the result in the Notification collection.
 * NEVER throws — failure is stored for retry.
 *
 * @param {string} notificationId - Mongoose ObjectId of the Notification record
 * @param {string} toEmail
 * @param {string} subject
 * @param {string} htmlBody
 */
export const sendEmail = async (notificationId, toEmail, subject, htmlBody) => {
  const transport = createTransport();

  if (!transport) {
    console.warn('[Email] Not configured. Skipping send for notification:', notificationId);
    if (notificationId) {
      await Notification.findByIdAndUpdate(notificationId, {
        status: 'FAILED',
        errorMessage: 'Email service not configured',
        lastAttemptAt: new Date(),
      });
    }
    return false;
  }

  try {
    await transport.sendMail({
      from: `"Medicare Health Platform" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject,
      html: htmlBody,
    });

    if (notificationId) {
      await Notification.findByIdAndUpdate(notificationId, {
        status: 'SENT',
        sentAt: new Date(),
        lastAttemptAt: new Date(),
        errorMessage: '',
      });
    }

    console.log(`[Email] Sent to ${toEmail} — "${subject}"`);
    return true;
  } catch (error) {
    console.error('[Email] Send failed:', error.message);

    if (notificationId) {
      await Notification.findByIdAndUpdate(notificationId, {
        $inc: { retryCount: 1 },
        status: 'FAILED',
        errorMessage: error.message,
        lastAttemptAt: new Date(),
      });
    }
    return false;
  }
};

/**
 * Queue a notification record and attempt immediate send.
 */
const queueAndSend = async (userId, userModel, type, subject, message, toEmail, meta = {}) => {
  let notification;
  try {
    notification = await Notification.create({
      userId,
      userModel,
      type,
      subject,
      message,
      toEmail,
      status: 'PENDING',
      meta,
    });
  } catch (err) {
    console.error('[Email] Failed to create notification record:', err.message);
    return null;
  }

  await sendEmail(notification._id, toEmail, subject, message);
  return notification;
};

// ─── Email Templates ──────────────────────────────────────────────────────────

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px 40px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; }
    .header p { color: #bfdbfe; margin: 8px 0 0; font-size: 14px; }
    .body { padding: 32px 40px; }
    .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
    .detail-label { font-weight: 600; color: #64748b; min-width: 140px; font-size: 14px; }
    .detail-value { color: #1e293b; font-size: 14px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
    .badge-high { background: #fef2f2; color: #dc2626; }
    .badge-medium { background: #fffbeb; color: #d97706; }
    .badge-low { background: #f0fdf4; color: #16a34a; }
    .footer { background: #f8fafc; padding: 24px 40px; text-align: center; }
    .footer p { color: #94a3b8; font-size: 12px; margin: 0; }
    .disclaimer { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px 16px; margin-top: 20px; font-size: 12px; color: #92400e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏥 Medicare Health Platform</h1>
      <p>Your trusted healthcare partner</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>This is an automated notification. Please do not reply to this email.</p>
      <p style="margin-top:8px;">© ${new Date().getFullYear()} Medicare Health Platform</p>
    </div>
  </div>
</body>
</html>
`;

const formatDate = (dateStr) => {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
};

// ─── Public Email Functions ───────────────────────────────────────────────────

export const sendBookingConfirmation = async (patient, doctor, appointment) => {
  const patientName = `${patient.firstName} ${patient.lastName}`;
  const doctorName = `Dr. ${doctor.firstName} ${doctor.lastName}`;
  const dateStr = formatDate(appointment.date);

  // To patient
  await queueAndSend(
    patient._id, 'User', 'BOOKING_CONFIRMATION',
    `Appointment Confirmed — ${doctorName}`,
    baseTemplate(`
      <h2 style="color:#1e293b;margin:0 0 24px;">Appointment Confirmed ✓</h2>
      <p>Hi ${patientName}, your appointment has been booked successfully.</p>
      <div class="detail-row"><span class="detail-label">Doctor</span><span class="detail-value">${doctorName} · ${doctor.specialty}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${dateStr}</span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${appointment.startTime} – ${appointment.endTime}</span></div>
      <div class="detail-row"><span class="detail-label">Appointment ID</span><span class="detail-value">${appointment._id}</span></div>
      <div class="disclaimer">ℹ️ Please arrive 10 minutes early. Bring your insurance card and ID.</div>
    `),
    patient.email,
    { appointmentId: appointment._id }
  );

  // To doctor
  const symptomSummary = appointment.symptoms?.chiefSymptoms
    ? `<div class="detail-row"><span class="detail-label">Symptoms</span><span class="detail-value">${appointment.symptoms.chiefSymptoms}</span></div>`
    : '';

  await queueAndSend(
    doctor._id, 'Doctor', 'BOOKING_CONFIRMATION',
    `New Appointment — ${patientName}`,
    baseTemplate(`
      <h2 style="color:#1e293b;margin:0 0 24px;">New Appointment Scheduled</h2>
      <div class="detail-row"><span class="detail-label">Patient</span><span class="detail-value">${patientName}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${dateStr}</span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${appointment.startTime} – ${appointment.endTime}</span></div>
      ${symptomSummary}
    `),
    doctor.email,
    { appointmentId: appointment._id }
  );
};

export const sendAppointmentReminder = async (patient, doctor, appointment) => {
  const patientName = `${patient.firstName} ${patient.lastName}`;
  const doctorName = `Dr. ${doctor.firstName} ${doctor.lastName}`;
  const dateStr = formatDate(appointment.date);

  await queueAndSend(
    patient._id, 'User', 'APPOINTMENT_REMINDER',
    `Reminder: Appointment tomorrow with ${doctorName}`,
    baseTemplate(`
      <h2 style="color:#1e293b;margin:0 0 24px;">Appointment Reminder 🔔</h2>
      <p>Hi ${patientName}, this is a reminder about your upcoming appointment.</p>
      <div class="detail-row"><span class="detail-label">Doctor</span><span class="detail-value">${doctorName}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${dateStr}</span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${appointment.startTime}</span></div>
    `),
    patient.email,
    { appointmentId: appointment._id }
  );
};

export const sendCancellationEmail = async (patient, doctor, appointment, reason = '') => {
  const patientName = `${patient.firstName} ${patient.lastName}`;
  const doctorName = `Dr. ${doctor.firstName} ${doctor.lastName}`;
  const dateStr = formatDate(appointment.date);
  const reasonHtml = reason ? `<div class="detail-row"><span class="detail-label">Reason</span><span class="detail-value">${reason}</span></div>` : '';

  await queueAndSend(
    patient._id, 'User', 'CANCELLATION',
    `Appointment Cancelled — ${dateStr}`,
    baseTemplate(`
      <h2 style="color:#dc2626;margin:0 0 24px;">Appointment Cancelled</h2>
      <p>Hi ${patientName}, your appointment has been cancelled.</p>
      <div class="detail-row"><span class="detail-label">Doctor</span><span class="detail-value">${doctorName}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${dateStr}</span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${appointment.startTime}</span></div>
      ${reasonHtml}
      <p style="margin-top:20px;">You can book a new appointment through the Medicare platform.</p>
    `),
    patient.email,
    { appointmentId: appointment._id }
  );
};

export const sendDoctorLeaveNotification = async (patient, doctor, appointment) => {
  const patientName = `${patient.firstName} ${patient.lastName}`;
  const doctorName = `Dr. ${doctor.firstName} ${doctor.lastName}`;
  const dateStr = formatDate(appointment.date);

  await queueAndSend(
    patient._id, 'User', 'DOCTOR_LEAVE',
    `Important: Your appointment on ${dateStr} has been cancelled`,
    baseTemplate(`
      <h2 style="color:#d97706;margin:0 0 24px;">Appointment Affected by Doctor Leave</h2>
      <p>Hi ${patientName}, we regret to inform you that ${doctorName} will be unavailable on your scheduled appointment date.</p>
      <div class="detail-row"><span class="detail-label">Original Date</span><span class="detail-value">${dateStr}</span></div>
      <div class="detail-row"><span class="detail-label">Original Time</span><span class="detail-value">${appointment.startTime}</span></div>
      <p style="margin-top:20px;">Please log in to the Medicare platform to book a new appointment at your convenience. We apologize for the inconvenience.</p>
    `),
    patient.email,
    { appointmentId: appointment._id }
  );
};

export const sendMedicationReminder = async (patient, prescription, medicine) => {
  const patientName = `${patient.firstName} ${patient.lastName}`;

  await queueAndSend(
    patient._id, 'User', 'MEDICATION_REMINDER',
    `Medication Reminder: ${medicine.name}`,
    baseTemplate(`
      <h2 style="color:#1e293b;margin:0 0 24px;">💊 Medication Reminder</h2>
      <p>Hi ${patientName}, it's time to take your medication.</p>
      <div class="detail-row"><span class="detail-label">Medicine</span><span class="detail-value">${medicine.name}</span></div>
      <div class="detail-row"><span class="detail-label">Dosage</span><span class="detail-value">${medicine.dosage}</span></div>
      <div class="detail-row"><span class="detail-label">Instructions</span><span class="detail-value">${medicine.instructions || 'As prescribed'}</span></div>
      <div class="disclaimer">⚠️ Always follow your doctor's prescription. Do not change dosage without consulting your healthcare provider.</div>
    `),
    patient.email,
    { prescriptionId: prescription._id }
  );
};

export const sendPostVisitSummaryEmail = async (patient, doctor, appointment, aiSummary) => {
  const patientName = `${patient.firstName} ${patient.lastName}`;
  const doctorName = `Dr. ${doctor.firstName} ${doctor.lastName}`;

  const medicationHtml = aiSummary.medicationSchedule?.length
    ? aiSummary.medicationSchedule.map(m => `
        <div style="background:#f8fafc;border-radius:8px;padding:12px;margin:8px 0;">
          <strong>${m.medicine}</strong> — ${m.dosage}<br>
          <span style="color:#64748b;font-size:13px;">${m.frequency} · ${m.duration}</span>
          ${m.instructions ? `<br><span style="color:#64748b;font-size:12px;">${m.instructions}</span>` : ''}
        </div>
      `).join('')
    : '<p style="color:#64748b;">No medications prescribed.</p>';

  const followUpHtml = aiSummary.followUpSteps?.length
    ? `<ul>${aiSummary.followUpSteps.map(s => `<li>${s}</li>`).join('')}</ul>`
    : '';

  await queueAndSend(
    patient._id, 'User', 'POST_VISIT_SUMMARY',
    `Visit Summary — ${doctorName}`,
    baseTemplate(`
      <h2 style="color:#1e293b;margin:0 0 24px;">Your Visit Summary 📋</h2>
      <p>Hi ${patientName}, here is a summary of your recent visit.</p>
      
      <h3 style="color:#2563eb;margin:24px 0 12px;">About Your Visit</h3>
      <p>${aiSummary.summary || 'Please refer to your clinical notes.'}</p>
      
      <h3 style="color:#2563eb;margin:24px 0 12px;">Your Medications</h3>
      ${medicationHtml}
      
      ${followUpHtml ? `<h3 style="color:#2563eb;margin:24px 0 12px;">Follow-up Steps</h3>${followUpHtml}` : ''}
      
      <div class="disclaimer">⚠️ This summary is generated to help you understand your visit. It is not a substitute for professional medical advice. Always follow your doctor's instructions.</div>
    `),
    patient.email,
    { appointmentId: appointment._id }
  );
};

/**
 * Retry failed notifications (called by background job).
 * Retries up to maxRetries times.
 */
export const retryFailedNotifications = async () => {
  const failed = await Notification.find({
    status: 'FAILED',
    $expr: { $lt: ['$retryCount', '$maxRetries'] },
  }).limit(20);

  let retried = 0;
  for (const notif of failed) {
    await sendEmail(notif._id, notif.toEmail, notif.subject, notif.message);
    retried++;
  }

  return retried;
};
