import express from 'express';
import User from '../models/User.js';
import Doctor from '../models/Doctor.js';
import Admin from '../models/Admin.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.post('/', async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).send({ error: 'Email, password and role are required.' });
  }

  try {
    let user;
    if (role === 'doctor') {
      user = await Doctor.findOne({ email });
    } else if (role === 'admin') {
      user = await Admin.findOne({ email });
    } else {
      user = await User.findOne({ email, role });
    }

    if (!user) {
      return res.status(400).send({ error: 'Invalid email or role.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send({ error: 'Invalid password.' });
    }

    const secret = process.env.JWT_SECRET || 'fallback_secret_change_me';
    const token = jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: '24h' });

    res.send({ token, role: user.role, id: user._id });
  } catch (error) {
    console.error('[Login] Error:', error.message);
    res.status(500).send({ error: 'Server error.' });
  }
});

export default router;