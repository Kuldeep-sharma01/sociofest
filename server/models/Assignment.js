import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
title: { type: String, required: true, trim: true, maxlength: 200 },
    dueDate: { type: Date, required: true, index: true },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: false,
      index: true,
    },
  },
  { timestamps: true },
);

assignmentSchema.index({ subject: 1, author: 1 });

const Assignment = mongoose.model("Assignment", assignmentSchema);
export default Assignment;
