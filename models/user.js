const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  // Email is NOT required, but if it exists, it must be unique.
  email: { type: String, unique: true, sparse: true }, 
  // Phone is also NOT required, but must be unique if it exists.
  phone: { type: String, unique: true, sparse: true },
  password: { type: String, required: true }
}, { timestamps: true });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};


module.exports = mongoose.model("User", userSchema);