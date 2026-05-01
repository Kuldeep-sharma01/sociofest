import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema(
  {
    // ✅ Add array length validation
participants: {
  type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  validate: {
    validator: (arr) => arr.length >= 2 && arr.length <= 500,
    message: 'A conversation must have between 2 and 500 participants',
  },
},
    isGroup: { type: Boolean, default: false },
    groupName: { type: String },
    groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    groupImage: { type: String },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isArchived: { type: Boolean, default: false },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
  },
  { timestamps: true },
);

const Conversation = mongoose.model("Conversation", ConversationSchema);
export default Conversation;
