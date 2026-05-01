import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true, enum: ["Books", "Accessories"] },
  condition: { type: String, required: true },
  location: { type: String },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  description: {
      type: String,
      default: "",
    },
  deliveryOptions: [{ type: String, enum: ["Pickup", "Campus Delivery", "Home Delivery"] }],
  images: [{ type: mongoose.Schema.Types.ObjectId, ref: "Media" }],
  status: { type: String, enum: ["Available", "Reserved", "Sold"], default: "Available" },
  activeOrder: {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    trackingStatus: { type: String, enum: ["Pending", "Dispatched", "Out for Delivery", "Delivered"] },
    trackingCoordinates: { lat: Number, lng: Number },
    lastUpdated: { type: Date }
  }
}, { timestamps: true });

export default mongoose.model("Product", productSchema);