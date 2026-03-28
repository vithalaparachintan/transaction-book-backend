const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const {
  initiatePayment,
  verifyPayment,
  getPaymentHistory,
  getPaymentById,
  requestRefund,
  getWalletBalance,
  getPaymentStatistics,
  getAllUsers,
  addMoneyToWallet
} = require("../controllers/paymentController");

// All payment routes require authentication
router.use(protect);

// User selection for payment
router.get("/users/all", getAllUsers);

// Wallet & Balance
router.get("/balance", getWalletBalance);

// Add money (for testing)
router.post("/add-money", addMoneyToWallet);

// Payment flow
router.post("/initiate", initiatePayment);
router.post("/verify", verifyPayment);

// Payment history & details
router.get("/history", getPaymentHistory);
router.get("/:id", getPaymentById);

// Refund
router.post("/:id/refund", requestRefund);

// Statistics
router.get("/stats/summary", getPaymentStatistics);

module.exports = router;
