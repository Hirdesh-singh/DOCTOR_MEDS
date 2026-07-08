import mongoose from 'mongoose';
import Admin from './models/Admin.js';
import Doctor from './models/Doctor.js';
import User from './models/User.js';

async function listUsers() {
  await mongoose.connect('mongodb://localhost:27017/User');
  
  console.log("=== ADMINS ===");
  const admins = await Admin.find({});
  admins.forEach(a => console.log(`Email: ${a.email} | Name: ${a.firstName} ${a.lastName}`));
  
  console.log("\n=== DOCTORS ===");
  const doctors = await Doctor.find({});
  doctors.forEach(d => console.log(`Email: ${d.email} | Name: Dr. ${d.firstName} ${d.lastName}`));

  console.log("\n=== PATIENTS ===");
  const patients = await User.find({ role: 'patient' });
  patients.forEach(p => console.log(`Email: ${p.email} | Name: ${p.firstName} ${p.lastName}`));

  await mongoose.disconnect();
}

listUsers().catch(console.error);
