import mongoose from "mongoose";

const materialSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, default: "" },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      index: true,
    },
    description: { type: String, default: "" },
    media: [{ type: mongoose.Schema.Types.ObjectId, ref: "Media" }],
    linkPreview: {
      type: Object,
      default: null,
    },
  },
  { timestamps: true },
);

// Soft delete fields
materialSchema.add({
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
});

const Material = mongoose.model("Material", materialSchema);
export default Material;
