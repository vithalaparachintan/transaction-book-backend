const express = require("express");
const router = express.Router();


const { protect } = require("../middleware/authmiddleware");
const { 
  getCustomers, 
  addCustomer, 
  updateCustomer, 
  deleteCustomer 
} = require("../controllers/customerController");

// Apply the 'protect' middleware to all routes in this file
router.use(protect);

// Define the routes
router.route("/")
  .get(getCustomers)
  .post(addCustomer);

router.route("/:id")
  .put(updateCustomer)
  .delete(deleteCustomer);

module.exports = router;