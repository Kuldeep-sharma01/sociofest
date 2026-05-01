import mongoose from "mongoose";

// server/models/QuizSubmission.js
const submissionSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  answers: [{
    questionId: { type: mongoose.Schema.Types.ObjectId },
    answer:     { type: Number },
  }],
  score: Number,
  submittedAt: { type: Date, default: Date.now, index: true }
});

submissionSchema.index({ quiz: 1, student: 1 });
submissionSchema.index({ student: 1, submittedAt: -1 });

const QuizSubmission = mongoose.model('QuizSubmission', submissionSchema);
export default QuizSubmission;
