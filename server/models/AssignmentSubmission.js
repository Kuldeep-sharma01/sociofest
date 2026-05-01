import mongoose from "mongoose";

const assignmentSubmissionSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    textAnswer: String,
    media: [{ type: mongoose.Schema.Types.ObjectId, ref: "Media" }],
   grade:    { type: Number, default: null, min: 0, max: 100 },
feedback: { type: String, default: "", maxlength: 5000 },
  },
  { timestamps: { createdAt: "submittedAt", updatedAt: "updatedAt" } },
);

// Ensure a student can only submit once per assignment
assignmentSubmissionSchema.index(
  { assignment: 1, student: 1 },
  { unique: true },
);

// Efficiently query for a student's submissions over time
assignmentSubmissionSchema.index({ student: 1, submittedAt: -1 });

const AssignmentSubmission = mongoose.model(
  "AssignmentSubmission",
  assignmentSubmissionSchema,
);
export default AssignmentSubmission;
