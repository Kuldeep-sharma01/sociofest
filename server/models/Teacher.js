import mongoose from "mongoose";

const teacherSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    qualifications: {
      type: String,
      default: "",
    },
    experience: {
      type: Number,
      default: 0,
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

const Teacher = mongoose.model("Teacher", teacherSchema);
export default Teacher;
