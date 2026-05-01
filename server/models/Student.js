import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rollNumber: {
      type: Number,
    },
    semester: {
      type: Number,
      default: 1,
    },
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
      },
    ],
  },
  { timestamps: true },
);

const Student = mongoose.model("Student", studentSchema);
export default Student;
