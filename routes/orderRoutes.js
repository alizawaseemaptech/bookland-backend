const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const {
  createOrder,
  confirmManualPayment,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
  deleteCustomer,
} = require("../controllers/orderController");

const { protect, adminOnly } = require("../middleware/auth");

// ============================================================
// PAYMENT RECEIPT UPLOAD
// ============================================================

const receiptDir = path.join(
  __dirname,
  "../uploads/receipts"
);

// Make sure receipts folder exists
if (!fs.existsSync(receiptDir)) {
  fs.mkdirSync(receiptDir, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, receiptDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    const safeName =
      `receipt-${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}${ext}`;

    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only JPG, PNG, WEBP or PDF receipt files are allowed."
      ),
      false
    );
  }
};

const uploadReceipt = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// ============================================================
// ADMIN — DELETE CUSTOMER (all their orders)
// ============================================================
//
// IMPORTANT:
// This must be registered before "/:id" GET route logic isn't
// affected (different HTTP method), but keep it above any
// future router.delete("/:id", ...) route if you add one, so
// Express doesn't treat "customer" as an :id param.
//

router.delete(
  "/customer/:phone",
  protect,
  adminOnly,
  deleteCustomer
);

// ============================================================
// CREATE ORDER
// ============================================================
//
// IMPORTANT:
// PaymentStep.jsx must send the file as:
//
// formData.append("paymentReceipt", receipt);
//
// This matches uploadReceipt.single("paymentReceipt")
// below.
//

router.post(
  "/",
  protect,
  uploadReceipt.single("paymentReceipt"),
  createOrder
);

// ============================================================
// CUSTOMER ORDERS
// ============================================================

router.get(
  "/my",
  protect,
  getMyOrders
);

router.get(
  "/:id",
  protect,
  getOrderById
);

// ============================================================
// CANCEL ORDER
// ============================================================

router.put(
  "/:id/cancel",
  protect,
  cancelOrder
);

// ============================================================
// ADMIN ORDERS
// ============================================================

router.get(
  "/",
  protect,
  adminOnly,
  getAllOrders
);

router.put(
  "/:id/status",
  protect,
  adminOnly,
  updateOrderStatus
);

// ============================================================
// ADMIN — CONFIRM MANUAL PAYMENT
// ============================================================

router.put(
  "/:id/confirm-manual",
  protect,
  adminOnly,
  confirmManualPayment
);

// ============================================================
// MULTER ERROR HANDLER
// ============================================================

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message:
          "Payment receipt must be smaller than 5MB.",
      });
    }

    return res.status(400).json({
      message: err.message,
    });
  }

  if (err) {
    return res.status(400).json({
      message: err.message,
    });
  }

  next();
});

module.exports = router;