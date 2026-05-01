import mongoose from "mongoose";

const hodSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    semesters: {
      type: Number,
      default: 8,
    },
    tenure: {
      type: Number,
      default: 0,
    },
    achievements: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

const HOD = mongoose.models.HOD || mongoose.model("HOD", hodSchema);
export default HOD;
