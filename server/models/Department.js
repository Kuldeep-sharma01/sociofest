import mongoose from "mongoose";

const DepartmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
    },
    totalSemesters: {
      type: Number,
      default: 8,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    hod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    subjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
      },
    ],
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
    },
    allowedRadius: {
      type: Number,
      default: 500 // 500 meters default
    }
  },
  { timestamps: true },
);

const Department = mongoose.model("Department", DepartmentSchema);
export default Department;
