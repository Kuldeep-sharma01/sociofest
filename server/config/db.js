// server/config/db.js
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("Missing MongoDB URI. Set MONGODB_URI (preferred) or MONGODB_URI.");
    }

    const conn = await mongoose.connect(mongoUri);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Exit on failure
  }
};

export default connectDB;
