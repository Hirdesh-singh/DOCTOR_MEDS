import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  dosage:      { type: String, required: true },    // e.g. "500mg"
  frequency:   { type: String, required: true },    // e.g. "twice_daily", "once_daily"
  durationDays:{ type: Number, required: true },
  instructions:{ type: String, default: '' },       // e.g. "take with food"
}, { _id: false });

const prescriptionSchema = new mongoose.Schema(
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
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },

    // New: multiple medicines per prescription
    medicines: { type: [medicineSchema], default: [] },

    // Legacy single-medicine fields kept for backward compatibility
    medication: { type: String },
    dosage:     { type: String },
    frequency:  { type: String },

    startDate: { type: Date, default: Date.now },
    endDate:   { type: Date },

    reminderEnabled: { type: Boolean, default: true },
    // Calculated reminder times e.g. ['08:00', '20:00']
    reminderTimes:   [{ type: String }],

    followUpInstructions: { type: String, default: '' },
  },
  { timestamps: true }
);

const Prescription = mongoose.model('Prescription', prescriptionSchema);
export default Prescription;