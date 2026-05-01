import mongoose from "mongoose";

const optionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: [true, "Option text is required"],
  },
});

const questionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, "Question text is required"],
  },
  options: {
    type: [optionSchema],
    validate: [(val) => val.length === 4, "Each question must have 4 options"],
  },
  correctAnswer: {
    type: Number, // index of the correct option
    required: [true, "Correct answer index is required"],
    validate: {
      validator: function (val) {
        return val >= 0 && val < this.options.length;
      },
      message: "Correct answer index is out of range",
    },
  },
});

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    shuffle: { type: Number, default: 0 },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
      index: true,
    },
    description: { type: String, default: "" },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },

    startDate: { type: Date },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    questions: {
      type: [questionSchema],
      validate: [
        (val) => val.length > 0,
        "Quiz must contain at least one question",
      ],
    },
    questionsUpdatedAt: { type: Date, default: Date.now },
    isActive: {
      type: Boolean,
      default: true,
    },
    passingScore: { type: Number, default: 80, min: 0, max: 100 },
    cheatLogs: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        violationType: { type: String }, // e.g., 'no_face', 'multiple_faces', 'camera_denied'
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

const Quiz = mongoose.model("Quiz", quizSchema);
export default Quiz;
