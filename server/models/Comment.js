import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null, // null indicates a top-level comment
    },
    // ✅ Add length limit to prevent storage abuse
text: {
  type: String,
  required: [true, 'Comment cannot be empty'],
  maxlength: [5000, 'Comment cannot exceed 5000 characters'],
  trim: true,
},
    isEdited: {
      type: Boolean,
      default: false,
    },
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        type: { type: String, required: true },
        _id: false,
      },
    ],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const Comment = mongoose.model("Comment", commentSchema);
export default Comment;
