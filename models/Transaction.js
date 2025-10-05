const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  customerName: { type: String },
  amount: { type: Number, required: true },
  type: { type: String, enum: ["credit", "debit"], required: true },
  note: { type: String },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Transaction", transactionSchema);