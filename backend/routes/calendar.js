import express from 'express';
import jwt from 'jsonwebtoken';
import { getOAuthUrl, exchangeCode, createCalendarEvent } from '../services/calendarService.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import Doctor from '../models/Doctor.js';

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

/**
 * GET /api/calendar/connect
 * Redirects the user to Google OAuth consent screen.
 */
router.get('/connect', auth, (req, res) => {
  const url = getOAuthUrl();
  if (!url) {
    return res.status(503).json({
      success: false,
      message: 'Google Calendar is not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.',
    });
  }
  res.redirect(url);
});

/**
 * GET /api/calendar/callback
 * Handles the OAuth callback from Google.
 * Stores tokens in the session or returns them to be stored by the frontend.
 */
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?calendarError=${error}`);
  }

  if (!code) {
    return res.status(400).json({ success: false, message: 'Authorization code missing.' });
  }

  try {
    const tokens = await exchangeCode(code);
    // Return tokens to frontend via redirect with tokens in query params
    // In production, store tokens server-side (encrypted in DB)
    const params = new URLSearchParams({
      calendarConnected: 'true',
      accessToken: tokens.access_token || '',
      refreshToken: tokens.refresh_token || '',
    });
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?${params.toString()}`);
  } catch (err) {
    console.error('[Calendar] OAuth callback error:', err.message);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?calendarError=oauth_failed`);
  }
});

/**
 * POST /api/calendar/events
 * Manually creates a calendar event for an appointment.
 * Body: { appointmentId, accessToken, refreshToken }
 */
router.post('/events', auth, async (req, res) => {
  const { appointmentId, accessToken, refreshToken } = req.body;

  if (!appointmentId || !accessToken) {
    return res.status(400).json({ success: false, message: 'appointmentId and accessToken are required.' });
  }

  try {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });

    const patient = await User.findById(appointment.patientId);
    const doctor  = await Doctor.findById(appointment.doctorId);

    const result = await createCalendarEvent(appointment, patient, doctor, accessToken, refreshToken);

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
