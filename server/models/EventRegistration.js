import mongoose from "mongoose";
import { VALID_ROLES } from "../utils/rbac.js";

const eventRegistrationSchema = new mongoose.Schema(
  {
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: VALID_ROLES,
      default: "Student",
    },
  },
  { timestamps: { createdAt: "registeredAt", updatedAt: "updatedAt" } },
);

// Ensure a user can only register once for an event
eventRegistrationSchema.index({ event: 1, user: 1 }, { unique: true });

const EventRegistration = mongoose.model(
  "EventRegistration",
  eventRegistrationSchema,
);
export default EventRegistration;
