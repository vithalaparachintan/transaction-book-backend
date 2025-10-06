const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  phone: { type: String,required:true },
  balance: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model("Customer", customerSchema);