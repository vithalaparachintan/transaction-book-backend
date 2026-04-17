/**
 * MIGRATION SCRIPT: Initialize Wallets for Existing Users
 * 
 * Run this script once to initialize wallets for all existing users:
 * node migrate-wallets.js
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Wallet = require("./models/Wallet");
const User = require("./models/user");

dotenv.config();

const migrateWallets = async () => {
  try {
    console.log("🔄 Starting wallet migration...");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Find all users without a wallet
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      const existingWallet = await Wallet.findOne({ user: user._id });

      if (existingWallet) {
        skippedCount++;
        console.log(`⏭️  Wallet already exists for user: ${user.name}`);
        continue;
      }

      // Create wallet for user
      const wallet = new Wallet({
        user: user._id,
        balance: 0,
        availableBalance: 0,
        pendingBalance: 0,
        isActive: true
      });

      await wallet.save();
      createdCount++;
      console.log(`✅ Wallet created for user: ${user.name}`);
    }

    console.log(`\n📈 Migration Summary:`);
    console.log(`   Created: ${createdCount} wallets`);
    console.log(`   Skipped: ${skippedCount} wallets (already existed)`);
    console.log(`   Total: ${createdCount + skippedCount} users processed`);

    await mongoose.connection.close();
    console.log("✅ Wallet migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
};

migrateWallets();
