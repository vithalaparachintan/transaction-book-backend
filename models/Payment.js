const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  // Basic payment info
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true, min: 1 },
  
  // Payment status flow: pending -> processing -> completed/failed
  status: { 
    type: String, 
    enum: ["initiated", "pending", "processing", "completed", "failed", "refunded"], 
    default: "initiated" 
  },
  
  // Razorpay integration
  razorpay: {
    orderId: { type: String, unique: true, sparse: true },
    paymentId: { type: String, unique: true, sparse: true },
    signature: { type: String },
    method: { type: String, enum: ["card", "upi", "netbanking", "wallet", "emi", "add_money", "mock"] },
    cardDetails: {
      last4: { type: String },
      brand: { type: String },
      issuer: { type: String }
    }
  },
  
  // Fee and settlement info
  fee: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  netAmount: { type: Number }, // amount - fee
  
  // Transaction details
  note: { type: String, default: "" },
  transactionId: { type: String, unique: true, sparse: true },
  reference: { type: String },
  
  // Refund info
  refundId: { type: String },
  refundStatus: { type: String },
  refundReason: { type: String },
  
  // Timestamps
  initiatedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  failedAt: { type: Date },
  
  // Error tracking
  errorMessage: { type: String },
  errorCode: { type: String },
  
  // For P2P transfers (without gateway)
  isPeerToPeer: { type: Boolean, default: false },
  
  // Metadata
  ipAddress: { type: String },
  userAgent: { type: String }
}, { timestamps: true });

// Index for efficient queries
paymentSchema.index({ sender: 1, createdAt: -1 });
paymentSchema.index({ receiver: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ "razorpay.orderId": 1 });
paymentSchema.index({ "razorpay.paymentId": 1 });

module.exports = mongoose.model("Payment", paymentSchema);
