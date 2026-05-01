import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
      default: "",
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
    },
    description: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    assignedTeacher: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
  },
  { timestamps: true },
);

const Subject = mongoose.model("Subject", subjectSchema);
export default Subject;
