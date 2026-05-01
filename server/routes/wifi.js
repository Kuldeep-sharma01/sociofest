import express from 'express';
import WiFiWhitelist from '../models/WiFiWhitelist.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { isIPInRange } from '../utils/network.js';
import { ok, created, badRequest, notFound, serverError } from '../utils/index.js';
import { readSystemSettings } from "../utils/systemSettings.js";

const router = express.Router();

/**
 * WiFi Verification
 */

/**
 * @route   POST /api/wifi/verify
 * @desc    Verify if the client is connected to a whitelisted network
 * @access  Private
 */
const verifyWifiHandler = async (req, res) => {
  try {
    const systemSettings = await readSystemSettings();
    if (systemSettings.serviceControls?.wifiEnforcementEnabled === false) {
      return ok(
        res,
        { verified: true, message: "WiFi enforcement disabled by admin" },
        "WiFi verification bypassed by configuration",
      );
    }
    // SECURITY FIX: Prevent IP spoofing via client-controlled headers
    const clientIP = (req.ip || req.connection?.remoteAddress || '').replace(/^::ffff:/, '');

    // Get active whitelisted IP ranges
    const whitelistedRanges = await WiFiWhitelist.find({ isActive: true });

    let wifiVerified = false;
    let matchedSchool = null;

    // Check if client IP matches any whitelisted range
    for (const entry of whitelistedRanges) {
      if (isIPInRange(clientIP, entry.ipRange)) {
        wifiVerified = true;
        matchedSchool = entry.schoolName;
        break;
      }
    }

    ok(res, {
      verified: wifiVerified,
      message: wifiVerified
        ? 'Connected to campus network'
        : 'Not on a whitelisted network',
    }, "WiFi verification completed");
  } catch (error) {
    serverError(res, error.message);
  }
};

router.post('/verify', authenticate, verifyWifiHandler);
router.get('/verify', authenticate, verifyWifiHandler);

/**
 * WiFi Whitelist Management - Get
 */

/**
 * @route   GET /api/wifi/whitelist
 * @desc    Get all whitelisted IP ranges
 * @access  Private/Admin
 */
router.get('/whitelist', authenticate, authorize('admin'), async (req, res) => {
  try {
    const whitelist = await WiFiWhitelist.find();
    ok(res, whitelist, "Whitelist retrieved successfully");
  } catch (error) {
    serverError(res, error.message);
  }
});

/**
 * WiFi Whitelist Management - Add
 */

/**
 * @route   POST /api/wifi/whitelist
 * @desc    Add an IP range to the whitelist
 * @access  Private/Admin
 */
router.post('/whitelist', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { ipRange, schoolName, location } = req.body;

    if (!ipRange || !schoolName) {
      return badRequest(res, 'ipRange and schoolName are required');
    }

    const entry = new WiFiWhitelist({
      ipRange,
      schoolName,
      location,
    });
    await entry.save();
    created(res, entry, "Whitelist entry added successfully");
  } catch (error) {
    serverError(res, error.message);
  }
});

/**
 * WiFi Whitelist Management - Update and Delete
 */

/**
 * @route   PUT /api/wifi/whitelist/:id
 * @desc    Update a whitelist entry
 * @access  Private/Admin
 */
// Update whitelist entry
router.put('/whitelist/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { ipRange, schoolName, location, notes, isActive, department } = req.body;
    const update = {};
    if (ipRange !== undefined) update.ipRange = ipRange;
    if (schoolName !== undefined) update.schoolName = schoolName;
    if (location !== undefined) update.location = location;
    if (notes !== undefined) update.notes = notes;
    if (isActive !== undefined && typeof isActive === 'boolean') update.isActive = isActive;
    if (department !== undefined) update.department = department;

    const entry = await WiFiWhitelist.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!entry) {
      return notFound(res, 'Whitelist entry not found');
    }
    ok(res, entry, "Whitelist entry updated successfully");
  } catch (error) {
    serverError(res, error.message);
  }
});

/**
 * @route   DELETE /api/wifi/whitelist/:id
 * @desc    Delete a whitelist entry
 * @access  Private/Admin
 */
// Delete whitelist entry
router.delete('/whitelist/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const entry = await WiFiWhitelist.findByIdAndDelete(req.params.id);
    if (!entry) {
      return notFound(res, 'Whitelist entry not found');
    }
    ok(res, null, 'Whitelist entry deleted');
  } catch (error) {
    serverError(res, error.message);
  }
});

export default router;
