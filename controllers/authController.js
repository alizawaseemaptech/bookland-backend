const jwt = require("jsonwebtoken");
const User = require("../models/User");

const ADMIN_EMAIL = "admin@bookland.com";
const ADMIN_PASSWORD = "123456";

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

const safeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
});

// POST /api/auth/signup
const signup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!name || !normalizedEmail || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // The reserved admin account can never be created as a normal customer.
    if (normalizedEmail === ADMIN_EMAIL) {
      return res.status(403).json({ message: "This email is reserved for the Book Land administrator." });
    }

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password,
      role: "customer",
    });

    res.status(201).json({
      ...safeUser(user),
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Bootstrap the single admin account on first admin login if it does not exist.
    // Password is still hashed by the User model's pre-save hook.
    if (normalizedEmail === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      let admin = await User.findOne({ email: ADMIN_EMAIL });

      if (!admin) {
        admin = await User.create({
          name: "Book Land Admin",
          email: ADMIN_EMAIL,
          phone: "0000000000",
          password: ADMIN_PASSWORD,
          role: "admin",
        });
      } else if (admin.role !== "admin") {
        return res.status(403).json({ message: "This account is not authorized as an admin." });
      }

      return res.json({
        ...safeUser(admin),
        token: generateToken(admin._id),
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    res.json({
      ...safeUser(user),
      token: generateToken(user._id),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/auth/me
const getMe = async (req, res) => res.json(req.user);

module.exports = { signup, login, getMe };
