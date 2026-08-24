import express from 'express';
import Doctor from '../models/Doctor.js';
import Admin from '../models/Admin.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import DoctorLeave from '../models/DoctorLeave.js';
import Notification from '../models/Notification.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { sendDoctorLeaveNotification } from '../services/emailService.js';

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

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).send({ error: 'Not authorized' });
  next();
};

// ─── Existing Admin Endpoints (JWT secret fixed) ──────────────────────────────

router.post('/add-doctor', auth, adminOnly, async (req, res) => {
  const { firstName, lastName, email, specialty, licenseNumber, phoneNumber, password,
          qualification, experience, consultationFee } = req.body;
  try {
    const doctor = new Doctor({ firstName, lastName, email, specialty, licenseNumber, phoneNumber, password,
      qualification: qualification || 'MBBS', experience: experience || 0, consultationFee: consultationFee || 0 });
    await doctor.save();
    res.status(201).send({ message: 'Doctor added successfully' });
  } catch (error) {
    if (error.code === 11000) return res.status(400).send({ error: 'Email or license number already exists' });
    res.status(400).send({ error: error.message });
  }
});

router.post('/add-admin', auth, adminOnly, async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  try {
    const admin = new Admin({ firstName, lastName, email, password });
    await admin.save();
    res.status(201).send({ message: 'Admin added successfully' });
  } catch (error) {
    if (error.code === 11000) return res.status(400).send({ error: 'Email already exists' });
    res.status(400).send({ error: error.message });
  }
});

router.get('/profile', auth, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-password');
    if (!admin) return res.status(404).send({ error: 'Admin not found' });
    res.json(admin);
  } catch { res.status(500).send({ error: 'Server error' }); }
});

router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body;
    const admin = await Admin.findById(req.user.id);
    if (!admin) return res.status(404).send({ error: 'Admin not found' });

    // Check if new email is already taken by another admin
    if (email && email !== admin.email) {
      const existing = await Admin.findOne({ email, _id: { $ne: admin._id } });
      if (existing) return res.status(400).json({ error: 'Email already in use by another account.' });
    }

    if (firstName !== undefined) admin.firstName = firstName;
    if (lastName  !== undefined) admin.lastName  = lastName;
    if (email     !== undefined) admin.email     = email;
    if (phone     !== undefined) admin.phone     = phone;

    await admin.save();
    const a = admin.toObject(); delete a.password;
    res.json({ message: 'Profile updated successfully', admin: a });
  } catch (err) {
    res.status(500).send({ error: 'Server error' });
  }
});

router.get('/total-doctors', auth, async (req, res) => {
  try { res.json({ totalDoctors: await Doctor.countDocuments() }); }
  catch { res.status(500).send({ error: 'Server error' }); }
});

router.get('/total-patients', auth, async (req, res) => {
  try { res.json({ totalPatients: await User.countDocuments({ role: 'patient' }) }); }
  catch { res.status(500).send({ error: 'Server error' }); }
});

router.get('/doctor-overview', auth, async (req, res) => {
  try {
    const doctors = await Doctor.find().select('firstName lastName specialty');
    const overview = await Promise.all(doctors.map(async (doctor) => {
      const patients = await Appointment.distinct('patientId', { doctorId: doctor._id });
      return { name: `${doctor.firstName} ${doctor.lastName}`, specialty: doctor.specialty, patients: patients.length };
    }));
    res.json(overview);
  } catch { res.status(500).send({ error: 'Server error' }); }
});

router.get('/patient-overview', auth, async (req, res) => {
  try {
    const patients = await User.find({ role: 'patient' }).select('firstName lastName');
    const overview = await Promise.all(patients.map(async (patient) => ({
      name: `${patient.firstName} ${patient.lastName}`,
      appointments: await Appointment.countDocuments({ patientId: patient._id }),
    })));
    res.json(overview);
  } catch { res.status(500).send({ error: 'Server error' }); }
});

// ─── NEW: Doctor Configuration ────────────────────────────────────────────────

