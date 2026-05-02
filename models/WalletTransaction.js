const mongoose = require("mongoose");

/**
 * WalletTransaction Schema
 * Tracks all wallet transactions (add money, send, receive, adjustments)
 */
const walletTransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  // Transaction type
  type: {
    type: String,
    enum: [
      "ADD_MONEY",              // User added money via payment gateway
      "SEND_TO_CONTACT",        // User sent money to a contact
      "RECEIVE_FROM_CONTACT",   // User received money from contact (manual entry)
      "SEND_TO_USER",           // User sent money to another user (direct transfer)
      "RECEIVE_FROM_USER",      // User received money from another user (direct transfer)
      "ADJUSTMENT",             // Admin adjustment
      "REFUND",                 // Refund from failed transaction
      "REVERSAL"                // Transaction reversal
    ],
    required: true
  },
  
  // Transaction amount
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Balance before and after
  balanceBefore: {
    type: Number,
    required: true
  },
  
  balanceAfter: {
    type: Number,
    required: true
  },
  
  // Contact involved (if applicable)
  contact: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer"
  },
  
  contactName: {
    type: String
  },
  
  // Related user (for SEND_TO_USER / RECEIVE_FROM_USER transactions)
  relatedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  
  relatedUserName: {
    type: String
  },
  
  // Linked transaction (for matching send/receive pairs)
  linkedTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "WalletTransaction"
  },
  
  // Payment gateway details (for ADD_MONEY)
  paymentId: {
    type: String
  },
  
  orderId: {
    type: String
  },
  
  razorpaySignature: {
    type: String
  },
  
  // Transaction status
  status: {
    type: String,
    enum: ["initiated", "pending", "processing", "completed", "failed", "cancelled"],
    default: "pending"
  },
  
  // Error tracking
  errorMessage: {
    type: String
  },
  
  errorCode: {
    type: String
  },
  
  // Transaction description/note
  description: {
    type: String
  },
  
  note: {
    type: String
  },
  
  // Transaction ID (unique identifier)
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },
  
  // References for linking
  relatedTransactionId: {
    type: String
  },
  
  // Related payment record
  paymentRecord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Payment"
  },
  
  // Ledger transaction reference
  ledgerTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction"
  },
  
  // Fee details
  fee: {
    type: Number,
    default: 0
  },
  
  tax: {
    type: Number,
    default: 0
  },
  
  netAmount: {
    type: Number
  },
  
  // Timestamps
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  
  completedAt: {
    type: Date
  },
  
  failedAt: {
    type: Date
  },
  
  // Metadata
  ipAddress: {
    type: String
  },
  
  userAgent: {
    type: String
  },
  
  isReversed: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Indexes for efficient queries
walletTransactionSchema.index({ user: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1, createdAt: -1 });
walletTransactionSchema.index({ status: 1 });
walletTransactionSchema.index({ transactionId: 1 });
walletTransactionSchema.index({ orderId: 1 });
walletTransactionSchema.index({ paymentId: 1 });
walletTransactionSchema.index({ contact: 1 });

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);
