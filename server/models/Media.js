import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema(
  {
    hash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    path: {
      type: String,
      required: true,
      set: (v) => v ? v.replace(/\\/g, "/") : v,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: { type: Number, required: true },
    originalName: {
  type: String,
      // ✅ Strip all path-dangerous characters, null bytes, and limit length
      set: (v) => (v ?? '')
        .replace(/[<>"'&\/\\:*?|]/g, '')   // path separators + dangerous chars
        .replace(/\0/g, '')                 // null bytes
        .trim()
        .slice(0, 255) || 'unnamed',
},
    // NEW: Metadata lives natively on the media document now!
    uploader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    title: { type: String, default: "" },
    isPublic: { type: Boolean, default: true },

    description: { type: String, default: "" },
    isDownloadable: { type: Boolean, default: true },
    isExternal: { type: Boolean, default: false }, // True for YouTube/External links
    isPendingApproval: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const Media = mongoose.model("Media", MediaSchema);
export default Media;
