import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: false,
    },
    replyToMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    read: { type: Boolean, default: false },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isEdited: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Soft delete fields
messageSchema.add({
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
});

const Message = mongoose.model("Message", messageSchema);
export default Message;
