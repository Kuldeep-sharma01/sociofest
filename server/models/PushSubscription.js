import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
  },
  { timestamps: true },
);

// ✅ Add TTL to auto-expire subscriptions that haven't been renewed
pushSubscriptionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90 days

export default mongoose.model("PushSubscription", pushSubscriptionSchema);
