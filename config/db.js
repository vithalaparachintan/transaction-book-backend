const mongoose = require("mongoose");

const DEFAULT_RETRY_DELAY_MS = 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  const retryDelayMs = Number(process.env.DB_CONNECT_RETRY_MS) || DEFAULT_RETRY_DELAY_MS;
  let attempt = 0;

  if (!mongoUri) {
    throw new Error("MONGO_URI is not set");
  }

  while (true) {
    attempt += 1;
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
      });
      console.log(`✅ MongoDB connected (attempt ${attempt})`);
      return;
    } catch (err) {
      console.error(`❌ MongoDB connection error (attempt ${attempt}):`, err.message);
      console.log(`⏳ Retrying MongoDB connection in ${retryDelayMs}ms...`);
      await sleep(retryDelayMs);
    }
  }
};

module.exports = connectDB;