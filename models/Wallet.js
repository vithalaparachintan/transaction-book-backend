const mongoose = require("mongoose");

/**
 * Wallet Schema
 * Each user has ONE wallet that stores their balance and transaction history metadata
 */
const walletSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true, 
    unique: true // One wallet per user
  },
  
  // Current balance in the wallet (in rupees)
  balance: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  
  // Available balance (after pending transactions)
  availableBalance: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  
  // Pending balance (transactions awaiting confirmation)
  pendingBalance: { 
    type: Number, 
    default: 0, 
    min: 0 
  },
  
  // Wallet kyc information
  kycStatus: {
    type: String,
    enum: ["not-started", "pending", "verified", "rejected"],
    default: "not-started"
  },
  
  // Wallet limits (to prevent abuse)
  dailyLimit: { 
    type: Number, 
    default: 100000 // Default 1 lakh per day
  },
  
  monthlyLimit: { 
    type: Number, 
    default: 1000000 // Default 10 lakhs per month
  },
  
  // Transaction counts for limits
  dailySpent: {
    type: Number,
    default: 0
  },
  
  monthlySpent: {
    type: Number,
    default: 0
  },
  
  // Last spent date (to reset daily counts)
  lastSpentDate: {
    type: Date
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isFrozen: {
    type: Boolean,
    default: false
  },
  
  // Metadata
  totalTransactions: {
    type: Number,
    default: 0
  },
  
  totalMoneyAdded: {
    type: Number,
    default: 0
  },
  
  totalMoneySpent: {
    type: Number,
    default: 0
  },
  
  totalMoneyReceived: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Index for efficient queries
walletSchema.index({ user: 1 });
walletSchema.index({ isActive: 1 });
walletSchema.index({ isFrozen: 1 });

module.exports = mongoose.model("Wallet", walletSchema);
