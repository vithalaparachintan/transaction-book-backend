const Customer = require("../models/Customer");

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(customers);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

const addCustomer = async (req, res) => {
  const { name, phone } = req.body;
  try {
    // Check for name
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Customer name is required." });
    }

    // Check for duplicate name
    const trimmedName = name.trim();
    const existingCustomer = await Customer.findOne({
      user: req.user._id,
      name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" },
    });
    if (existingCustomer) {
      return res.status(400).json({ message: `A customer named '${trimmedName}' already exists.` });
    }

    const c = await Customer.create({ user: req.user._id, name: trimmedName, phone: phone || "" });
    res.status(201).json(c);

  } catch (err) {
    console.error(err); // Log the actual error on the server
    res.status(500).json({ message: "Server error while creating customer." });
  }
};

const updateCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    const payload = { ...req.body };

    if (typeof payload.name === "string") {
      const trimmedName = payload.name.trim();
      if (!trimmedName) {
        return res.status(400).json({ message: "Customer name is required." });
      }

      const duplicate = await Customer.findOne({
        _id: { $ne: id },
        user: req.user._id,
        name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: "i" },
      });

      if (duplicate) {
        return res.status(400).json({ message: `A customer named '${trimmedName}' already exists.` });
      }

      payload.name = trimmedName;
    }

    const c = await Customer.findOneAndUpdate({ _id: id, user: req.user._id }, payload, { new: true });
    if (!c) return res.status(404).json({ message: "Customer not found" });
    res.json(c);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    const c = await Customer.findOneAndDelete({ _id: id, user: req.user._id });
    if (!c) return res.status(404).json({ message: "Customer not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// Export all the functions together at the bottom
module.exports = {
  getCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer
};