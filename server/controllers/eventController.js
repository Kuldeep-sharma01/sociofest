// server/controllers/eventController.js
import mongoose from "mongoose";
import Event from "../models/Event.js";
import Material from "../models/Material.js";
import Media from "../models/Media.js";
import { processUpload, deleteMediaDocs } from "../utils/mediaHelper.js";
import { ok, created, badRequest, notFound, forbidden, serverError } from "../utils/index.js";

/**
 * @desc Create new event
 * @route POST /api/events
 * @access Private (Admin / Teacher)
 */
export const createEvent = async (req, res) => {
  try {
    const { title, description, start, end, category, location, isPrivate } =
      req.body;   
    if (!title || !start || !end) {
      return badRequest(res, "Title and date are required.");
    }

    let mediaIds = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const media = await processUpload(file, "events");
        mediaIds.push(media._id);
      }
    }

    let materialId = null;
    if (description || mediaIds.length > 0) {
      const materialDoc = await Material.create({
        author: req.user._id,
        description: description || "",
        media: mediaIds,
      });
      materialId = materialDoc._id;
    }

    const isPublicEvent =
      isPrivate === "true" || isPrivate === true ? false : true;

    const event = await Event.create({
      title,
      start,
      end,
      category,
      location,
      isPublic: isPublicEvent, // Correctly parse multipart form data strings
      author: req.user._id,
      department: req.user.department || null,
      material: materialId,
    });

    // Broadcast real-time notification for public events
    const io = req.app.get("io");
    if (io && event.isPublic) {
      io.emit("new activity", { type: "event", id: event._id });
    }

    const populatedEvent = await Event.findById(event._id)
      .populate("author", "name role")
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      });

    created(res, populatedEvent, "Event created successfully.");
  } catch (error) {
    console.error("Error creating event:", error);
    serverError(res);
  }
};

/**
 * @desc Get all events
 * @route GET /api/events
 * @access Public
 */
export const getAllEvents = async (req, res) => {
  try {
    // Base query for public events
    let query = { isPublic: true };

    // If a user is logged in, also include their private events
    if (req.user) {
      query = {
        $or: [{ isPublic: true }, { author: req.user._id }],
      };
    }
    
    // ✅ Add limit/skip query params
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [events, total] = await Promise.all([
      Event.find(query)
        .populate("author", "name role")
        .populate({
          path: "material",
          populate: { path: "media", model: "Media" },
        })
        .sort({ start: 1 })
        .skip(skip)
        .limit(limit),
      Event.countDocuments(query),
    ]);
    
    ok(res, { events, total, page, pages: Math.ceil(total / limit) }, 'Events retrieved successfully.');
  } catch (error) {
    console.error("Error fetching events:", error);
    serverError(res);
  }
};

/**
 * @desc Get event by ID
 * @route GET /api/events/:id
 * @access Public
 */
export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("author", "name role")
      .populate({
        path: "material",
        populate: { path: "media", model: "Media" },
      });
    if (!event) return notFound(res, "Event not found.");

    // Security check: If the event is private, only allow the creator to view it.
    if (!event.isPublic) {
      if (!req.user || event.author.toString() !== req.user._id.toString()) {
        return forbidden(res, "You are not authorized to view this private event.");
      }
    }

    ok(res, event, "Event retrieved successfully.");
  } catch (error) {
    console.error("Error fetching event:", error);
    serverError(res);
  }
};

/**
 * @desc Update event
 * @route PUT /api/events/:id
 * @access Private (Admin / Teacher who created it)
 */
export const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return notFound(res, "Event not found.");

    // Allow only creator or admin to update
    if (
      event.author.toString() !== req.user._id.toString() &&
      req.user.role !== "Admin"
    ) {
      return forbidden(res, "Not authorized to update this event.");
    }

    // ✅ Whitelist allowed update fields
    const ALLOWED_EVENT_FIELDS = ['title', 'start', 'end', 'category', 'location', 'isPrivate'];
    const updates = {};
    ALLOWED_EVENT_FIELDS.forEach(f => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    // Handle isPublic conversion from isPrivate
    if (updates.isPrivate !== undefined) {
      updates.isPublic = updates.isPrivate === 'true' ? false
        : updates.isPrivate === 'false' ? true
        : !updates.isPrivate;
      delete updates.isPrivate;
    }

    let mat = event.material
      ? await Material.findById(event.material)
      : new Material({ author: req.user._id });
    if (req.body.description !== undefined) {
      mat.description = req.body.description;
    }

    if (
      req.body.retainedMediaIds !== undefined ||
      (req.files && req.files.length > 0)
    ) {
      const retainedIds = req.body.retainedMediaIds
        ? Array.isArray(req.body.retainedMediaIds)
          ? req.body.retainedMediaIds
          : [req.body.retainedMediaIds]
        : [];
      const orphanedDocs = [];

      if (mat.media && mat.media.length > 0) {
        const existingMedia = await Media.find({ _id: { $in: mat.media } });
        for (const mDoc of existingMedia) {
          if (retainedIds.includes(mDoc._id.toString())) {
            // Kept
          } else {
            orphanedDocs.push(mDoc);
          }
        }
      }

      await deleteMediaDocs(orphanedDocs.map((o) => o._id));

      const newMediaIds = [...retainedIds];

      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const f = req.files[i];
          const m = await processUpload(f, "events");
          newMediaIds.push(m._id);
        }
      }

      mat.media = newMediaIds;
    }

    updates.material = mat._id;

    const session = await mongoose.startSession();
    session.startTransaction();
    let updatedEvent;
    try {
      await mat.save({ session });
      updatedEvent = await Event.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        session,
      })
        .populate("author", "name role")
        .populate({
          path: "material",
          populate: { path: "media", model: "Media" },
        });
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }

    ok(res, updatedEvent, "Event updated successfully.");
  } catch (error) {
    console.error("Error updating event:", error);
    serverError(res);
  }
};

/**
 * @desc Delete event
 * @route DELETE /api/events/:id
 * @access Private (Admin / Teacher who created it)
 */
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return notFound(res, "Event not found.");

    if (
      event.author.toString() !== req.user._id.toString() &&
      req.user.role !== "Admin"
    ) {
      return forbidden(res, "Not authorized to delete this event.");
    }

    if (event.material) {
      const mat = await Material.findById(event.material);
      if (mat) {
        if (mat.media && mat.media.length > 0) await deleteMediaDocs(mat.media);
        await mat.deleteOne();
      }
    }

    await event.deleteOne();

    const io = req.app.get("io");
    // ✅ Scope deletion broadcast identically to creation (Fix 8)
    if (io && event.isPublic) {
      io.emit("remove activity", { type: "event", id: event._id });
    }

    ok(res, null, "Event deleted successfully.");
  } catch (error) {
    console.error("Error deleting event:", error);
    serverError(res);
  }
};
