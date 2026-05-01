import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    maintenanceMode: { type: Boolean, default: false },
    emailSettings: { type: Object, default: {} },
  },
  { timestamps: true },
);

const Settings = mongoose.model("Settings", settingsSchema);
export default Settings;
