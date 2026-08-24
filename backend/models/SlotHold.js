import mongoose from 'mongoose';

const slotHoldSchema = new mongoose.Schema(
  {
    doctorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    date:      { type: String, required: true }, // 'YYYY-MM-DD'
    startTime: { type: String, required: true }, // 'HH:MM'
    endTime:   { type: String, required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },   // 5 minutes from creation
    status:    { type: String, enum: ['HELD', 'CONFIRMED', 'EXPIRED'], default: 'HELD' },
  },
  { timestamps: true }
);

// TTL index: MongoDB will automatically remove expired hold documents
slotHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Prevent two patients from holding the same slot simultaneously
slotHoldSchema.index(
  { doctorId: 1, date: 1, startTime: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'HELD' },
    name: 'unique_active_hold',
  }
);

const SlotHold = mongoose.model('SlotHold', slotHoldSchema);
export default SlotHold;
