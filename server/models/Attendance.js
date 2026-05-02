import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    curriculum: { type: mongoose.Schema.Types.ObjectId, ref: "Curriculum", required: true },

    date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["present", "absent", "late", "excused"],
      default: "absent",
    },
    recognitionMethod: {
      type: String,
      enum: ["facial_recognition", "manual", "qr_code"],
      default: "manual",
    },
    recognitionConfidence: {
      type: Number,
      min: 0,
      max: 1,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    wifiVerified: {
      type: Boolean,
      default: false,
    },
    bluetoothVerified: {
      type: Boolean,
      default: false,
    },
    ipAddress: {
      type: String,
    },
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true },
);
attendanceSchema.pre('save', function(next) {
  if (this.status) this.status = this.status.toLowerCase();
  next();
});
// Index for efficient queries
// ✅ Add to attendanceSchema:
attendanceSchema.index(
  { student: 1, curriculum: 1, date: 1 },
  { unique: true, name: 'unique_attendance_per_day' }
);
attendanceSchema.index({ student: 1, date: 1 });
attendanceSchema.index({ curriculum: 1, date: 1 });

export default mongoose.model("Attendance", attendanceSchema);
