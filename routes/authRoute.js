const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");


const { registerUser, loginUser, changePassword, deleteAccount } = require("../controllers/authController");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.put("/change-password", protect, changePassword);
router.delete("/delete-account", protect, deleteAccount);

module.exports = router;