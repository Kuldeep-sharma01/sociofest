// server/controllers/certificateController.js
import mongoose from "mongoose";
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import Certificate from "../models/Certificate.js";
import User from "../models/User.js";
import Material from "../models/Material.js";
import { generateCertificatePDF } from "../utils/certificateGenerator.js";
import { v4 as uuidv4 } from "uuid";
import { ok, created, badRequest, notFound, forbidden, serverError } from "../utils/index.js";

const DOMPurify = createDOMPurify(new JSDOM('').window);

/**
 * @desc Issue a certificate to a user
 * @route POST /api/certificates
 * @access Private (Teacher / Admin)
 */
export const issueCertificate = async (req, res) => {
  try {
    const { userId, title, description, eventId, quizId } = req.body;

    if (!userId || !title) {
      return badRequest(res, "User ID and title are required.");
    }
    // ✅ Validate all IDs before hitting the DB
  if (!mongoose.Types.ObjectId.isValid(userId)) return badRequest(res, 'Invalid userId');
  if (eventId && !mongoose.Types.ObjectId.isValid(eventId)) return badRequest(res, 'Invalid eventId');
  if (quizId && !mongoose.Types.ObjectId.isValid(quizId)) return badRequest(res, 'Invalid quizId');

    const user = await User.findById(userId);
    if (!user) return notFound(res, "User not found.");

    let materialId = null;
    if (description) {
      const safeDescription = DOMPurify.sanitize(description, { ALLOWED_TAGS: [] });
      const material = await Material.create({
        author: req.user._id,
        description: safeDescription,
      });
      materialId = material._id;
    }

    const certificate = await Certificate.create({
      title,
      user: userId,
      issuedBy: req.user._id, // Correctly use the issuer's ID
      event: eventId || null,
      quiz: quizId || null,
      material: materialId,
    });

    created(res, certificate, "Certificate issued successfully.");
  } catch (error) {
    console.error("Error issuing certificate:", error);
    serverError(res);
  }
};

/**
 * @desc Get all certificates (admin/teacher)
 * @route GET /api/certificates
 * @access Private (Admin / Teacher)
 */
export const getAllCertificates = async (req, res) => {
  try {
    // ✅ Scope by role — students only see their own, teachers see theirs
    const role = req.user.role.toLowerCase();
    let filter = {};
    if (role === 'student') {
      filter.user = req.user._id; // students only see their own
    } else if (role === 'teacher') {
      filter.issuedBy = req.user._id; // teachers only see what they issued
    }
    // Admin sees all (filter stays {})

    const certificates = await Certificate.find(filter)
      .populate('user', 'name email')
      .populate('material')
      .sort({ createdAt: -1 });
    ok(res, certificates, 'Certificates retrieved successfully.');
  } catch (error) {
    serverError(res);
  }
};

/**
 * @desc Get certificates by user
 * @route GET /api/certificates/user/:userId
 * @access Private
 */
export const getCertificatesByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return badRequest(res, 'Invalid user ID format');
    }

    // ✅ Gate: students can only view their own certificates
    const role = req.user.role.toLowerCase();
    if (role === 'student' && req.user._id.toString() !== userId) {
      return forbidden(res, 'Students can only view their own certificates');
    }

    const certificates = await Certificate.find({ user: userId })
      .populate('material')
      .sort({ createdAt: -1 });
    ok(res, certificates, 'Certificates retrieved successfully.');
  } catch (error) {
    serverError(res);
  }
};

/**
 * @desc Download certificate as PDF
 * @route GET /api/certificates/download/:id
 * @access Private
 */
export const downloadCertificate = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return badRequest(res, 'Invalid certificate ID');
    }

    const certificate = await Certificate.findById(req.params.id)
      .populate(
        "user", // The recipient
        "name email", // Fields to populate for the user
      )
      .populate("issuedBy", "name"); // Populate the issuer's name

    if (!certificate)
      return notFound(res, "Certificate record not found in database.");

    // ✅ Gate: only the recipient, the issuer, or an Admin/HOD can download
    const role = req.user.role.toLowerCase();
    const isRecipient = certificate.user._id.toString() === req.user._id.toString();
    const isIssuer = certificate.issuedBy._id.toString() === req.user._id.toString();
    const isElevated = ['admin', 'hod'].includes(role);

    if (!isRecipient && !isIssuer && !isElevated) {
      return forbidden(res, 'Not authorized to download this certificate');
    }

    const pdfBuffer = await generateCertificatePDF(certificate);

    // Safely format the filename to prevent Node.js from throwing an Invalid Header error due to spaces/special chars
    const safeTitle =
      certificate.title?.replace(/[^a-zA-Z0-9]/g, "_") || "Certificate";
    const safeName =
      certificate.user?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "User";

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle + "_" + safeName)}.pdf`,
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating certificate PDF:", error);
    serverError(res, `PDF Error: ${error.message || "Failed to generate certificate."}`);
  }
};

/**
 * @desc Delete a certificate
 * @route DELETE /api/certificates/:id
 * @access Private (Admin)
 */
export const deleteCertificate = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return badRequest(res, 'Invalid certificate ID');
    }
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate)
      return notFound(res, "Certificate not found.");
    // ✅ Only Admin or the issuer can delete
    const role = req.user.role.toLowerCase();
    const isIssuer = certificate.issuedBy.toString() === req.user._id.toString();
    if (role !== 'admin' && !isIssuer) {
      return forbidden(res, 'Only the issuer or an Admin can delete this certificate');
    }

    if (certificate.material) {
      await Material.findByIdAndDelete(certificate.material);
    }

    await certificate.deleteOne();
    ok(res, null, "Certificate deleted successfully.");
  } catch (error) {
    console.error("Error deleting certificate:", error);
    serverError(res);
  }
};
