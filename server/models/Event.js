import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
    },
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: false,
      index: true,
    },
    start: {
      type: Date,
      required: [true, "Event start time is required"],
    },
    end: {
      type: Date,
      required: [true, "Event end time is required"],
    },
    location: {
      type: String,
      default: "Campus",
    },
    category: {
      type: String,
      enum: [
        "Seminar",
        "Workshop",
        "Competition",
        "Festival",
        "Personal",
        "Study Plan",
        "Other",
        "Notification",
      ],
      default: "Other",
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const Event = mongoose.model("Event", eventSchema);

export default Event;
