const express = require("express");
const dotenv = require("dotenv");

// Configure environment variables FIRST - before importing anything else
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  "PORT",
  "MONGO_URI",
  "JWT_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET"
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.error("❌ MISSING ENVIRONMENT VARIABLES:");
  missingVars.forEach(v => console.error(`   - ${v}`));
  console.error("\nSet these in Render Dashboard > Environment Variables");
  process.exit(1);
}

const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./config/db"); 

const authRoutes = require("./routes/authRoute");
const customerRoutes = require("./routes/customerRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const walletRoutes = require("./routes/walletRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/wallet", walletRoutes);

app.get("/", (req, res) => res.send("Transaction Book backend"));

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  const server = app.listen(PORT, () => {
    console.log(`✅ Backend running on http://localhost:${PORT}`);
  });

  connectDB().catch((error) => {
    console.error("Unexpected MongoDB connector failure:", error);
  });

  const shutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down server...`);
    server.close(async () => {
      try {
        await mongoose.connection.close();
      } catch (_) {}
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

startServer();