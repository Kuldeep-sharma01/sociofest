import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";

// Import Models
import User from "./models/User.js";
import Department from "./models/Department.js";
import HOD from "./models/HOD.js";
import Teacher from "./models/Teacher.js";
import Student from "./models/Student.js";
import Quiz from "./models/Quiz.js";
import Post from "./models/Post.js";
import Assignment from "./models/Assignment.js";
import Material from "./models/Material.js";
import Connection from "./models/Connection.js";
import Message from "./models/Message.js";
import Conversation from "./models/Conversation.js";
import Event from "./models/Event.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("♻️  MongoDB Connected. Starting seeding process...");

    const dataPath = path.join(__dirname, "seedData.json");
    const seedData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    // 1. Concurrently drop all existing collections for maximum efficiency
    console.log("🧹 Wiping existing database...");
    await Promise.all([
      Department.deleteMany(),
      User.deleteMany(),
      HOD.deleteMany(),
      Teacher.deleteMany(),
      Student.deleteMany(),
      Quiz.deleteMany(),
      Post.deleteMany(),
      Assignment.deleteMany(),
      Material.deleteMany(),
      Connection.deleteMany(),
      Message.deleteMany(),
      Conversation.deleteMany(),
      Event.deleteMany(),
    ]);

    // 2. Bulk insert data using insertMany (much faster than looping .save())
    console.log("🚀 Injecting fresh JSON seed data...");

    // Hash a default password for all seeded users so you can actually log in
    const defaultHashedPassword = await bcrypt.hash("1234", 10);
    const usersWithRealHashes = seedData.users.map((user) => ({
      ...user,
      password: defaultHashedPassword,
    }));

    const modelsAndData = [
      { model: Department, data: seedData.departments },
      { model: User, data: usersWithRealHashes },
      { model: HOD, data: seedData.hods },
      { model: Teacher, data: seedData.teachers },
      { model: Student, data: seedData.students },
      { model: Quiz, data: seedData.quizzes },
      { model: Post, data: seedData.posts },
      { model: Assignment, data: seedData.assignments },
      { model: Material, data: seedData.materials },
      { model: Connection, data: seedData.connections },
      { model: Message, data: seedData.messages },
      { model: Conversation, data: seedData.conversations },
    ];

    for (const { model, data } of modelsAndData) {
      if (data && data.length > 0) {
        await model.insertMany(data);
      }
    }

    console.log("✅ Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
