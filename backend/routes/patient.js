import express from 'express';
import Patient from '../models/User.js';
import jwt from 'jsonwebtoken';
import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';
import Prescription from '../models/Prescription.js';
import Notification from '../models/Notification.js';

const router = express.Router();

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).send({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_change_me');
    next();
  } catch {
    res.status(401).send({ error: 'Invalid token' });
  }
};

router.get('/profile', auth, async (req, res) => {
  try {
    const patient = await Patient.findById(req.user.id).select('-password');
    if (!patient) return res.status(404).send({ error: 'Patient not found' });
    res.json(patient);
  } catch { res.status(500).send({ error: 'Server error' }); }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body;
    const patient = await Patient.findById(req.user.id);
    if (!patient) return res.status(404).send({ error: 'Patient not found' });
    Object.assign(patient, { firstName, lastName, email, phone });
    await patient.save();
    const p = patient.toObject(); delete p.password;
    res.json(p);
  } catch { res.status(500).send({ error: 'Server error' }); }
});

// ─── Book appointment (legacy route — kept for backward compat) ───────────────
router.post('/book-appointment', auth, async (req, res) => {
  try {
    const { doctorId, date, time, reason, symptoms } = req.body;
    const appointment = new Appointment({
      patientId: req.user.id,
      doctorId,
      date,
      startTime: time,
      endTime: time,
      time,
      reason,
      symptoms: symptoms || {},
    });
    await appointment.save();
    res.status(201).json({ message: 'Appointment booked successfully', appointment });
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({ error: 'This slot is already booked. Please choose another time.' });
    res.status(500).send({ error: 'Server error' });
  }
});

// ─── Available Slots (legacy — now delegates to slotService) ─────────────────
router.get('/available-slots', auth, async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    const { getAvailableSlots } = await import('../services/slotService.js');
    const slots = await getAvailableSlots(doctor, date);
    // Return in legacy format for backward compat
    res.json(slots.map((s) => `${s.startTime}–${s.endTime}`));
  } catch { res.status(500).send({ error: 'Server error' }); }
});

// ─── Patient's all appointments ───────────────────────────────────────────────
router.get('/appointments', auth, async (req, res) => {
  try {
    const { status, all } = req.query;
    const filter = { patientId: req.user.id };

    if (status) {
      filter.status = status;
    } else if (!all) {
      // Default: upcoming only
      const today = new Date().toISOString().split('T')[0];
      filter.date = { $gte: today };
    }

    const appointments = await Appointment.find(filter)
      .populate('doctorId', 'firstName lastName specialty')
      .sort({ date: 1, startTime: 1 });
    res.json(appointments);
  } catch { res.status(500).send({ error: 'Server error' }); }
});

// ─── Patient's care team ─────────────────────────────────────────────────────
router.get('/care-team', auth, async (req, res) => {
  try {
    const patientId = req.user.id;
    const doctorIds = await Appointment.find({ patientId }).distinct('doctorId');
    const careTeam = await Doctor.find({ _id: { $in: doctorIds } }).select(
      'firstName lastName specialty qualification experience'
    );
    res.json(careTeam);
  } catch { res.status(500).send({ error: 'Server error' }); }
});

// ─── Patient's prescriptions ──────────────────────────────────────────────────
router.get('/prescriptions', auth, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patientId: req.user.id })
      .populate('doctorId', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(prescriptions);
  } catch { res.status(500).send({ error: 'Server error' }); }
});

// ─── Patient's notifications ──────────────────────────────────────────────────
router.get('/notifications', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch { res.status(500).send({ error: 'Server error' }); }
});

export default router;