import PushSubscription from "../models/PushSubscription.js";
import { badRequest, ok } from "../utils/index.js";

export const subscribeToPush = async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;

    if (!endpoint || typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
      return badRequest(res, "Invalid push subscription endpoint");
    }
    if (!keys?.p256dh || !keys?.auth || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
      return badRequest(res, "Invalid push subscription keys");
    }

    // ✅ Upsert by endpoint to avoid duplicate subscriptions per device
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { user: req.user._id, endpoint, keys },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    ok(res, {}, "Push subscription registered successfully");
  } catch (error) {
    next(error);
  }
};
