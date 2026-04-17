const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const {
  getWallet,
  initiateAddMoney,
  verifyAddMoney,
  sendMoneyToContact,
  receiveMoneyFromContact,
  getWalletTransactions,
  getTransactionDetails,
  getWalletStats
} = require("../controllers/walletController");

/**
 * All routes require authentication
 */
router.use(protect);

/**
 * Wallet Management
 */
router.get("/", getWallet); // GET /api/wallet
router.get("/stats/summary", getWalletStats); // GET /api/wallet/stats/summary

/**
 * Add Money (Payment Gateway)
 */
router.post("/add-money/initiate", initiateAddMoney); // POST /api/wallet/add-money/initiate
router.post("/add-money/verify", verifyAddMoney); // POST /api/wallet/add-money/verify

/**
 * Send Money to Contacts
 */
router.post("/send-to-contact", sendMoneyToContact); // POST /api/wallet/send-to-contact

/**
 * Receive Money from Contacts (Manual Entry)
 */
router.post("/receive-from-contact", receiveMoneyFromContact); // POST /api/wallet/receive-from-contact

/**
 * Transaction History
 */
router.get("/transactions", getWalletTransactions); // GET /api/wallet/transactions
router.get("/transactions/:transactionId", getTransactionDetails); // GET /api/wallet/transactions/:transactionId

module.exports = router;
