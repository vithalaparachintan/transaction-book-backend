const Payment = require("../models/Payment");
const User = require("../models/user");
const {
  createRazorpayOrder,
  verifyPaymentSignature,
  getPaymentDetails,
  refundPayment,
  calculateFee,
  calculateGST,
  generateTransactionId,
  validateAmount,
  getStatusText
} = require("../utils/paymentUtils");

/**
 * 1. INITIATE PAYMENT - Create Razorpay order
 */
const initiatePayment = async (req, res) => {
  try {
    const { receiverId, amount, note, description } = req.body;
    const senderId = req.user._id;

    // Validation
    if (!receiverId || !amount) {
      return res.status(400).json({ message: "Receiver and amount are required" });
    }

    validateAmount(amount);

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    if (senderId.toString() === receiverId.toString()) {
      return res.status(400).json({ message: "Cannot send payment to yourself" });
    }

    // Calculate fees
    const fee = calculateFee(amount);
    const tax = calculateGST(fee);
    const netAmount = amount - fee;

    // Create Razorpay order
    const order = await createRazorpayOrder(amount, senderId, {
      receiver: receiver.name,
      note: note || "Payment Transfer"
    });

    // Save payment record in pending state
    const payment = await Payment.create({
      sender: senderId,
      receiver: receiverId,
      amount,
      fee,
      tax,
      netAmount,
      note: note || description || "",
      status: "initiated",
      "razorpay.orderId": order.id,
      transactionId: generateTransactionId(),
      ipAddress: req.ip,
      userAgent: req.get("user-agent")
    });

    return res.status(201).json({
      success: true,
      message: "Payment order created successfully",
      payment: {
        _id: payment._id,
        amount,
        fee,
        tax,
        netAmount,
        receiver: receiver.name
      },
      razorpayOrder: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency
      },
      razorpayKey: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error("Payment Initiation Error:", err);
    return res.status(500).json({ message: err.message || "Payment initiation failed" });
  }
};

/**
 * 2. VERIFY PAYMENT - Verify Razorpay signature and complete payment
 */
const verifyPayment = async (req, res) => {
  try {
    const { paymentId, orderId, signature, paymentMethodId } = req.body;

    // Verify signature
    const isSignatureValid = verifyPaymentSignature(orderId, paymentId, signature);
    if (!isSignatureValid) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Find payment record
    const payment = await Payment.findOne({ "razorpay.orderId": orderId })
      .populate("receiver", "name email phone walletBalance");

    if (!payment) {
      return res.status(404).json({ message: "Payment record not found" });
    }

    // Fetch payment details from Razorpay
    const paymentDetails = await getPaymentDetails(paymentId);

    // Update payment record
    payment.status = "processing";
    payment["razorpay.paymentId"] = paymentId;
    payment["razorpay.signature"] = signature;
    payment["razorpay.method"] = paymentDetails.method;

    // Process card details if available
    if (paymentDetails.card_id) {
      payment["razorpay.cardDetails.last4"] = paymentDetails.card?.last4;
      payment["razorpay.cardDetails.brand"] = paymentDetails.card?.brand;
      payment["razorpay.cardDetails.issuer"] = paymentDetails.card?.issuer;
    }

    await payment.save();

    // Update wallet balances
    const sender = await User.findById(payment.sender);
    const receiver = await User.findById(payment.receiver._id);

    sender.walletBalance += payment.fee + payment.tax; // Deduct fee
    receiver.walletBalance += payment.netAmount; // Add net amount

    await sender.save();
    await receiver.save();

    // Mark payment as completed
    payment.status = "completed";
    payment.completedAt = new Date();
    await payment.save();

    return res.status(200).json({
      success: true,
      message: "Payment verified and completed successfully",
      payment: {
        _id: payment._id,
        transactionId: payment.transactionId,
        amount: payment.amount,
        fee: payment.fee,
        tax: payment.tax,
        receiver: payment.receiver.name,
        status: "completed",
        completedAt: payment.completedAt
      }
    });
  } catch (err) {
    console.error("Payment Verification Error:", err);
    
    // Update payment as failed
    const payment = await Payment.findOne({ "razorpay.orderId": req.body.orderId });
    if (payment) {
      payment.status = "failed";
      payment.errorMessage = err.message;
      payment.failedAt = new Date();
      await payment.save();
    }

    return res.status(500).json({ message: err.message || "Payment verification failed" });
  }
};

/**
 * 3. GET PAYMENT HISTORY
 */
const getPaymentHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const payments = await Payment.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }]
    })
      .populate("sender", "name email phone")
      .populate("receiver", "name email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }]
    });

    return res.status(200).json({
      success: true,
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("Payment History Error:", err);
    return res.status(500).json({ message: "Failed to fetch payment history" });
  }
};

