// server/routes/curriculum.js
import express from "express";
import mongoose from "mongoose";
import Curriculum from "../models/Curriculum.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * @route   GET /api/curriculum
 * @desc    Get all curricula (filtered by teacher's own, or all for Admin/HOD)
 * @access  Private
 */
router.get("/", protect, async (req, res) => {
  try {
    const filter = {};

    // Students see active curricula for their department's subjects
    if (req.user.role === "Student") {
      filter.isActive = true;
    }
    // Teachers see only their own curricula
    else if (req.user.role === "Teacher") {
      filter.teacher = req.user._id;
    }
    // Admin and HOD see all (HOD could be filtered by department if needed)

    const curricula = await Curriculum.find(filter)
      .populate("teacher", "name role")
      .populate("subjectId", "name code")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, data: curricula });
  } catch (error) {
    console.error("Error fetching curricula:", error);
    res.status(500).json({ success: false, message: "Server error fetching curricula." });
  }
});

/**
 * @route   GET /api/curriculum/:id
 * @desc    Get a single curriculum by ID
 * @access  Private
 */
router.get("/:id", protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid curriculum ID." });
    }

    const curriculum = await Curriculum.findById(req.params.id)
      .populate("teacher", "name role")
      .populate("subjectId", "name code")
      .lean();

    if (!curriculum) {
      return res.status(404).json({ success: false, message: "Curriculum not found." });
    }

    res.status(200).json({ success: true, data: curriculum });
  } catch (error) {
    console.error("Error fetching curriculum:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

/**
 * @route   GET /api/curriculum/subject/:subjectId
 * @desc    Get curricula for a specific subject
 * @access  Private
 */
router.get("/subject/:subjectId", protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.subjectId)) {
      return res.status(400).json({ success: false, message: "Invalid subject ID." });
    }

    const curricula = await Curriculum.find({ subjectId: req.params.subjectId, isActive: true })
      .populate("teacher", "name role")
      .sort({ startDate: -1 })
      .lean();

    res.status(200).json({ success: true, data: curricula });
  } catch (error) {
    console.error("Error fetching curricula by subject:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

/**
 * @route   POST /api/curriculum
 * @desc    Create a new curriculum
 * @access  Private (Teacher, HOD, Admin)
 */
router.post("/", protect, authorize("Teacher", "HOD", "Admin"), async (req, res) => {
  try {
    const { name, description, class: className, semester, subjectId, totalClasses, topics, startDate, endDate } = req.body;

    if (!name || !className || !subjectId || !startDate) {
      return res.status(400).json({ success: false, message: "Name, class, subjectId, and startDate are required." });
    }

    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ success: false, message: "Invalid subject ID." });
    }

    const curriculum = await Curriculum.create({
      name,
      description,
      teacher: req.user._id,
      class: className,
      semester,
      subjectId,
      totalClasses: totalClasses || 0,
      topics: topics || [],
      startDate,
      endDate,
    });

    const populated = await Curriculum.findById(curriculum._id)
      .populate("teacher", "name role")
      .populate("subjectId", "name code")
      .lean();

    res.status(201).json({ success: true, data: populated, message: "Curriculum created successfully." });
  } catch (error) {
    console.error("Error creating curriculum:", error);
    res.status(500).json({ success: false, message: "Server error creating curriculum." });
  }
});

/**
 * @route   PUT /api/curriculum/:id
 * @desc    Update a curriculum
 * @access  Private (Owner Teacher, HOD, Admin)
 */
router.put("/:id", protect, authorize("Teacher", "HOD", "Admin"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid curriculum ID." });
    }

    const curriculum = await Curriculum.findById(req.params.id);
    if (!curriculum) {
      return res.status(404).json({ success: false, message: "Curriculum not found." });
    }

    // Authorization: Only the creator, Admin, or HOD can update
    const isOwner = curriculum.teacher.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "Admin";
    const isHOD = req.user.role === "HOD";

    if (!isOwner && !isAdmin && !isHOD) {
      return res.status(403).json({ success: false, message: "Not authorized to update this curriculum." });
    }

    const allowedFields = ["name", "description", "class", "semester", "totalClasses", "completedClasses", "topics", "startDate", "endDate", "isActive"];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const updated = await Curriculum.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate("teacher", "name role")
      .populate("subjectId", "name code")
      .lean();

    res.status(200).json({ success: true, data: updated, message: "Curriculum updated successfully." });
  } catch (error) {
    console.error("Error updating curriculum:", error);
    res.status(500).json({ success: false, message: "Server error updating curriculum." });
  }
});

/**
 * @route   DELETE /api/curriculum/:id
 * @desc    Delete a curriculum
 * @access  Private (Owner Teacher, HOD, Admin)
 */
router.delete("/:id", protect, authorize("Teacher", "HOD", "Admin"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid curriculum ID." });
    }

    const curriculum = await Curriculum.findById(req.params.id);
    if (!curriculum) {
      return res.status(404).json({ success: false, message: "Curriculum not found." });
    }

    const isOwner = curriculum.teacher.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "Admin";
    const isHOD = req.user.role === "HOD";

    if (!isOwner && !isAdmin && !isHOD) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this curriculum." });
    }

    await curriculum.deleteOne();
    res.status(200).json({ success: true, message: "Curriculum deleted successfully." });
  } catch (error) {
    console.error("Error deleting curriculum:", error);
    res.status(500).json({ success: false, message: "Server error deleting curriculum." });
  }
});

export default router;
