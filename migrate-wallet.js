const mongoose = require("mongoose");
const User = require("./models/user");
require("dotenv").config();

const addWalletBalanceToExistingUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const result = await User.updateMany(
      { walletBalance: { $exists: false } },
      { $set: { walletBalance: 0 } }
    );

    console.log(`✅ Updated ${result.modifiedCount} users with walletBalance field`);
    
    await mongoose.connection.close();
    console.log("✅ Database connection closed");
  } catch (err) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
};

addWalletBalanceToExistingUsers();
