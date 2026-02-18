const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true, min: 0.01 },
  status: { 
    type: String, 
    enum: ["pending", "completed", "failed"], 
    default: "completed" 
  },
  note: { type: String, default: "" },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
