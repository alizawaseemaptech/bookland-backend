const express = require("express");
const router = express.Router();
const {
  getProducts,
  getAllProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");
const { protect, adminOnly } = require("../middleware/auth");

router.get("/", getProducts); // public - only visible products
router.get("/admin/all", protect, adminOnly, getAllProductsAdmin);
router.post("/", protect, adminOnly, createProduct);
router.put("/:id", protect, adminOnly, updateProduct);
router.delete("/:id", protect, adminOnly, deleteProduct);

module.exports = router;
