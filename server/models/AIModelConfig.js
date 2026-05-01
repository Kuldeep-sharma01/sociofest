import mongoose from "mongoose";

const fallbackNodeSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, trim: true, lowercase: true },
    model: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    timeoutMs: { type: Number, default: 20000, min: 1000, max: 120000 },
  },
  { _id: false },
);

const aiModelConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    routes: {
      chat: { type: [fallbackNodeSchema], default: [] },
      media: { type: [fallbackNodeSchema], default: [] },
    },
  },
  { timestamps: true },
);

const AIModelConfig = mongoose.model("AIModelConfig", aiModelConfigSchema);

export default AIModelConfig;
