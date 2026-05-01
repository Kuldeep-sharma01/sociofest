import cron from "node-cron";
import Assignment from "../models/Assignment.js";
import Notification from "../models/Notification.js";
import Student from "../models/Student.js";
import AssignmentSubmission from "../models/AssignmentSubmission.js";

export const startAssignmentCron = (io) => {
  // Run at the top of every hour
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowEnd = new Date(tomorrow.getTime() + 60 * 60 * 1000); // 1-hour window

      // Find assignments due exactly between 24 and 25 hours from now
      const upcomingAssignments = await Assignment.find({
        dueDate: { $gte: tomorrow, $lt: tomorrowEnd }
      });

      for (const assignment of upcomingAssignments) {
        // Find students enrolled in this assignment's subject
        const enrolledStudents = await Student.find({ subjects: assignment.subject }).lean();
        
        for (const student of enrolledStudents) {
          // Skip if the student has already submitted it
          const existingSubmission = await AssignmentSubmission.findOne({
            assignment: assignment._id,
            student: student.userId
          }).lean();

          if (existingSubmission) continue;
          
          const msg = `Reminder: Assignment "${assignment.title}" is due in less than 24 hours!`;
          
          await Notification.create({
            recipient: student.userId,
            actor: assignment.author,
            type: "assignment_reminder",
            message: msg,
          });

          if (io) {
            io.to(student.userId.toString()).emit("notification", { message: msg });
          }
        }
      }
    } catch (error) {
      console.error("Error running assignment reminder cron:", error);
    }
  });
};