require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const createAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ email: "admin@smartbus.com" });
  if (existing) {
    console.log("Admin already exists");
    process.exit(0);
  }

  await User.create({
    name: "Admin",
    email: "admin@smartbus.com",
    password: "admin123", 
    phone: '1432534567', 
    role: "admin",
    isActive: true
  });

  console.log("✅ Admin created: admin@smartbus.com / admin123");
  process.exit(0);
};

createAdmin().catch(err => { console.error(err); process.exit(1); });