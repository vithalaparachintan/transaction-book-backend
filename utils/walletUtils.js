const crypto = require("crypto");

/**
 * WALLET UTILITIES
 * Core business logic for wallet operations
 */

/**
 * Generate unique transaction ID
 */
const generateTransactionId = () => {
  return `TXN_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};

/**
 * Calculate transaction fee (2% of amount minimum 1)
 */
const calculateFee = (amount) => {
  const fee = Math.max(amount * 0.02, 1);
  return Math.round(fee * 100) / 100; // Round to 2 decimals
};

/**
 * Calculate GST on fee (18% tax)
 */
const calculateGST = (fee) => {
  const gst = fee * 0.18;
  return Math.round(gst * 100) / 100;
};

/**
 * Validate amount
 */
const validateAmount = (amount) => {
  if (!amount || amount <= 0) {
    throw new Error("Amount must be greater than 0");
  }
  
  if (amount > 100000000) { // Max 1 crore
    throw new Error("Amount exceeds maximum limit (₹1,00,00,000)");
  }
  
  if (!Number.isFinite(amount)) {
    throw new Error("Invalid amount");
  }
};

/**
 * Format currency
 */
const formatCurrency = (amount) => {
  return `₹${(amount || 0).toFixed(2)}`;
};

/**
 * Get status text
 */
const getStatusText = (status) => {
  const statusMap = {
    initiated: "Payment Initiated",
    pending: "Pending",
    processing: "Processing",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
    refunded: "Refunded"
  };
  return statusMap[status] || status;
};

/**
 * Check if transaction can be refunded
 */
const canBeRefunded = (status) => {
  return ["completed", "processing", "pending"].includes(status);
};

/**
 * Check if wallet has sufficient balance
 */
const hasSufficientBalance = (walletBalance, amount, withFee = false) => {
  const totalAmount = withFee ? amount + calculateFee(amount) : amount;
  return walletBalance >= totalAmount;
};

/**
 * Calculate net amount after fees
 */
const calculateNetAmount = (amount) => {
  const fee = calculateFee(amount);
  return amount - fee;
};

/**
 * Validate phone number
 */
const validatePhoneNumber = (phone) => {
  const phoneRegex = /^[6-9]\d{9}$/; // Indian phone numbers
  return phoneRegex.test(phone);
};

/**
 * Validate email
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Update daily and monthly spending limits
 */
const updateSpendingLimits = (wallet, amount) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lastDate = wallet.lastSpentDate ? new Date(wallet.lastSpentDate) : null;
  lastDate?.setHours(0, 0, 0, 0);
  
  // Reset daily count if different day
  if (!lastDate || lastDate < today) {
    wallet.dailySpent = 0;
  }
  
  // Check if reset month (first day of month)
  const currentMonth = today.getMonth();
  const lastMonth = lastDate ? lastDate.getMonth() : -1;
  
  if (currentMonth !== lastMonth) {
    wallet.monthlySpent = 0;
  }
  
  wallet.dailySpent += amount;
  wallet.monthlySpent += amount;
  wallet.lastSpentDate = new Date();
  
  return wallet;
};

/**
 * Check spending limits
 */
const checkSpendingLimits = (wallet, amount) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lastDate = wallet.lastSpentDate ? new Date(wallet.lastSpentDate) : null;
  lastDate?.setHours(0, 0, 0, 0);
  
  let dailySpent = wallet.dailySpent;
  let monthlySpent = wallet.monthlySpent;
  
  // Reset if different day
  if (!lastDate || lastDate < today) {
    dailySpent = 0;
  }
  
  // Reset if different month
  const currentMonth = today.getMonth();
  const lastMonth = lastDate ? lastDate.getMonth() : -1;
  
  if (currentMonth !== lastMonth) {
    monthlySpent = 0;
  }
  
  // Check limits
  if (dailySpent + amount > wallet.dailyLimit) {
    return {
      allowed: false,
      reason: `Daily limit exceeded. Limit: ${formatCurrency(wallet.dailyLimit)}, Already spent: ${formatCurrency(dailySpent)}`
    };
  }
  
  if (monthlySpent + amount > wallet.monthlyLimit) {
    return {
      allowed: false,
      reason: `Monthly limit exceeded. Limit: ${formatCurrency(wallet.monthlyLimit)}, Already spent: ${formatCurrency(monthlySpent)}`
    };
  }
  
  return { allowed: true };
};

/**
 * Get wallet summary
 */
const getWalletSummary = (wallet) => {
  return {
    id: wallet._id,
    userId: wallet.user,
    balance: wallet.balance,
    availableBalance: wallet.availableBalance,
    pendingBalance: wallet.pendingBalance,
    status: wallet.isActive ? "active" : "inactive",
    isFrozen: wallet.isFrozen,
    kycStatus: wallet.kycStatus,
    stats: {
      totalTransactions: wallet.totalTransactions,
      totalMoneyAdded: wallet.totalMoneyAdded,
      totalMoneySpent: wallet.totalMoneySpent,
      totalMoneyReceived: wallet.totalMoneyReceived
    },
    limits: {
      dailyLimit: wallet.dailyLimit,
      dailySpent: wallet.dailySpent,
      monthlyLimit: wallet.monthlyLimit,
      monthlySpent: wallet.monthlySpent
    },
    createdAt: wallet.createdAt,
    updatedAt: wallet.updatedAt
  };
};

module.exports = {
  generateTransactionId,
  calculateFee,
  calculateGST,
  validateAmount,
  formatCurrency,
  getStatusText,
  canBeRefunded,
  hasSufficientBalance,
  calculateNetAmount,
  validatePhoneNumber,
  validateEmail,
  updateSpendingLimits,
  checkSpendingLimits,
  getWalletSummary
};
