const Payment = require("../models/Payment");
const User = require("../models/user");

// Get all users (for selecting payment recipient)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select("name email phone walletBalance")
      .sort({ name: 1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Send payment
const sendPayment = async (req, res) => {
  const { receiverId, amount, note } = req.body;
  
  try {
    if (!receiverId || !amount || amount <= 0) {
      return res.status(400).json({ message: "Receiver and valid amount are required" });
    }

    const sender = await User.findById(req.user._id);
    const receiver = await User.findById(receiverId);

    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    if (sender._id.toString() === receiver._id.toString()) {
      return res.status(400).json({ message: "Cannot send payment to yourself" });
    }

    if (sender.walletBalance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Deduct from sender, add to receiver
    sender.walletBalance -= amount;
    receiver.walletBalance += amount;

    await sender.save();
    await receiver.save();

    // Create payment record
    const payment = await Payment.create({
      sender: sender._id,
      receiver: receiver._id,
      amount: Number(amount),
      note: note || "",
      status: "completed"
    });

    const populatedPayment = await Payment.findById(payment._id)
      .populate("sender", "name email phone")
      .populate("receiver", "name email phone");

    res.status(201).json({
      payment: populatedPayment,
      newBalance: sender.walletBalance
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get payment history (sent + received)
const getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }]
    })
      .populate("sender", "name email phone")
      .populate("receiver", "name email phone")
      .sort({ date: -1 });

    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Add money to wallet (for testing/demo purposes)
const addMoneyToWallet = async (req, res) => {
  const { amount } = req.body;
  
  try {
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Valid amount required" });
    }

    const user = await User.findById(req.user._id);
    user.walletBalance += Number(amount);
    await user.save();

    res.json({ 
      message: "Money added successfully", 
      newBalance: user.walletBalance 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// Get current wallet balance
const getWalletBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("walletBalance name");
    res.json({ 
      balance: user.walletBalance,
      name: user.name
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getAllUsers,
  sendPayment,
  getPaymentHistory,
  addMoneyToWallet,
  getWalletBalance
};
