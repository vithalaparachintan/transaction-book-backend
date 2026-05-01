const mongoose = require("mongoose");
const Wallet = require("../models/Wallet");
const WalletTransaction = require("../models/WalletTransaction");
const User = require("../models/user");
const Customer = require("../models/Customer");
const Transaction = require("../models/Transaction");
const Payment = require("../models/Payment");
const {
  generateTransactionId,
  calculateFee,
  calculateGST,
  validateAmount,
  formatCurrency,
  hasSufficientBalance,
  calculateNetAmount,
  updateSpendingLimits,
  checkSpendingLimits,
  getWalletSummary
} = require("../utils/walletUtils");
const {
  createRazorpayOrder,
  verifyPaymentSignature,
  isMockPaymentGateway
} = require("../utils/paymentUtils");

/**
 * ============================================
 * WALLET INITIALIZATION & MANAGEMENT
 * ============================================
 */

/**
 * Initialize wallet for new user
 */
const initializeWallet = async (userId) => {
  try {
    const existingWallet = await Wallet.findOne({ user: userId });
    if (existingWallet) {
      return existingWallet;
    }

    const wallet = new Wallet({
      user: userId,
      balance: 0,
      availableBalance: 0,
      pendingBalance: 0,
      isActive: true
    });

    await wallet.save();
    console.log(`✅ Wallet initialized for user ${userId}`);
    return wallet;
  } catch (error) {
    console.error("Error initializing wallet:", error);
    throw error;
  }
};

/**
 * Get or create wallet
 */
const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });
  
  if (!wallet) {
    wallet = await initializeWallet(userId);
  }
  
  return wallet;
};

const mapTransactionStatus = (status) => {
  if (["initiated", "pending", "processing"].includes(status)) {
    return "pending";
  }
  if (status === "completed") {
    return "success";
  }
  return "failed";
};

/**
 * Get wallet details (API endpoint handler)
 */
const getWallet = async (req, res) => {
  try {
    const userId = req.user._id;
    const wallet = await getOrCreateWallet(userId);
    
    res.status(200).json({
      success: true,
      wallet: getWalletSummary(wallet)
    });
  } catch (error) {
    console.error("Error fetching wallet:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wallet",
      error: error.message
    });
  }
};

/**
 * ============================================
 * ADD MONEY (Via Payment Gateway)
 * ============================================
 */

/**
 * Initiate add money transaction
 */
const initiateAddMoney = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount, paymentMethod } = req.body;

    // Validate
    if (!amount) {
      return res.status(400).json({ success: false, message: "Amount is required" });
    }

    validateAmount(amount);

    // Get wallet
    const wallet = await getOrCreateWallet(userId);

    // Check if wallet is active
    if (!wallet.isActive || wallet.isFrozen) {
      return res.status(400).json({
        success: false,
        message: "Wallet is not active"
      });
    }

    // Create Razorpay order
    const order = await createRazorpayOrder(amount, userId, {
      type: "ADD_MONEY",
      description: `Add money to wallet - ${formatCurrency(amount)}`
    });

    // Create wallet transaction record (initiated status)
    const walletTxn = new WalletTransaction({
      user: userId,
      type: "ADD_MONEY",
      amount: amount,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance,
      status: "initiated",
      orderId: order.id,
      description: `Adding money via ${paymentMethod || "online payment"}`,
      transactionId: generateTransactionId(),
      ipAddress: req.ip,
      userAgent: req.get("user-agent")
    });

    await walletTxn.save();

    res.status(200).json({
      success: true,
      message: "Payment order created",
      order: {
        orderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID
      },
      transactionId: walletTxn.transactionId
    });
  } catch (error) {
    console.error("Error initiating add money:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initiate payment",
      error: error.message
    });
  }
};

/**
 * Unified add money endpoint.
 * - In live mode, creates order and returns verification payload.
 * - In mock mode, credits wallet immediately.
 */
