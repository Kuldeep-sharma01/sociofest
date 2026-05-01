import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { VALID_ROLES } from '../utils/rbac.js';

// ✅ Encrypt sensitive provider keys before storage
// Use application-level encryption or a separate secrets service.
const algorithm = 'aes-256-cbc';
const IV_LENGTH = 16;
// ✅ Require a dedicated ENCRYPTION_KEY — fail hard if missing in production
const getEncryptionKey = () => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    // Dev-only fallback — NEVER reuse JWT_SECRET
    return crypto.createHash('sha256').update('dev-only-encryption-key-do-not-use-in-prod').digest();
  }
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
  return buf;
};

// ✅ Use a dedicated prefix instead of heuristics
const ENCRYPTED_PREFIX = 'enc:v1:';

function encrypt(text) {
  if (!text || text.startsWith(ENCRYPTED_PREFIX)) return text;  // idempotent
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(algorithm, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return ENCRYPTED_PREFIX + iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
  if (!text || !text.startsWith(ENCRYPTED_PREFIX)) return text;  // not encrypted
  const parts = text.slice(ENCRYPTED_PREFIX.length).split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encryptedText = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv(algorithm, getEncryptionKey(), iv);
  return Buffer.concat([decipher.update(encryptedText), decipher.final()]).toString();
}

// Subdocument schema for OTP-tracked email addresses
const emailEntrySchema = new mongoose.Schema({
  address:    { type: String, required: true, lowercase: true, trim: true },
  isVerified: { type: Boolean, default: false },
  otp:        { type: String, select: false },  // Never exposed in API responses
  otpExpires: { type: Date,   select: false },
}, { _id: false });  // No _id per entry — address is the key

const userSchema = new mongoose.Schema({
  // Primary identity — always kept in sync with emails[0].address
  name:  { type: String, required: true, trim: true, maxlength: 100 },
  email: {
    type:     String,
    required: true,
    unique:   true,
    lowercase: true,
    trim:     true,
    match:    [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },

  password:       { type: String, select: false },  // Never exposed in API responses
  passwordChangedAt: { type: Date, select: false },
  role: {
    type:    String,
    enum:    VALID_ROLES,
    default: 'Student'
  },
  department:     { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  profilePicture: { type: String, default: '' },
  status: {
    type:    String,
    enum:    ['Pending', 'Approved', 'Rejected', 'Blocked'],
    default: 'Pending'
  },
  rejectionReason: {
    type: String,
    default: ""
  },

  // OTP-tracked email subdocuments — emails[0] always mirrors the primary email field
  emails: { type: [emailEntrySchema], default: [] },
  bio:           { type: String,  default: '', maxlength: 500 },
  location:      { type: String,  default: '' },
  contactNumber: { type: String,  default: '' },
  dob:           { type: Date },
  skills:        { type: [String], default: [] },
  isDnd: { type: Boolean, default: false },
  mustChangePassword: { type: Boolean, default: false },
  savedLectures: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Material', default: [] }],
  savedPosts:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post',     default: [] }],
  geminiApiKey:  { type: String,  select: false, get: decrypt, set: encrypt },   // select:false — never in public API
  rapidApiKey:   { type: String,  select: false, get: decrypt, set: encrypt },
  openAiApiKey:  { type: String,  select: false, get: decrypt, set: encrypt },
  claudeApiKey:  { type: String,  select: false, get: decrypt, set: encrypt },
  stabilityApiKey: { type: String,  select: false, get: decrypt, set: encrypt },
  deepseekApiKey: { type: String,  select: false, get: decrypt, set: encrypt },
  perplexityApiKey: { type: String, select: false, get: decrypt, set: encrypt },
  boltApiKey:    { type: String,  select: false, get: decrypt, set: encrypt },
  v0devApiKey:   { type: String,  select: false, get: decrypt, set: encrypt },
  emergentApiKey: { type: String,  select: false, get: decrypt, set: encrypt },
  huggingfaceApiKey: { type: String, select: false, get: decrypt, set: encrypt },
  openRouterApiKey: { type: String, select: false, get: decrypt, set: encrypt },
  aiChatHistory: { 
    type: mongoose.Schema.Types.Mixed, 
    select: false,
    validate: {
      validator: (v) => {
        if (!v) return true;
        return JSON.stringify(v).length <= 50000;  // 50KB hard cap
      },
      message: 'Chat history exceeds storage limit',
    }
  },
  banner:        { type: String,  default: '' },
  enrollmentNumber: { type: String },
  phone:         { type: String },
  // Online presence
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date },

  // Password reset fields
  resetPasswordToken:  { type: String, select: false },
  resetPasswordExpire: { type: Date,   select: false },

}, {
  timestamps: true,
  strict: true,  // ← Changed from false: prevents arbitrary field injection
  toJSON: { getters: true },
  toObject: { getters: true }
});

// ── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ 'emails.address': 1 });             // Fast OTP lookup
userSchema.index({ department: 1, role: 1 });          // HOD approval queries
userSchema.index({ status: 1, role: 1 });              // Admin dashboard filters
userSchema.index({ isOnline: 1 });                     // Presence queries

// ── Pre-save: Keep top-level email in sync with emails[0].address ─────────────
// ✅ Keep both directions in sync or make one field canonical
userSchema.pre('save', function (next) {
  if (this.email && (!this.emails || this.emails.length === 0)) {
    this.emails = [{ address: this.email, isVerified: false }];
  } else if (this.emails?.length > 0) {
    const primary = this.emails[0].address;
    if (primary && this.email !== primary) this.email = primary;
  }
  next();
});

// ── Instance Methods ──────────────────────────────────────────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  // password has select:false — must be explicitly selected before calling this
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.isPrimaryEmailVerified = function () {
  if (!this.emails || this.emails.length === 0) return false;
  return this.emails[0].isVerified === true;
};

const User = mongoose.model('User', userSchema);
export default User;