/**
 * 4. GET PAYMENT DETAILS
 */
const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("sender", "name email phone")
      .populate("receiver", "name email phone");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Check authorization
    if (
      payment.sender._id.toString() !== req.user._id.toString() &&
      payment.receiver._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "Not authorized to view this payment" });
    }

    return res.status(200).json({
      success: true,
      payment: {
        ...payment.toObject(),
        statusText: getStatusText(payment.status)
      }
    });
  } catch (err) {
    console.error("Get Payment Error:", err);
    return res.status(500).json({ message: "Failed to fetch payment details" });
  }
};

/**
 * 5. REFUND PAYMENT
 */
const requestRefund = async (req, res) => {
  try {
    const { paymentId, reason } = req.body;

    const payment = await Payment.findById(paymentId)
      .populate("receiver", "name email");

    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Check authorization
    if (payment.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only sender can request refund" });
    }

    if (payment.status !== "completed") {
      return res.status(400).json({ message: "Can only refund completed payments" });
    }

    // Process refund through Razorpay
    const refund = await refundPayment(payment["razorpay.paymentId"], payment.amount, {
      reason: reason || "User requested refund"
    });

    // Update payment and wallet
    payment.status = "refunded";
    payment.refundId = refund.id;
    payment.refundStatus = refund.status;
    payment.refundReason = reason || "User requested refund";

    await payment.save();

    // Reverse wallet transactions
    const sender = await User.findById(payment.sender);
    const receiver = await User.findById(payment.receiver._id);

    sender.walletBalance -= payment.fee + payment.tax;
    receiver.walletBalance -= payment.netAmount;

    await sender.save();
    await receiver.save();

    return res.status(200).json({
      success: true,
      message: "Refund processed successfully",
      refund: {
        refundId: refund.id,
        status: refund.status,
        amount: payment.amount
      }
    });
  } catch (err) {
    console.error("Refund Error:", err);
    return res.status(500).json({ message: err.message || "Refund processing failed" });
  }
};

/**
 * 6. GET WALLET BALANCE
 */
const getWalletBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("walletBalance");

    return res.status(200).json({
      success: true,
      balance: user.walletBalance
    });
  } catch (err) {
    console.error("Wallet Balance Error:", err);
    return res.status(500).json({ message: "Failed to fetch wallet balance" });
  }
};

/**
 * 7. GET PAYMENT STATISTICS
 */
const getPaymentStatistics = async (req, res) => {
  try {
    const userId = req.user._id;

    // Total sent
    const sentPayments = await Payment.aggregate([
      {
        $match: {
          sender: userId,
          status: "completed"
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          totalFees: { $sum: "$fee" }
        }
      }
    ]);

    // Total received
    const receivedPayments = await Payment.aggregate([
      {
        $match: {
          receiver: userId,
          status: "completed"
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$netAmount" },
          count: { $sum: 1 }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      statistics: {
        sent: sentPayments[0] || { totalAmount: 0, count: 0, totalFees: 0 },
        received: receivedPayments[0] || { totalAmount: 0, count: 0 }
      }
    });
  } catch (err) {
    console.error("Statistics Error:", err);
    return res.status(500).json({ message: "Failed to fetch statistics" });
  }
};

/**
 * 8. GET ALL USERS (for payment recipient selection)
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select("name email phone walletBalance")
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      users
    });
  } catch (err) {
    console.error("Get Users Error:", err);
    return res.status(500).json({ message: "Failed to fetch users" });
  }
};

module.exports = {
  initiatePayment,
  verifyPayment,
  getPaymentHistory,
  getPaymentById,
  requestRefund,
  getWalletBalance,
  getPaymentStatistics,
  getAllUsers
};
