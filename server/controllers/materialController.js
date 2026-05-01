import Material from "../models/Material.js";
import Notification from "../models/Notification.js";
import Subject from "../models/Subject.js";
import { processUpload, deleteMediaDocs } from "../utils/mediaHelper.js";
import {
  ok,
  created,
  badRequest,
  notFound,
  forbidden,
  serverError,
} from "../utils/index.js";

export const uploadMaterial = async (req, res) => {
  try {
    const { title } = req.body;

    if (!req.files || req.files.length === 0) {
      return badRequest(res, "No files uploaded.");
    }

    let mediaIds = [];
    for (const file of req.files) {
      const media = await processUpload(file, "study_hub/materials");
      mediaIds.push(media._id);
    }

    const material = new Material({
      title,
      subject: req.params.subjectId,
      author: req.user._id,
      media: mediaIds,
    });
    await material.save();

    const msg = `New study material uploaded: ${material.title}`;
    await Notification.create({
      recipient: null,          // null = broadcast to department
      actor: req.user._id,
      type: 'material_uploaded',
      departmentId: req.user.department,
      message: msg,
      details: { materialId: material._id },
    });

    const io = req.app.get("io");
    if (io) {
      const room = req.user.department ? `dept:${req.user.department}` : 'faculty';
      io.to(room).emit("notification", { message: msg });
      io.to(room).emit("new_activity", { type: "material", id: material._id });
    }

    const populatedMaterial = await Material.findById(material._id)
      .populate({ path: "media", model: "Media" })
      .lean();

    if (populatedMaterial.media && populatedMaterial.media.length > 0) {
      populatedMaterial.fileUrls = populatedMaterial.media.map((m) =>
        m.path.startsWith("http") ? m.path : `/${m.path}`,
      );
      populatedMaterial.fileUrl = populatedMaterial.fileUrls[0];
    }

    created(res, populatedMaterial, "Material uploaded successfully.");
  } catch (error) {
    console.error("Material upload error:", error);
    serverError(res);
  }
};

export const getMaterialsBySubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId).select('department');
    if (!subject) return notFound(res, 'Subject not found');

    const isAdmin = ['Admin', 'HOD'].includes(req.user.role);
    const inDept = req.user.department?.toString() === subject.department?.toString();
    if (!isAdmin && !inDept) {
      return forbidden(res, 'You do not have access to this subject');
    }

    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [materials, total] = await Promise.all([
      Material.find({ subject: req.params.subjectId, isDeleted: { $ne: true } })
        .populate({ path: "media", model: "Media" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Material.countDocuments({ subject: req.params.subjectId, isDeleted: { $ne: true } }),
    ]);

    materials.forEach((m) => {
      if (m.media && m.media.length > 0 && typeof m.media[0] === "object") {
        m.fileUrls = m.media.map((media) =>
          media.path.startsWith("http") ? media.path : `/${media.path}`,
        );
        m.fileUrl = m.fileUrls[0];
      }
    });

    ok(res, { materials, total, page, pages: Math.ceil(total / limit) }, "Materials retrieved.");
  } catch (error) {
    serverError(res);
  }
};

export const deleteMaterial = async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) return notFound(res, "Material not found.");

    // Allow only the creator, or an Admin/HOD to delete
    if (
      material.author.toString() !== req.user._id.toString() &&
      !["Admin", "HOD"].includes(req.user.role)
    ) {
      return forbidden(res, "Not authorized to delete this material.");
    }

    // RELATIONAL DELETE
    if (material.get("media") && material.get("media").length > 0) {
      await deleteMediaDocs(material.get("media"));
    }

    await material.deleteOne();
    await Notification.deleteMany({
      type: 'material_uploaded',
      'details.materialId': material._id,
    });

    const io = req.app.get("io");
    if (io) {
      const room = req.user.department ? `dept:${req.user.department}` : 'faculty';
      io.to(room).emit("remove_activity", { type: "material", id: material._id });
    }

    ok(res, null, "Material deleted successfully.");
  } catch (error) {
    console.error("Error deleting material:", error);
    serverError(res);
  }
};
