const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, required: true },
  changedAt: { type: Date, default: Date.now },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [orderItemSchema],
  total: { type: Number, required: true },
  customerName: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  paymentMethod: {
    type: String,
    enum: ["jazzcash", "easypaisa", "bank_transfer", "cod"],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed", "refunded"],
    default: "pending",
  },
  paymentReference: { type: String, default: "" },
  status: {
    type: String,
    enum: ["Pending", "Confirmed", "Processing", "Out for Delivery", "Delivered", "Cancelled"],
    default: "Pending",
  },
  riderName: { type: String, default: "" },
  statusHistory: [statusHistorySchema],
  cancelReason: { type: String, default: "" },
}, { timestamps: true });

orderSchema.pre("save", function(next) {
  if (this.isNew || this.isModified("status")) {
    this.statusHistory.push({ status: this.status, changedAt: new Date() });
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);
