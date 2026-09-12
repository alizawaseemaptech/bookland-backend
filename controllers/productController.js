const Product = require("../models/Product");

const getProducts = async (req, res) => {
  const products = await Product.find({ visible: true }).sort({ createdAt: -1 });
  res.json(products);
};

const getAllProductsAdmin = async (req, res) => {
  const products = await Product.find().sort({ createdAt: -1 });
  res.json(products);
};

const createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteProduct = async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json({ message: "Product deleted" });
};

module.exports = { getProducts, getAllProductsAdmin, createProduct, updateProduct, deleteProduct };
