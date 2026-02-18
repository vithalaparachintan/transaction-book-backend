const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const {
  getAllUsers,
  sendPayment,
  getPaymentHistory,
  addMoneyToWallet,
  getWalletBalance
} = require("../controllers/paymentController");

router.get("/users", protect, getAllUsers);
router.post("/send", protect, sendPayment);
router.get("/history", protect, getPaymentHistory);
router.post("/add-money", protect, addMoneyToWallet);
router.get("/balance", protect, getWalletBalance);

module.exports = router;
