const jwt = require("jsonwebtoken");
const User = require("../models/user");

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

module.exports = {
  registerUser,
  loginUser,
};