const addMoney = async (req, res) => {
  let session = null;

  try {
    const userId = req.user._id;
    const { amount, paymentMethod } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, message: "Amount is required" });
    }

    validateAmount(amount);

    if (!isMockPaymentGateway) {
      return initiateAddMoney(req, res);
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const wallet = await Wallet.findOne({ user: userId }).session(session);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (!wallet.isActive || wallet.isFrozen) {
      throw new Error("Wallet is not active");
    }

    const order = await createRazorpayOrder(amount, userId, {
      type: "ADD_MONEY",
      description: `Mock add money - ${formatCurrency(amount)}`
    });

    const paymentId = `mock_pay_${Date.now()}`;
    const signature = `mock_sig_${order.id}_${paymentId}`;

    const walletTxn = new WalletTransaction({
      user: userId,
      type: "ADD_MONEY",
      amount,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance + amount,
      status: "completed",
      orderId: order.id,
      paymentId,
      razorpaySignature: signature,
      description: `Adding money via ${paymentMethod || "mock_gateway"}`,
      transactionId: generateTransactionId(),
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      completedAt: new Date()
    });

    await walletTxn.save({ session });

    wallet.balance += amount;
    wallet.availableBalance = wallet.balance - wallet.pendingBalance;
    wallet.totalMoneyAdded += amount;
    wallet.totalTransactions += 1;
    await wallet.save({ session });

    const payment = new Payment({
      sender: userId,
      receiver: userId,
      amount,
      status: "completed",
      razorpay: {
        orderId: order.id,
        paymentId,
        signature,
        method: "mock"
      },
      isPeerToPeer: false,
      transactionId: walletTxn.transactionId,
      completedAt: new Date()
    });

    await payment.save({ session });
    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Money added successfully (mock gateway)",
      wallet: getWalletSummary(wallet),
      transaction: {
        id: walletTxn._id,
        transactionId: walletTxn.transactionId,
        amount: walletTxn.amount,
        type: walletTxn.type,
        status: mapTransactionStatus(walletTxn.status),
        gatewayMode: "mock",
        createdAt: walletTxn.createdAt
      }
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }

    console.error("Error in addMoney:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add money",
      error: error.message
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

/**
 * Verify and complete add money transaction
 */
const verifyAddMoney = async (req, res) => {
  let session = null;

  try {
    const userId = req.user._id;
    const { orderId, paymentId, signature } = req.body;

    // Validate
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({
        success: false,
        message: "Order ID, Payment ID, and signature are required"
      });
    }

    // Verify signature
    const isSignatureValid = verifyPaymentSignature(orderId, paymentId, signature);

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature"
      });
    }

    // Start transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // Get wallet
    const wallet = await Wallet.findOne({ user: userId }).session(session);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    // Find wallet transaction
    const walletTxn = await WalletTransaction.findOne({
      orderId: orderId,
      user: userId
    }).session(session);

    if (!walletTxn) {
      throw new Error("Wallet transaction not found");
    }

    // Update wallet transaction
    walletTxn.status = "completed";
    walletTxn.paymentId = paymentId;
    walletTxn.razorpaySignature = signature;
    walletTxn.completedAt = new Date();
    walletTxn.balanceAfter = wallet.balance + walletTxn.amount;

    await walletTxn.save({ session });

    // Update wallet balance
    wallet.balance += walletTxn.amount;
    wallet.availableBalance = wallet.balance - wallet.pendingBalance;
    wallet.totalMoneyAdded += walletTxn.amount;
    wallet.totalTransactions += 1;

    await wallet.save({ session });

    // Create payment record
    const payment = new Payment({
      sender: userId,
      receiver: userId, // Self payment
      amount: walletTxn.amount,
      status: "completed",
      razorpay: {
        orderId: orderId,
        paymentId: paymentId,
        signature: signature,
        method: "add_money"
      },
      isPeerToPeer: false,
      transactionId: walletTxn.transactionId,
      completedAt: new Date()
    });

    await payment.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Money added successfully",
      wallet: getWalletSummary(wallet),
      transaction: {
        id: walletTxn._id,
        transactionId: walletTxn.transactionId,
        amount: walletTxn.amount,
        type: walletTxn.type,
        status: mapTransactionStatus(walletTxn.status),
        createdAt: walletTxn.createdAt
      }
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }

    console.error("Error verifying add money:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: error.message
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

/**
 * ============================================
 * SEND MONEY TO CONTACT (DIRECT - NO VERIFICATION)
 * ============================================
 * Direct instant transfer to contact without payment gateway
 * No fees charged for direct transfers
 */

/**
 * Send money directly to contact (instant, no verification needed)
 */
const sendMoneyToContact = async (req, res) => {
  let session = null;

  try {
    const userId = req.user._id;
    const { contactId, amount, note } = req.body;

    // Validate
    if (!contactId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Contact ID and amount are required"
      });
    }

    validateAmount(amount);

    // Start transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // Get wallet
    const wallet = await Wallet.findOne({ user: userId }).session(session);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    // Check if wallet is active
    if (!wallet.isActive || wallet.isFrozen) {
      throw new Error("Wallet is not active");
    }

    // Check balance (NO FEES for direct transfer to contact)
    if (!hasSufficientBalance(wallet.availableBalance, amount, false)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Required: ${formatCurrency(amount)}, Available: ${formatCurrency(wallet.availableBalance)}`
      });
    }

    // Check spending limits
    const limitCheck = checkSpendingLimits(wallet, amount);
    if (!limitCheck.allowed) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: limitCheck.reason
      });
    }

    // Get contact
    const contact = await Customer.findById(contactId).session(session);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Check if contact belongs to user
    if (contact.user.toString() !== userId.toString()) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    // Create wallet transaction (NO FEES, direct transfer)
    const walletTxn = new WalletTransaction({
      user: userId,
      type: "SEND_TO_CONTACT",
      amount: amount,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance - amount,
      contact: contactId,
      contactName: contact.name,
      status: "completed",
      description: note || `Sent money to ${contact.name}`,
      transactionId: generateTransactionId(),
      fee: 0,
      netAmount: amount,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      completedAt: new Date()
    });

    await walletTxn.save({ session });

    // Update wallet (NO FEES deducted)
    wallet.balance -= amount;
    wallet.availableBalance = wallet.balance - wallet.pendingBalance;
    wallet.totalMoneySpent += amount;
    wallet.totalTransactions += 1;
    wallet.dailySpent += amount;
    wallet.monthlySpent += amount;
    wallet.lastSpentDate = new Date();

    await wallet.save({ session });

    // User gave money, so this contact now owes more.
    contact.balance += amount;
    await contact.save({ session });

    // Create ledger transaction
    const ledgerTxn = new Transaction({
      user: userId,
      customer: contactId,
      customerName: contact.name,
      amount: amount,
      type: "credit",
      note: note || `Sent money to ${contact.name}`,
      date: new Date()
    });

    await ledgerTxn.save({ session });

    // Link wallet transaction to ledger transaction
    walletTxn.ledgerTransaction = ledgerTxn._id;
    await walletTxn.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Money sent successfully to contact",
      wallet: getWalletSummary(wallet),
      transaction: {
        id: walletTxn._id,
        transactionId: walletTxn.transactionId,
        type: walletTxn.type,
        amount: walletTxn.amount,
        contactName: contact.name,
        status: mapTransactionStatus(walletTxn.status),
        createdAt: walletTxn.createdAt
      }
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }

    console.error("Error sending money to contact:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send money",
      error: error.message
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

/**
 * ============================================
 * RECEIVE MONEY (Manual Entry)
 * ============================================
 */

/**
 * Receive money from contact (manual entry)
 */
const receiveMoneyFromContact = async (req, res) => {
  let session = null;

  try {
    const userId = req.user._id;
    const { contactId, amount, note } = req.body;

    // Validate
    if (!contactId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Contact ID and amount are required"
      });
    }

    validateAmount(amount);

    // Start transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // Get wallet
    const wallet = await Wallet.findOne({ user: userId }).session(session);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    // Get contact
    const contact = await Customer.findById(contactId).session(session);
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Check if contact belongs to user
    if (contact.user.toString() !== userId.toString()) {
      throw new Error("Unauthorized: Contact does not belong to you");
    }

    // Create wallet transaction
    const walletTxn = new WalletTransaction({
      user: userId,
      type: "RECEIVE_FROM_CONTACT",
      amount: amount,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance + amount,
      contact: contactId,
      contactName: contact.name,
      status: "completed",
      description: note || `Received money from ${contact.name}`,
      transactionId: generateTransactionId(),
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      completedAt: new Date()
    });

    await walletTxn.save({ session });

    // Update wallet
    wallet.balance += amount;
    wallet.availableBalance = wallet.balance - wallet.pendingBalance;
    wallet.totalMoneyReceived += amount;
    wallet.totalTransactions += 1;

    await wallet.save({ session });

    // User collected money, so this contact owes less.
    contact.balance -= amount;
    await contact.save({ session });

    // Create ledger transaction
    const ledgerTxn = new Transaction({
      user: userId,
      customer: contactId,
      customerName: contact.name,
      amount: amount,
      type: "debit",
      note: note || `Received money from ${contact.name}`,
      date: new Date()
    });

    await ledgerTxn.save({ session });

    // Link wallet transaction to ledger transaction
    walletTxn.ledgerTransaction = ledgerTxn._id;
    await walletTxn.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Money received successfully",
      wallet: getWalletSummary(wallet),
      transaction: {
        id: walletTxn._id,
        transactionId: walletTxn.transactionId,
        type: walletTxn.type,
        amount: walletTxn.amount,
        contactName: contact.name,
        status: mapTransactionStatus(walletTxn.status),
        createdAt: walletTxn.createdAt
      }
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
    }

    console.error("Error receiving money:", error);
    res.status(500).json({
      success: false,
      message: "Failed to receive money",
      error: error.message
    });
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

/**
 * ============================================
 * TRANSACTION HISTORY
 * ============================================
 */

/**
 * Get wallet transactions
 */
const getWalletTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const { type, status, page = 1, limit = 20, contact } = req.query;

    const filters = { user: userId };

    if (type) filters.type = type;
    if (status) filters.status = status;
    if (contact) filters.contact = contact;

    const skip = (page - 1) * limit;

    const transactions = await WalletTransaction.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("contact", "name phone")
      .lean();

    const total = await WalletTransaction.countDocuments(filters);

    res.status(200).json({
      success: true,
      transactions: transactions.map(t => ({
        id: t._id,
        transactionId: t.transactionId,
        type: t.type,
        amount: t.amount,
        fee: t.fee,
        status: mapTransactionStatus(t.status),
        internalStatus: t.status,
        description: t.description,
        contact: t.contact,
        contactName: t.contactName,
        balanceBefore: t.balanceBefore,
        balanceAfter: t.balanceAfter,
        createdAt: t.createdAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
      error: error.message
    });
  }
};

/**
 * Get contacts list for wallet flows (alias for /contacts requirement)
 */
const getWalletContacts = async (req, res) => {
  try {
    const contacts = await Customer.find({ user: req.user._id })
      .select("name phone balance createdAt updatedAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      contacts
    });
  } catch (error) {
    console.error("Error fetching wallet contacts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contacts",
      error: error.message
    });
  }
};

/**
 * Get transaction details
 */
const getTransactionDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const { transactionId } = req.params;

    const transaction = await WalletTransaction.findOne({
      _id: transactionId,
      user: userId
    })
      .populate("contact", "name phone balance")
      .populate("paymentRecord");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found"
      });
    }

    res.status(200).json({
      success: true,
      transaction
    });
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transaction details",
      error: error.message
    });
  }
};

/**
 * ============================================
 * UTILITIES
 * ============================================
 */

/**
 * Get wallet statistics
 */
const getWalletStats = async (req, res) => {
  try {
    const userId = req.user._id;

    const wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found"
      });
    }

    const stats = {
      balance: wallet.balance,
      totalTransactions: wallet.totalTransactions,
      totalMoneyAdded: wallet.totalMoneyAdded,
      totalMoneySpent: wallet.totalMoneySpent,
      totalMoneyReceived: wallet.totalMoneyReceived,
      dailySpent: wallet.dailySpent,
      dailyLimit: wallet.dailyLimit,
      monthlySpent: wallet.monthlySpent,
      monthlyLimit: wallet.monthlyLimit,
      kycStatus: wallet.kycStatus
    };

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error("Error fetching wallet stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wallet statistics",
      error: error.message
    });
  }
};

module.exports = {
  initializeWallet,
  getOrCreateWallet,
  getWallet,
  addMoney,
  initiateAddMoney,
  verifyAddMoney,
  sendMoneyToContact,
  receiveMoneyFromContact,
  getWalletContacts,
  getWalletTransactions,
  getTransactionDetails,
  getWalletStats
};
