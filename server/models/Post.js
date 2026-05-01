// server/models/Post.js
import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // ✅ Add to postSchema:
subjectTag: {
  type: String,
  default: "",
  maxlength: 100,
  trim: true,
},
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: false,
      index: true,
    },
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        type: { type: String, required: true }, // e.g., "❤️", "👍", "😂"
        _id: false,
      },
    ],

    isNotice: {
      type: Boolean,
      default: false, // true = admin/HOD announcement
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
    },

    isDownloadable: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

const Post = mongoose.model("Post", postSchema);
export default Post;
