import mongoose from 'mongoose';

const symptomSchema = new mongoose.Schema({
  chiefSymptoms: { type: String, default: '' },
  duration:      { type: String, default: '' },
  severity:      { type: String, enum: ['mild', 'moderate', 'severe', ''], default: '' },
  additionalNotes: { type: String, default: '' },
}, { _id: false });

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD' for easy daily comparisons
      required: true,
    },
    startTime: { type: String, required: true }, // 'HH:MM' 24h
    endTime:   { type: String, required: true }, // 'HH:MM' 24h

    // Keep legacy `time` field for backward compatibility with old data
    time: { type: String },

    status: {
      type: String,
      enum: ['HELD', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED'],
      default: 'CONFIRMED',
    },

    reason: { type: String, default: '' }, // kept for backward compatibility
    symptoms: { type: symptomSchema, default: () => ({}) },

    // AI Pre-Visit
    aiPreVisitSummary:   { type: String, default: '' },
    aiUrgency:           { type: String, enum: ['Low', 'Medium', 'High', 'Unavailable', ''], default: '' },
    aiSuggestedQuestions: [{ type: String }],
    aiPreVisitStatus:    { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED', ''], default: '' },

    // Doctor Post-Visit
    clinicalNotes: { type: String, default: '' },
    prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },

    // AI Post-Visit
    aiPostVisitSummary: { type: String, default: '' },
    aiPostVisitStatus:  { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED', ''], default: '' },

    // Google Calendar
    calendarEventId:    { type: String, default: '' },
    calendarSyncStatus: { type: String, enum: ['PENDING', 'SYNCED', 'FAILED', 'NOT_CONFIGURED', ''], default: '' },

    // Slot hold expiry (used when status=HELD)
    holdExpiresAt: { type: Date },
  },
  { timestamps: true }
);

// ─── CRITICAL: Compound unique index to prevent double-booking ────────────────
// Only HELD and CONFIRMED appointments block a slot
appointmentSchema.index(
  { doctorId: 1, date: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['HELD', 'CONFIRMED'] } },
    name: 'unique_active_slot',
  }
);

const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;