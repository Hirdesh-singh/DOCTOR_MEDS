import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId:     { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userModel:  { type: String, enum: ['User', 'Doctor', 'Admin'], default: 'User' },
    type: {
      type: String,
      enum: [
        'BOOKING_CONFIRMATION',
        'APPOINTMENT_REMINDER',
        'CANCELLATION',
        'DOCTOR_LEAVE',
        'MEDICATION_REMINDER',
        'POST_VISIT_SUMMARY',
      ],
      required: true,
    },
    subject:  { type: String, required: true },
    message:  { type: String, required: true },
    toEmail:  { type: String },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    retryCount:   { type: Number, default: 0 },
    maxRetries:   { type: Number, default: 3 },
    sentAt:       { type: Date },
    lastAttemptAt:{ type: Date },
    errorMessage: { type: String, default: '' },
    // Metadata for the notification (e.g. appointment details)
    meta:         { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
