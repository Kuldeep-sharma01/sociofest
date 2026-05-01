import mongoose from "mongoose";

const sellerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    businessType: {
      type: String,
      required: true,
      enum: ["Retail", "Wholesale", "Services", "Manufacturing", "Other"],
      index: true,
    },
  },
  { timestamps: true },
);

const Seller = mongoose.models.Seller || mongoose.model("Seller", sellerSchema);
export default Seller;
