// --- FILENAME: backend/controllers/transactionController.js ---

const Transaction = require("../models/Transaction");
const Customer = require("../models/Customer");

// --- This is the ONLY function modified with the permanent fix ---
const getTransactionsByCustomer = async (req, res) => {
  try {
    const { customerName } = req.params;

    // Find the customer by name (case-insensitive)
    const customer = await Customer.findOne({ 
      user: req.user._id, 
      name: { $regex: new RegExp(`^${customerName}$`, 'i') } 
    });

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // --- FINAL ROBUST QUERY ---
    // Find all transactions linked by the correct ID OR the customer's exact name
    // This guarantees that all old and new entries will be found.
    const transactions = await Transaction.find({
      user: req.user._id,
      $or: [
        { customer: customer._id },
        { customerName: customer.name } // Use the exact name from the customer document
      ]
    }).sort({ date: -1 });
    
    // The rest of the function is the same
    res.json({ 
      balance: customer.balance, 
      transactions, 
      customerId: customer._id 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


// --- All other functions are unchanged ---
const recalculateCustomerBalance = async (customerId, userId) => {
  if (!customerId) return;
  const transactions = await Transaction.find({ customer: customerId, user: userId });
  const balance = transactions.reduce((acc, tx) => (tx.type === 'credit' ? acc + tx.amount : acc - tx.amount), 0);
  await Customer.findByIdAndUpdate(customerId, { balance });
};

const getMonthlySummary = async (req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const summary = await Transaction.aggregate([
      { $match: { user: req.user._id, date: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: "$date" }, month: { $month: "$date" } }, totalCredit: { $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0] } }, totalDebit: { $sum: { $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0] } } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);
    res.json(summary);
  } catch (err) { res.status(500).json({ message: "Server error" }); }
};

const getTransactionSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchQuery = { user: req.user._id };
    if (startDate && endDate) {
      matchQuery.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const summary = await Transaction.aggregate([
      { $match: matchQuery },
      { $group: { _id: { $ifNull: ["$customerName", "Cash Transactions"] }, balance: { $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amount", { $multiply: ["$amount", -1] }] } }, lastTransactionDate: { $max: "$date" } } },
      { $sort: { lastTransactionDate: -1 } },
      { $project: { _id: 0, customerName: "$_id", balance: "$balance", lastTransactionDate: "$lastTransactionDate" } },
    ]);
    res.json(summary);
  } catch (err) { res.status(500).json({ message: "Server error" }); }
};

const getTransactions = async (req, res) => {
  try {
    const queryFilter = { user: req.user._id };
    const { startDate, endDate } = req.query;
    if (startDate && endDate) {
      queryFilter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    const tx = await Transaction.find(queryFilter).sort({ date: -1 });
    res.json(tx);
  } catch (err) { res.status(500).json({ message: "Server error" }); }
};

const addTransaction = async (req, res) => {
  const { customerId, amount, type, note, date } = req.body;
  try {
    if (!amount || !type) return res.status(400).json({ message: "Amount and type required" });
    let customerName = "";
    if (customerId) {
      const cust = await Customer.findOne({ _id: customerId, user: req.user._id });
      if (!cust) return res.status(400).json({ message: "Invalid customer" });
      customerName = cust.name;
    }
    const tx = await Transaction.create({ user: req.user._id, customer: customerId || null, customerName, amount: Number(amount), type, note: note || "", date: date ? new Date(date) : Date.now() });
    if (customerId) {
      await recalculateCustomerBalance(customerId, req.user._id);
    }
    res.status(201).json(tx);
  } catch (err) { res.status(500).json({ message: "Server error" }); }
};

const updateTransaction = async (req, res) => {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
    if (!tx) return res.status(404).json({ message: "Transaction not found" });
    const originalCustomerId = tx.customer;
    tx.amount = req.body.amount || tx.amount;
    tx.type = req.body.type || tx.type;
    tx.note = req.body.note || tx.note;
    tx.date = req.body.date || tx.date;
    await tx.save();
    if (originalCustomerId) {
      await recalculateCustomerBalance(originalCustomerId, req.user._id);
    }
    res.json(tx);
  } catch (err) { res.status(500).json({ message: "Server error" }); }
};

const deleteTransaction = async (req, res) => {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
    if (!tx) return res.status(404).json({ message: "Transaction not found" });
    const customerId = tx.customer;
    await tx.deleteOne();
    if (customerId) {
      await recalculateCustomerBalance(customerId, req.user._id);
    }
    res.json({ message: "Transaction deleted" });
  } catch (err) { res.status(500).json({ message: "Server error" }); }
};

module.exports = { getTransactions, addTransaction, updateTransaction, deleteTransaction, getTransactionSummary, getTransactionsByCustomer, getMonthlySummary };