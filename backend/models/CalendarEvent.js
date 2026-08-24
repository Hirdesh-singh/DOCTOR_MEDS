import mongoose from 'mongoose';

const calendarEventSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      unique: true,
    },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    doctorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    googleEventId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'CREATED', 'UPDATED', 'DELETED', 'FAILED', 'NOT_CONFIGURED'],
      default: 'PENDING',
    },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);
export default CalendarEvent;
