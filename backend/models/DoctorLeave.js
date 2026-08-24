import mongoose from 'mongoose';

const doctorLeaveSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: true,
    },
    reason: { type: String, default: '' },
  },
  { timestamps: true }
);

// Prevent duplicate leave entries for the same doctor on the same date
doctorLeaveSchema.index({ doctorId: 1, date: 1 }, { unique: true });

const DoctorLeave = mongoose.model('DoctorLeave', doctorLeaveSchema);
export default DoctorLeave;
