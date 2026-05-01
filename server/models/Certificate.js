import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const certificateSchema = new mongoose.Schema(
  {
    // 📜 Basic Info
    title: {
      type: String,
      required: [true, "Certificate title is required"],
      trim: true,
    },
    // 📄 Downloadable PDF URL
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: false,
    },

    // 👨‍🎓 Recipient Details
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Recipient is required"],
    },

    // 🏫 Linked Quiz/Event (optional)
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      default: null,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      default: null,
    },

    // 🗓️ Issue Info
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // The admin/teacher who issued it
      required: true,
    },
    certificateId: {
      type: String,
      unique: true,
    },

    // 🌐 Web3 & Blockchain Tracking
    txHash: {
      type: String,
      default: null,
      validate: {
        validator: (v) => v === null || /^0x[a-fA-F0-9]{64}$/.test(v),
        message: 'txHash must be a valid 0x-prefixed 32-byte hex string'
      }
    },
    ipfsMetadataUri: {
      type: String,
      default: null,
      validate: {
        validator: (v) => v === null || /^ipfs:\/\/.+/.test(v),
        message: 'ipfsMetadataUri must start with ipfs://'
      }
    },
  },
  { timestamps: true },
);

// Auto-generate a unique certificate ID before saving
certificateSchema.pre('save', async function(next) {
  if (!this.certificateId) {
    let unique = false;
    while (!unique) {
      const candidate = uuidv4();
      const existing = await mongoose.model('Certificate').findOne({ certificateId: candidate });
      if (!existing) { this.certificateId = candidate; unique = true; }
    }
  }
  next();
});

// Add indexes for efficient queries
certificateSchema.index({ user: 1, createdAt: -1 });
certificateSchema.index({ issuedBy: 1, createdAt: -1 });

const Certificate = mongoose.model("Certificate", certificateSchema);

export default Certificate;
