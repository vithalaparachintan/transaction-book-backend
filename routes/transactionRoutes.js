
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authmiddleware");
const {
  getTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionSummary,
  getTransactionsByCustomer,
  getMonthlySummary, 
} = require("../controllers/transactionController");

router.use(protect);
router.get("/monthly-summary", getMonthlySummary);

router.get("/summary", getTransactionSummary);
router.get("/customer/:customerName", getTransactionsByCustomer);

router.route("/")
  .get(getTransactions)
  .post(addTransaction);

router.route("/:id")
  .put(updateTransaction)
  .delete(deleteTransaction);

module.exports = router;