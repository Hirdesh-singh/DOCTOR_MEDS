import express from 'express';
import Doctor from '../models/Doctor.js';
import Appointment from '../models/Appointment.js';
import Prescription from '../models/Prescription.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// ─── Legacy inline auth for backward compat ───────────────────────────────────
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

// ─── GET /api/doctor/all — Public: list all active doctors ───────────────────
router.get('/all', async (req, res) => {
  try {
    const { specialty, search } = req.query;
    const filter = { isActive: { $ne: false } };

    if (specialty) filter.specialty = { $regex: specialty, $options: 'i' };
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName:  { $regex: search, $options: 'i' } },
        { specialty: { $regex: search, $options: 'i' } },
      ];
    }

    const doctors = await Doctor.find(filter).select(
      'firstName lastName specialty qualification experience consultationFee phoneNumber workingHours slotDurationMinutes leaveDays'
    );
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/doctor/:id — Public: single doctor ─────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id).select('-password');
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doctor);
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/doctor/profile — Doctor's own profile ──────────────────────────
router.get('/profile', auth, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user.id).select('-password');
    if (!doctor) return res.status(404).send({ error: 'Doctor not found' });
    res.json(doctor);
  } catch (error) {
    res.status(500).send({ error: 'Server error' });
  }
});

// ─── PUT /api/doctor/profile ──────────────────────────────────────────────────
router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, email, specialty, licenseNumber, phoneNumber, qualification, experience, consultationFee } = req.body;
    const doctor = await Doctor.findById(req.user.id);
    if (!doctor) return res.status(404).send({ error: 'Doctor not found' });

    Object.assign(doctor, { firstName, lastName, email, specialty, licenseNumber, phoneNumber, qualification, experience, consultationFee });
    await doctor.save();

    const d = doctor.toObject();
    delete d.password;
    res.json(d);
  } catch (error) {
    res.status(500).send({ error: 'Server error' });
  }
});

// ─── GET /api/doctor/patients-with-appointments ───────────────────────────────
router.get('/patients-with-appointments', auth, async (req, res) => {
  try {
    const doctorId = req.user.id;
    const appointments = await Appointment.find({ doctorId }).sort({ date: 1 });
    const patientIds = [...new Set(appointments.map((a) => a.patientId.toString()))];
    const patients = await User.find({ _id: { $in: patientIds }, role: 'patient' });

    const result = patients.map((patient) => {
      const patientApps = appointments.filter((a) => a.patientId.toString() === patient._id.toString());
      const today = new Date().toISOString().split('T')[0];
      const lastVisit = patientApps.filter((a) => a.date < today).pop();
      const nextAppt  = patientApps.find((a) => a.date >= today && ['CONFIRMED', 'HELD'].includes(a.status));
      return { ...patient.toObject(), lastVisit: lastVisit?.date || null, nextAppointment: nextAppt?.date || null };
    });

    res.json(result);
  } catch {
    res.status(500).send({ error: 'Server error' });
  }
});

// ─── GET /api/doctor/available-slots (legacy endpoint) ───────────────────────
router.get('/available-slots', auth, async (req, res) => {
  try {
    const { date } = req.query;
    const doctorId = req.user.id;
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    const { getAvailableSlots } = await import('../services/slotService.js');
    const slots = await getAvailableSlots(doctor, date || new Date().toISOString().split('T')[0]);
    res.json(slots.map((s) => `${s.startTime}–${s.endTime}`));
  } catch {
    res.status(500).send({ error: 'Server error' });
  }
});

// ─── POST /api/doctor/schedule-appointment ────────────────────────────────────
router.post('/schedule-appointment', auth, async (req, res) => {
  try {
    const { patientId, date, time, reason } = req.body;
    const appointment = new Appointment({
      patientId,
      doctorId: req.user.id,
      date,
      startTime: time,
      endTime: time,
      time,
      reason,
    });
    await appointment.save();
    res.status(201).json({ message: 'Appointment scheduled successfully', appointment });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'This slot is already booked.' });
    }
    res.status(500).send({ error: 'Server error' });
  }
});

// ─── Prescriptions (doctor-facing) ───────────────────────────────────────────
router.post('/prescribe-medication', auth, async (req, res) => {
  try {
    const { patientId, medication, dosage, frequency, medicines, appointmentId } = req.body;
    const prescription = new Prescription({
      patientId,
      doctorId: req.user.id,
      appointmentId,
      medication,
      dosage,
      frequency,
      medicines: medicines || [],
    });
    const saved = await prescription.save();
    res.status(201).json({ message: 'Medication prescribed successfully', prescription: saved });
  } catch (error) {
    res.status(500).send({ error: 'Server error' });
  }
});

router.get('/prescriptions', auth, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ doctorId: req.user.id })
      .populate('patientId', 'firstName lastName');
    res.json(prescriptions);
  } catch {
    res.status(500).send({ error: 'Server error' });
  }
});

router.put('/prescriptions/:id', auth, async (req, res) => {
  try {
    const { medication, dosage, frequency, medicines } = req.body;
    const prescription = await Prescription.findOneAndUpdate(
      { _id: req.params.id, doctorId: req.user.id },
      { medication, dosage, frequency, medicines },
      { new: true }
    );
    if (!prescription) return res.status(404).send({ error: 'Prescription not found' });
    res.json(prescription);
  } catch {
    res.status(500).send({ error: 'Server error' });
  }
});

router.delete('/prescriptions/:id', auth, async (req, res) => {
  try {
    const prescription = await Prescription.findOneAndDelete({ _id: req.params.id, doctorId: req.user.id });
    if (!prescription) return res.status(404).send({ error: 'Prescription not found' });
    res.json({ message: 'Prescription deleted successfully' });
  } catch (error) {
    res.status(500).send({ error: 'Server error', details: error.message });
  }
});

router.get('/prescriptions/:patientId', auth, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ doctorId: req.user.id, patientId: req.params.patientId });
    res.json(prescriptions);
  } catch {
    res.status(500).send({ error: 'Server error' });
  }
});

// ─── GET /api/doctor/appointments — Doctor's today's schedule ─────────────────
router.get('/appointments', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const appointments = await Appointment.find({
      doctorId: req.user.id,
      date: today,
      status: { $in: ['CONFIRMED', 'HELD', 'COMPLETED'] },
    })
      .populate('patientId', 'firstName lastName email')
      .sort({ startTime: 1 });
    res.json(appointments);
  } catch {
    res.status(500).send({ error: 'Server error' });
  }
});

export default router;