import { google } from 'googleapis';
import CalendarEvent from '../models/CalendarEvent.js';

const isConfigured = () =>
  !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );

/**
 * Create an OAuth2 client.
 * Returns null if Google credentials are not configured.
 */
const getOAuth2Client = (accessToken = null, refreshToken = null) => {
  if (!isConfigured()) return null;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  if (accessToken) {
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  return oauth2Client;
};

/**
 * Get the Google OAuth authorization URL for a user to connect their calendar.
 */
export const getOAuthUrl = () => {
  const client = getOAuth2Client();
  if (!client) return null;

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    prompt: 'consent',
  });
};

/**
 * Exchange authorization code for tokens.
 */
export const exchangeCode = async (code) => {
  const client = getOAuth2Client();
  if (!client) return null;

  const { tokens } = await client.getToken(code);
  return tokens;
};

/**
 * Create a Google Calendar event for an appointment.
 * Stores the result in the CalendarEvent collection.
 * Gracefully handles all errors.
 */
export const createCalendarEvent = async (appointment, patient, doctor, accessToken, refreshToken) => {
  const record = await CalendarEvent.create({
    appointmentId: appointment._id,
    patientId: patient._id,
    doctorId: doctor._id,
    status: 'PENDING',
  });

  if (!isConfigured() || !accessToken) {
    await CalendarEvent.findByIdAndUpdate(record._id, {
      status: 'NOT_CONFIGURED',
      errorMessage: 'Google Calendar not configured',
    });
    return { googleEventId: '', status: 'NOT_CONFIGURED' };
  }

  try {
    const auth = getOAuth2Client(accessToken, refreshToken);
    const calendar = google.calendar({ version: 'v3', auth });

    const dateStr = appointment.date; // 'YYYY-MM-DD'
    const startDateTime = `${dateStr}T${appointment.startTime}:00`;
    const endDateTime   = `${dateStr}T${appointment.endTime}:00`;

    const event = {
      summary: `Medical Appointment — Dr. ${doctor.firstName} ${doctor.lastName}`,
      description: [
        `Patient: ${patient.firstName} ${patient.lastName}`,
        `Doctor: Dr. ${doctor.firstName} ${doctor.lastName} (${doctor.specialty})`,
        appointment.symptoms?.chiefSymptoms
          ? `Symptoms: ${appointment.symptoms.chiefSymptoms}`
          : '',
        '',
        'Appointment ID: ' + appointment._id,
        'Booked via Medicare Health Platform',
      ]
        .filter(Boolean)
        .join('\n'),
      start: { dateTime: startDateTime, timeZone: 'Asia/Kolkata' },
      end:   { dateTime: endDateTime,   timeZone: 'Asia/Kolkata' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    const googleEventId = response.data.id;

    await CalendarEvent.findByIdAndUpdate(record._id, {
      googleEventId,
      status: 'CREATED',
    });

    // Update appointment with the event id
    await appointment.updateOne({ calendarEventId: googleEventId, calendarSyncStatus: 'SYNCED' });

    console.log(`[Calendar] Event created: ${googleEventId}`);
    return { googleEventId, status: 'CREATED' };
  } catch (error) {
    console.error('[Calendar] Failed to create event:', error.message);
    await CalendarEvent.findByIdAndUpdate(record._id, {
      status: 'FAILED',
      errorMessage: error.message,
    });
    return { googleEventId: '', status: 'FAILED' };
  }
};

/**
 * Update a Google Calendar event.
 * Fails gracefully — does not throw.
 */
export const updateCalendarEvent = async (googleEventId, appointment, accessToken, refreshToken) => {
  if (!isConfigured() || !accessToken || !googleEventId) return false;

  try {
    const auth = getOAuth2Client(accessToken, refreshToken);
    const calendar = google.calendar({ version: 'v3', auth });

    const dateStr = appointment.date;
    await calendar.events.patch({
      calendarId: 'primary',
      eventId: googleEventId,
      resource: {
        start: { dateTime: `${dateStr}T${appointment.startTime}:00`, timeZone: 'Asia/Kolkata' },
        end:   { dateTime: `${dateStr}T${appointment.endTime}:00`,   timeZone: 'Asia/Kolkata' },
        summary: `Medical Appointment — Rescheduled`,
      },
    });

    await CalendarEvent.findOneAndUpdate(
      { googleEventId },
      { status: 'UPDATED' }
    );

    console.log(`[Calendar] Event updated: ${googleEventId}`);
    return true;
  } catch (error) {
    console.error('[Calendar] Failed to update event:', error.message);
    return false;
  }
};

/**
 * Delete a Google Calendar event.
 * Fails gracefully — does not throw.
 */
export const deleteCalendarEvent = async (googleEventId, accessToken, refreshToken) => {
  if (!isConfigured() || !accessToken || !googleEventId) return false;

  try {
    const auth = getOAuth2Client(accessToken, refreshToken);
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
    });

    await CalendarEvent.findOneAndUpdate(
      { googleEventId },
      { status: 'DELETED' }
    );

    console.log(`[Calendar] Event deleted: ${googleEventId}`);
    return true;
  } catch (error) {
    console.error('[Calendar] Failed to delete event:', error.message);
    return false;
  }
};
