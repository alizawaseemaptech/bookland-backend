const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: "" },
    image: { type: String, default: "" },
    category: { type: String, required: true },
    brand: { type: String, default: "" },
    stock: { type: Number, required: true, default: 0, min: 0 },
    inStock: { type: Boolean, default: true },
    visible: { type: Boolean, default: true },
    newArrival: { type: Boolean, default: false },
    sale: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.pre("save", function (next) {
  this.inStock = this.stock > 0;
  next();
});

module.exports = mongoose.model("Product", productSchema);
