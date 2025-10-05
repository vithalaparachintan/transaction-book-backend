const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db"); 

const authRoutes = require("./routes/authRoute");
const customerRoutes = require("./routes/customerRoutes");
const transactionRoutes = require("./routes/transactionRoutes");

// Configure environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/transactions", transactionRoutes);

app.get("/", (req, res) => res.send("Transaction Book backend"));

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));
  } catch (error) {
    console.error("Failed to connect to the database. Server did not start.", error);
    process.exit(1); 
  }
};

startServer();