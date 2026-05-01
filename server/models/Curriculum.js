import mongoose from "mongoose";

const curriculumSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    class: {
      type: String,
      required: true,
    },
    semester: {
      type: String,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    totalClasses: {
      type: Number,
      default: 0,
    },
    completedClasses: {
      type: Number,
      default: 0,
    },
    topics: [
      {
        title: String,
        description: String,
        status: {
          type: String,
          enum: ["pending", "in-progress", "completed"],
          default: "pending",
        },
        completionDate: Date,
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Curriculum", curriculumSchema);
