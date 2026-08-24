import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const workingHourSlotSchema = new mongoose.Schema({
  start: { type: String, required: true }, // e.g. "09:00"
  end: { type: String, required: true },   // e.g. "13:00"
}, { _id: false });

const workingHourSchema = new mongoose.Schema({
  dayOfWeek: {
    type: Number,
    required: true,
    min: 0, // 0 = Sunday
    max: 6, // 6 = Saturday
  },
  slots: [workingHourSlotSchema],
  isWorking: { type: Boolean, default: true },
}, { _id: false });

const doctorSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true },
    specialty: { type: String, required: true, trim: true, index: true },
    licenseNumber: { type: String, required: true, unique: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    qualification: { type: String, default: 'MBBS', trim: true },
    experience: { type: Number, default: 0 },        // years
    consultationFee: { type: Number, default: 0 },   // in currency units
    profileImage: { type: String, default: '' },
    role: { type: String, default: 'doctor' },

    // Working hours per day of week
    workingHours: {
      type: [workingHourSchema],
      default: [
        // Mon–Fri 09:00–17:00, Sat 09:00–13:00
        { dayOfWeek: 1, slots: [{ start: '09:00', end: '17:00' }], isWorking: true },
        { dayOfWeek: 2, slots: [{ start: '09:00', end: '17:00' }], isWorking: true },
        { dayOfWeek: 3, slots: [{ start: '09:00', end: '17:00' }], isWorking: true },
        { dayOfWeek: 4, slots: [{ start: '09:00', end: '17:00' }], isWorking: true },
        { dayOfWeek: 5, slots: [{ start: '09:00', end: '17:00' }], isWorking: true },
        { dayOfWeek: 6, slots: [{ start: '09:00', end: '13:00' }], isWorking: true },
        { dayOfWeek: 0, slots: [], isWorking: false },
      ],
    },

    slotDurationMinutes: {
      type: Number,
      default: 30,
      enum: [15, 20, 30, 45, 60],
    },

    // Leave days stored as 'YYYY-MM-DD' strings for easy lookup
    leaveDays: [{ type: String }],

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

doctorSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

const Doctor = mongoose.model('Doctor', doctorSchema);
export default Doctor;