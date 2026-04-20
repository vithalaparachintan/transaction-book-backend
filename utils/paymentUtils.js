const crypto = require("crypto");
const Razorpay = require("razorpay");

const hasRazorpayConfig = Boolean(
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
);
const configuredGatewayMode = (process.env.PAYMENT_GATEWAY_MODE || "").toLowerCase();
const isMockPaymentGateway = configuredGatewayMode === "mock" || !hasRazorpayConfig;

if (isMockPaymentGateway) {
  console.warn("[Payment] Running in MOCK gateway mode. Real Razorpay charges are disabled.");
}

// Only initialize Razorpay when keys are configured and mock mode is not forced.
const razorpay = isMockPaymentGateway
  ? null
  : new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

/**
 * Create a Razorpay order for payment
 */
const createRazorpayOrder = async (amount, customerId, notes = {}) => {
  if (!amount || Number(amount) <= 0) {
    throw new Error("Amount must be greater than 0");
  }

  if (isMockPaymentGateway) {
    return {
      id: `mock_order_${Date.now()}`,
      amount: Math.round(Number(amount) * 100),
      currency: "INR",
      status: "created",
      receipt: `mock_receipt_${Date.now()}`,
      notes: {
        userId: customerId,
        ...notes
      },
      isMock: true
    };
  }

  try {
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      customer_notify: 1,
      notes: {
        userId: customerId,
        ...notes
      }
    };

    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    throw new Error(`Razorpay Order Creation Failed: ${error.message}`);
  }
};

/**
 * Verify Razorpay payment signature
 */
const verifyPaymentSignature = (orderId, paymentId, signature) => {
  if (isMockPaymentGateway) {
    const expectedSignature = `mock_sig_${orderId}_${paymentId}`;
    return signature === expectedSignature || signature === "mock_signature";
  }

  try {
    const body = orderId + "|" + paymentId;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    const isValidSignature =
      expectedSignature.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
    return isValidSignature;
  } catch (error) {
    throw new Error(`Signature Verification Failed: ${error.message}`);
  }
};

/**
 * Get payment details from Razorpay
 */
const getPaymentDetails = async (paymentId) => {
  if (isMockPaymentGateway) {
    return {
      id: paymentId,
      status: "captured",
      method: "wallet",
      card_id: null,
      card: null
    };
  }

  try {
    const payment = await razorpay.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    throw new Error(`Failed to fetch payment details: ${error.message}`);
  }
};

/**
 * Capture payment (for pre-authorized payments)
 */
const capturePayment = async (paymentId, amount) => {
  if (isMockPaymentGateway) {
    return {
      id: paymentId,
      amount: Math.round(Number(amount) * 100),
      status: "captured",
      method: "wallet"
    };
  }

  try {
    const captured = await razorpay.payments.capture(paymentId, amount);
    return captured;
  } catch (error) {
    throw new Error(`Payment Capture Failed: ${error.message}`);
  }
};

/**
 * Refund a payment
 */
const refundPayment = async (paymentId, amount = null, notes = {}) => {
  if (isMockPaymentGateway) {
    return {
      id: `mock_refund_${Date.now()}`,
      payment_id: paymentId,
      amount: amount ? Math.round(Number(amount) * 100) : null,
      status: "processed",
      notes
    };
  }

  try {
    const options = {
      notes
    };

    if (amount) {
      options.amount = Math.round(amount * 100);
    }

    const refund = await razorpay.payments.refund(paymentId, options);
    return refund;
  } catch (error) {
    throw new Error(`Refund Failed: ${error.message}`);
  }
};

/**
 * Calculate transaction fee (2% + ₹2)
 */
const calculateFee = (amount) => {
  return Math.round((amount * 0.02 + 2) * 100) / 100;
};

/**
 * Calculate GST (18% of fee)
 */
const calculateGST = (fee) => {
  return Math.round(fee * 0.18 * 100) / 100;
};

/**
 * Generate unique transaction ID
 */
const generateTransactionId = () => {
  return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

/**
 * Validate amount
 */
const validateAmount = (amount) => {
  if (!amount || typeof amount !== "number") {
    throw new Error("Invalid amount");
  }
  if (amount < 10) {
    throw new Error("Minimum amount is ₹10");
  }
  if (amount > 100000) {
    throw new Error("Maximum amount is ₹100,000");
  }
  return true;
};

/**
 * Get payment status color for UI
 */
const getStatusColor = (status) => {
  const colors = {
    initiated: "yellow",
    pending: "blue",
    processing: "cyan",
    completed: "green",
    failed: "red",
    refunded: "orange"
  };
  return colors[status] || "gray";
};

/**
 * Get payment status display text
 */
const getStatusText = (status) => {
  const texts = {
    initiated: "Payment Initiated",
    pending: "Awaiting Confirmation",
    processing: "Processing...",
    completed: "Completed",
    failed: "Failed",
    refunded: "Refunded"
  };
  return texts[status] || status;
};

module.exports = {
  createRazorpayOrder,
  verifyPaymentSignature,
  getPaymentDetails,
  capturePayment,
  refundPayment,
  calculateFee,
  calculateGST,
  generateTransactionId,
  validateAmount,
  getStatusColor,
  getStatusText,
  razorpay,
  isMockPaymentGateway,
  hasRazorpayConfig
};
