const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Customer = require("../models/Customer");
const Transaction = require("../models/Transaction");
const Payment = require("../models/Payment");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const registerUser = async (req, res) => {
  const { name, identifier, password } = req.body;
  try {
    if (!identifier || !password || !name) {
      return res.status(400).json({ message: "Name, Email/Phone, and password are required" });
    }

    // Check if a user already exists with this email OR phone
    const existingUser = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    });

    if (existingUser) {
      return res.status(400).json({ message: "An account with this email or phone number already exists." });
    }
    
    // Figure out if the identifier is an email or a phone
    const isEmail = /@/.test(identifier); // Simple check for an '@' symbol

    const userToCreate = {
      name,
      password,
    };

    if (isEmail) {
      userToCreate.email = identifier;
    } else {
      userToCreate.phone = identifier;
    }

    const user = await User.create(userToCreate);
    
    return res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone },
      token: generateToken(user._id)
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};


const loginUser = async (req, res) => {
  const { identifier, password } = req.body;
  try {
    if (!identifier || !password) {
      return res.status(400).json({ message: "Email/Phone and password are required" });
    }
    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    }).select('+password');
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const match = await user.matchPassword(password);
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    return res.json({
      user: { id: user._id, name: user.name, email: user.email },
      token: generateToken(user._id)
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    user.password = newPassword;
    await user.save();

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

const deleteAccount = async (req, res) => {
  const { password } = req.body;

  try {
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Password is incorrect" });
    }

    await Promise.all([
      Transaction.deleteMany({ user: user._id }),
      Customer.deleteMany({ user: user._id }),
      Payment.deleteMany({ $or: [{ sender: user._id }, { receiver: user._id }] }),
      User.findByIdAndDelete(user._id),
    ]);

    return res.json({ message: "Account deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  registerUser,
  loginUser,
  changePassword,
  deleteAccount,
};