import mongoose from 'mongoose';
import ipaddr from 'ipaddr.js';

const wifiWhitelistSchema = new mongoose.Schema(
  {
    ipRange: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v) => {
          try { ipaddr.parseCIDR(v); return true; }
          catch { 
            try { ipaddr.parse(v); return true; }
            catch { return false; }
          }
        },
        message: 'ipRange must be a valid IP address or CIDR notation (e.g. 192.168.1.0/24)'
      }
    },
    schoolName: {
      type: String,
      required: true,
    },
    department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    default: null,
  },
    location: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model('WiFiWhitelist', wifiWhitelistSchema);