// PUT /api/admin/doctors/:id/working-hours
router.put('/doctors/:id/working-hours', auth, adminOnly, async (req, res) => {
  try {
    const { workingHours } = req.body;
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      { workingHours },
      { new: true, select: '-password' }
    );
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json({ message: 'Working hours updated', doctor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/admin/doctors/:id/slot-duration
router.put('/doctors/:id/slot-duration', auth, adminOnly, async (req, res) => {
  try {
    const { slotDurationMinutes } = req.body;
    if (![15, 20, 30, 45, 60].includes(Number(slotDurationMinutes))) {
      return res.status(400).json({ error: 'Invalid slot duration. Choose 15, 20, 30, 45, or 60 minutes.' });
    }
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      { slotDurationMinutes: Number(slotDurationMinutes) },
      { new: true, select: '-password' }
    );
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json({ message: 'Slot duration updated', doctor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── NEW: Doctor Leave Management ────────────────────────────────────────────

// GET /api/admin/doctors/:id/leave
router.get('/doctors/:id/leave', auth, adminOnly, async (req, res) => {
  try {
    const leaves = await DoctorLeave.find({ doctorId: req.params.id }).sort({ date: 1 });
    res.json(leaves);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/doctors/:id/leave
// Adds a leave date and handles existing appointments
router.post('/doctors/:id/leave', auth, adminOnly, async (req, res) => {
  const { date, reason = '' } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });

  try {
    // Create leave record (unique index prevents duplicates)
    try {
      await DoctorLeave.create({ doctorId: req.params.id, date, reason });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'Leave already exists for this date.' });
      throw err;
    }

    // Also push to doctor's leaveDays array
    await Doctor.findByIdAndUpdate(req.params.id, { $addToSet: { leaveDays: date } });

    // Find affected confirmed appointments
    const affectedAppointments = await Appointment.find({
      doctorId: req.params.id,
      date,
      status: { $in: ['CONFIRMED', 'HELD'] },
    });

    // Cancel affected appointments and notify patients
    let notifiedCount = 0;
    for (const appt of affectedAppointments) {
      appt.status = 'CANCELLED';
      await appt.save();

      const patient = await User.findById(appt.patientId);
      const doctor  = await Doctor.findById(req.params.id);

      if (patient && doctor) {
        await sendDoctorLeaveNotification(patient, doctor, appt).catch(() => {});
        notifiedCount++;
      }
    }

    res.status(201).json({
      message: `Leave added. ${affectedAppointments.length} appointment(s) cancelled. ${notifiedCount} patient(s) notified.`,
      affectedCount: affectedAppointments.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/admin/doctors/:id/leave/:date
router.delete('/doctors/:id/leave/:date', auth, adminOnly, async (req, res) => {
  try {
    await DoctorLeave.findOneAndDelete({ doctorId: req.params.id, date: req.params.date });
    await Doctor.findByIdAndUpdate(req.params.id, { $pull: { leaveDays: req.params.date } });
    res.json({ message: 'Leave removed. Slots are now available again.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── NEW: All Appointments View ───────────────────────────────────────────────

// GET /api/admin/appointments
router.get('/appointments', auth, adminOnly, async (req, res) => {
  try {
    const { status, date, doctorId, patientId } = req.query;
    const filter = {};
    if (status)   filter.status   = status;
    if (date)     filter.date     = date;
    if (doctorId) filter.doctorId = doctorId;
    if (patientId) filter.patientId = patientId;

    const appointments = await Appointment.find(filter)
      .populate('patientId', 'firstName lastName email')
      .populate('doctorId', 'firstName lastName specialty')
      .sort({ date: -1, startTime: 1 })
      .limit(200);

    res.json(appointments);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ─── NEW: Failed Notifications View ──────────────────────────────────────────

// GET /api/admin/notifications/failed
router.get('/notifications/failed', auth, adminOnly, async (req, res) => {
  try {
    const failed = await Notification.find({ status: 'FAILED' })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(failed);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ─── NEW: List and Update Doctors ────────────────────────────────────────────

// GET /api/admin/doctors
router.get('/doctors', auth, adminOnly, async (req, res) => {
  try {
    const doctors = await Doctor.find().select('-password').sort({ firstName: 1 });
    res.json(doctors);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/admin/doctors/:id
router.put('/doctors/:id', auth, adminOnly, async (req, res) => {
  try {
    const { password, ...updateData } = req.body;
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id, updateData, { new: true, select: '-password' }
    );
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json({ message: 'Doctor updated', doctor });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/admin/doctors/:id (soft delete)
router.delete('/doctors/:id', auth, adminOnly, async (req, res) => {
  try {
    await Doctor.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Doctor deactivated' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;