import express from 'express';
import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';
import User from '../models/User.js';
import Prescription from '../models/Prescription.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getAvailableSlots, holdSlot, releaseHold } from '../services/slotService.js';
import { generatePreVisitSummary, generatePostVisitSummary } from '../services/aiService.js';
import { sendBookingConfirmation, sendCancellationEmail } from '../services/emailService.js';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '../services/calendarService.js';
import { scheduleMedicationReminders } from '../services/reminderService.js';

const router = express.Router();

// ─── GET Available Slots ──────────────────────────────────────────────────────
// GET /api/appointments/slots?doctorId=...&date=YYYY-MM-DD
router.get('/slots', async (req, res) => {
  const { doctorId, date } = req.query;

  if (!doctorId || !date) {
    return res.status(400).json({ success: false, message: 'doctorId and date are required.' });
  }

  // Validate date format and ensure it's not in the past
  const today = new Date().toISOString().split('T')[0];
  if (date < today) {
    return res.status(400).json({ success: false, message: 'Cannot book appointments in the past.' });
  }

  try {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !doctor.isActive) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    const slots = await getAvailableSlots(doctor, date);
    return res.json({ success: true, slots });
  } catch (error) {
    console.error('[Appointments] Get slots error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Hold a Slot ──────────────────────────────────────────────────────────────
// POST /api/appointments/hold
router.post('/hold', authenticate, requireRole('patient'), async (req, res) => {
  const { doctorId, date, startTime, endTime } = req.body;

  if (!doctorId || !date || !startTime || !endTime) {
    return res.status(400).json({ success: false, message: 'doctorId, date, startTime, endTime are required.' });
  }

  const today = new Date().toISOString().split('T')[0];
  if (date < today) {
    return res.status(400).json({ success: false, message: 'Cannot hold slots in the past.' });
  }

  try {
    const hold = await holdSlot(doctorId, date, startTime, endTime, req.user.id);
    return res.status(201).json({
      success: true,
      message: 'Slot held for 5 minutes. Please complete your booking.',
      holdId: hold._id,
      expiresAt: hold.expiresAt,
    });
  } catch (error) {
    if (error.message === 'SLOT_ALREADY_HELD') {
      return res.status(409).json({
        success: false,
        message: 'This slot was just taken by another patient. Please select a different slot.',
      });
    }
    console.error('[Appointments] Hold slot error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Book (Confirm) Appointment ───────────────────────────────────────────────
// POST /api/appointments
router.post('/', authenticate, requireRole('patient'), async (req, res) => {
  const { doctorId, date, startTime, endTime, symptoms } = req.body;

  if (!doctorId || !date || !startTime || !endTime) {
    return res.status(400).json({ success: false, message: 'doctorId, date, startTime, endTime are required.' });
  }

  const today = new Date().toISOString().split('T')[0];
  if (date < today) {
    return res.status(400).json({ success: false, message: 'Cannot book appointments in the past.' });
  }

  let appointment;
  try {
    // Attempt atomic appointment creation (protected by unique index)
    appointment = await Appointment.create({
      patientId: req.user.id,
      doctorId,
      date,
      startTime,
      endTime,
      time: startTime, // backward compat
      status: 'CONFIRMED',
      symptoms: symptoms || {},
      reason: symptoms?.chiefSymptoms || '',
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This appointment slot was just booked by another patient. Please select a different slot.',
      });
    }
    console.error('[Appointments] Create error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to create appointment.' });
  }

  // Release any slot hold for this slot
  await releaseHold(doctorId, date, startTime, 'CONFIRMED').catch(() => {});

  // ─ AI pre-visit summary (async, non-blocking for response) ─
  if (symptoms?.chiefSymptoms) {
    generatePreVisitSummary(symptoms)
      .then(async (aiResult) => {
        await Appointment.findByIdAndUpdate(appointment._id, {
          aiPreVisitSummary: aiResult.chiefComplaint,
          aiUrgency: aiResult.urgencyLevel,
          aiSuggestedQuestions: aiResult.suggestedQuestions,
          aiPreVisitStatus: aiResult.status,
        });
      })
      .catch((err) => console.error('[AI] Pre-visit update error:', err.message));
  }

  // ─ Fetch doctor and patient for notifications ─
  const [doctor, patient] = await Promise.all([
    Doctor.findById(doctorId),
    User.findById(req.user.id),
  ]);

  // ─ Email confirmation (async, non-blocking) ─
  if (doctor && patient) {
    sendBookingConfirmation(patient, doctor, appointment).catch((err) =>
      console.error('[Email] Booking confirmation error:', err.message)
    );
  }

  // ─ Calendar event (async, non-blocking) ─
  // Calendar requires user tokens stored separately — handled via /api/calendar
  // We store a placeholder here
  appointment.calendarSyncStatus = 'PENDING';
  await appointment.save().catch(() => {});

  return res.status(201).json({
    success: true,
    message: 'Appointment booked successfully.',
    appointment: {
      _id: appointment._id,
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
    },
  });
});

// ─── Get Patient's Appointments ───────────────────────────────────────────────
// GET /api/appointments  (patient sees own; doctor sees today's)
router.get('/', authenticate, async (req, res) => {
  try {
    let query = {};
    const { status, from, to } = req.query;

    if (req.user.role === 'patient') {
      query.patientId = req.user.id;
    } else if (req.user.role === 'doctor') {
      query.doctorId = req.user.id;
      // Default to today for doctor
      if (!from && !to) {
        query.date = new Date().toISOString().split('T')[0];
      }
    } else if (req.user.role === 'admin') {
      // Admin sees all
    }

    if (status) query.status = status;
    if (from) query.date = { ...query.date, $gte: from };
    if (to)   query.date = { ...query.date, $lte: to };

    const appointments = await Appointment.find(query)
      .populate('patientId', 'firstName lastName email')
      .populate('doctorId', 'firstName lastName specialty')
      .sort({ date: 1, startTime: 1 });

    return res.json({ success: true, appointments });
  } catch (error) {
    console.error('[Appointments] List error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Get Single Appointment ───────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'firstName lastName email phone')
      .populate('doctorId', 'firstName lastName specialty');

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    // Authorization: patient can see own, doctor can see theirs, admin sees all
    const isOwner =
      req.user.role === 'admin' ||
      appointment.patientId._id.toString() === req.user.id ||
      appointment.doctorId._id.toString() === req.user.id;

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.json({ success: true, appointment });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Cancel Appointment ───────────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const isOwner =
      req.user.role === 'admin' ||
      appointment.patientId.toString() === req.user.id ||
      appointment.doctorId.toString() === req.user.id;

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (['COMPLETED', 'CANCELLED'].includes(appointment.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed or already cancelled appointment.' });
    }

    const prevGoogleEventId = appointment.calendarEventId;
    appointment.status = 'CANCELLED';
    await appointment.save();

    // Fetch patient and doctor for notifications
    const [patient, doctor] = await Promise.all([
      User.findById(appointment.patientId),
      Doctor.findById(appointment.doctorId),
    ]);

    if (patient && doctor) {
      sendCancellationEmail(patient, doctor, appointment, req.body.reason || '').catch(() => {});
    }

    // Delete calendar event
    if (prevGoogleEventId) {
      deleteCalendarEvent(prevGoogleEventId, req.body.accessToken, req.body.refreshToken).catch(() => {});
    }

    return res.json({ success: true, message: 'Appointment cancelled successfully.' });
  } catch (error) {
    console.error('[Appointments] Cancel error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Reschedule Appointment ───────────────────────────────────────────────────
router.post('/:id/reschedule', authenticate, async (req, res) => {
  const { date, startTime, endTime } = req.body;

  if (!date || !startTime || !endTime) {
    return res.status(400).json({ success: false, message: 'date, startTime, endTime are required.' });
  }

  const today = new Date().toISOString().split('T')[0];
  if (date < today) {
    return res.status(400).json({ success: false, message: 'Cannot reschedule to a past date.' });
  }

  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    const isOwner =
      req.user.role === 'admin' ||
      appointment.patientId.toString() === req.user.id ||
      appointment.doctorId.toString() === req.user.id;

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (['COMPLETED', 'CANCELLED'].includes(appointment.status)) {
      return res.status(400).json({ success: false, message: 'Cannot reschedule a completed or cancelled appointment.' });
    }

    // Update the appointment — unique index will reject if new slot already booked
    try {
      appointment.date = date;
      appointment.startTime = startTime;
      appointment.endTime = endTime;
      appointment.time = startTime;
      await appointment.save();
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'The new slot is already booked. Please select a different time.',
        });
      }
      throw err;
    }

    // Update calendar event
    if (appointment.calendarEventId) {
      updateCalendarEvent(
        appointment.calendarEventId,
        appointment,
        req.body.accessToken,
        req.body.refreshToken
      ).catch(() => {});
    }

    return res.json({ success: true, message: 'Appointment rescheduled.', appointment });
  } catch (error) {
    console.error('[Appointments] Reschedule error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ─── Doctor: Submit Post-Visit Notes ─────────────────────────────────────────
router.post('/:id/notes', authenticate, requireRole('doctor'), async (req, res) => {
  const { clinicalNotes, prescription } = req.body;

  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found.' });
    }

    if (appointment.doctorId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    appointment.clinicalNotes = clinicalNotes || '';
    appointment.status = 'COMPLETED';

    // Save prescription if provided
    let savedPrescription = null;
    if (prescription && (prescription.medicines?.length > 0 || prescription.medication)) {
      const medicines = prescription.medicines || [];
      
      savedPrescription = await Prescription.create({
        patientId: appointment.patientId,
        doctorId: req.user.id,
        appointmentId: appointment._id,
        medicines,
        medication: prescription.medication,
        dosage: prescription.dosage,
        frequency: prescription.frequency,
        startDate: new Date(),
        reminderEnabled: true,
      });

      appointment.prescriptionId = savedPrescription._id;

      // Schedule medication reminders (async)
      scheduleMedicationReminders(savedPrescription._id).catch(() => {});
    }

    await appointment.save();

    // Generate AI post-visit summary (async, non-blocking for response)
    const medicines = savedPrescription?.medicines || [];

    generatePostVisitSummary(clinicalNotes, medicines)
      .then(async (aiResult) => {
        await Appointment.findByIdAndUpdate(appointment._id, {
          aiPostVisitSummary: JSON.stringify(aiResult),
          aiPostVisitStatus: aiResult.status,
        });

        // Email post-visit summary to patient
        const [patient, doctor] = await Promise.all([
          User.findById(appointment.patientId),
          Doctor.findById(req.user.id),
        ]);

        if (patient && doctor) {
          const { sendPostVisitSummaryEmail } = await import('../services/emailService.js');
          sendPostVisitSummaryEmail(patient, doctor, appointment, aiResult).catch(() => {});
        }
      })
      .catch((err) => console.error('[AI] Post-visit error:', err.message));

    return res.json({
      success: true,
      message: 'Visit notes saved. AI summary being generated.',
      appointment: { _id: appointment._id, status: appointment.status },
      prescriptionId: savedPrescription?._id,
    });
  } catch (error) {
    console.error('[Appointments] Notes error:', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

export default router;
