
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

const User = require("./models/user");
const Customer = require("./models/Customer");
const Transaction = require("./models/Transaction");

dotenv.config();

const fixDataLinks = async () => {
  try {
    await connectDB();
    console.log("Database Connected...");

    const user = await User.findOne();
    if (!user) {
      console.error("!!! No user found. Please register a user first.");
      process.exit(1);
    }
    console.log(`-> Operating for user: ${user.name}`);

    // Step 1: Ensure all customers exist from transaction names
    const uniqueCustomerNames = await Transaction.distinct("customerName", { user: user._id, customerName: { $ne: null } });
    for (const name of uniqueCustomerNames) {
      await Customer.findOneAndUpdate(
        { name: name, user: user._id },
        { name: name, user: user._id },
        { upsert: true, new: true }
      );
    }
    console.log("-> Customer profiles are verified and created.");

    // Step 2: Create a map of all customers { name -> id }
    const allCustomers = await Customer.find({ user: user._id });
    const customerMap = new Map(allCustomers.map(c => [c.name, c._id]));
    console.log("-> Customer map created.");

    // Step 3: Loop through the map and update all transactions for each customer in bulk
    let totalUpdated = 0;
    for (const [name, id] of customerMap.entries()) {
      const result = await Transaction.updateMany(
        { user: user._id, customerName: name }, // Find all transactions with this name
        { $set: { customer: id } } // Set their customer ID link
      );
      if (result.modifiedCount > 0) {
        console.log(`-> Linked ${result.modifiedCount} transactions for customer: ${name}`);
        totalUpdated += result.modifiedCount;
      }
    }
    
    console.log(`-> Total transactions linked: ${totalUpdated}`);

    // Step 4: Recalculate the balance for every customer
    console.log("-> Recalculating all customer balances...");
    for (const customer of allCustomers) {
        await recalculateCustomerBalance(customer._id, user._id);
    }
    console.log("-> All balances are now correct.");

    console.log("\n✅ DATA IS NOW PERMANENTLY FIXED.");
    process.exit(0);

  } catch (error) {
    console.error("!!! SCRIPT FAILED:", error);
    process.exit(1);
  }
};

const recalculateCustomerBalance = async (customerId, userId) => {
    if (!customerId) return;
    const transactions = await Transaction.find({ customer: customerId, user: userId });
    const balance = transactions.reduce((acc, tx) => (tx.type === 'credit' ? acc + tx.amount : acc - tx.amount), 0);
    await Customer.findByIdAndUpdate(customerId, { balance });
};

fixDataLinks();