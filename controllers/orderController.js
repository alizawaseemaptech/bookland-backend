const Order = require("../models/Order");
const Product = require("../models/Product");
const Notification = require("../models/Notification");
const { sendOrderEmail } = require("../utils/sendEmail");

const createNotification = async (userId, orderId, title, message) => {
  return Notification.create({
    user: userId,
    order: orderId,
    title,
    message,
  });
};

const notifyAndEmail = async ({
  userId,
  email,
  order,
  type,
  title,
  message,
}) => {
  const results = await Promise.allSettled([
    createNotification(userId, order._id, title, message),
    sendOrderEmail(type, order, email),
  ]);

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        index === 0 ? "Notification error:" : "Email error:",
        result.reason
      );
    }
  });
};

/*
|--------------------------------------------------------------------------
| CREATE ORDER
|--------------------------------------------------------------------------
|
| Manual payment flow:
|
| JazzCash / Easypaisa / Bank Transfer
|   -> paymentStatus = pending
|   -> receipt optional
|   -> admin verifies payment
|   -> admin confirms payment
|
| COD
|   -> paymentStatus = pending
|
*/
const createOrder = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Please login before placing an order",
      });
    }

    let {
      items,
      customerName,
      phone,
      address,
      paymentMethod,
      paymentReference,
    } = req.body;

    /*
     * Because PaymentStep sends FormData,
     * items arrives as a JSON string.
     */
    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch (error) {
        return res.status(400).json({
          message: "Invalid order items",
        });
      }
    }

    if (
      !items?.length ||
      !customerName?.trim() ||
      !phone?.trim() ||
      !address?.trim() ||
      !paymentMethod
    ) {
      return res.status(400).json({
        message: "Missing required order fields",
      });
    }

    const allowedPaymentMethods = [
      "jazzcash",
      "easypaisa",
      "bank_transfer",
      "cod",
    ];

    if (!allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        message: "Invalid payment method",
      });
    }

    /*
     * Receipt is not required.
     *
     * If uploaded:
     * req.file will be available because orderRoutes.js
     * must use multer.
     */
    let paymentReceipt = {
      filename: "",
      originalName: "",
      path: "",
      uploadedAt: null,
    };

    if (req.file) {
      paymentReceipt = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: `/uploads/receipts/${req.file.filename}`,
        uploadedAt: new Date(),
      };
    }

    let total = 0;
    const orderItems = [];

    for (const i of items) {
      const product = await Product.findById(i.productId);

      if (!product) {
        return res.status(404).json({
          message: `Product "${i.name || i.productId}" not found`,
        });
      }

      const qty = Number(i.qty);

      if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({
          message: `Invalid quantity for "${product.name}"`,
        });
      }

      if (!product.inStock || product.stock < qty) {
        return res.status(400).json({
          message: `"${product.name}" is not available in requested quantity`,
        });
      }

      total += product.price * qty;

      orderItems.push({
        productId: product._id,
        name: product.name,
        qty,
        price: product.price,
      });
    }

    /*
     * IMPORTANT:
     *
     * We DO NOT mark manual payments as paid automatically.
     *
     * Even if a receipt is uploaded, admin must verify it first.
     */
    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      total,

      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim(),

      paymentMethod,

      paymentStatus: "pending",

      paymentReference: paymentReference?.trim() || "",

      paymentReceipt,

      status: "Pending",
    });

    return res.status(201).json({
      order,
      payment: null,
    });
  } catch (err) {
    console.error("createOrder:", err);

    return res.status(500).json({
      message: err.message || "Could not create order",
    });
  }
};

/*
|--------------------------------------------------------------------------
| FINALIZE / CONFIRM PAYMENT
|--------------------------------------------------------------------------
|
| This should ONLY be called after admin/gateway verification.
|
*/
const finalizeOrderAfterPayment = async (order, reference) => {
  /*
   * Prevent double confirmation.
   */
  if (order.paymentStatus === "paid") {
    return order;
  }

  order.paymentStatus = "paid";
  order.paymentReference =
    reference || order.paymentReference || "manual-confirmation";

  order.status = "Confirmed";

  /*
   * Reduce stock only after payment has been confirmed.
   */
  for (const item of order.items) {
    const product = await Product.findById(item.productId);

    if (product) {
      product.stock = Math.max(0, product.stock - item.qty);
      product.inStock = product.stock > 0;

      await product.save();
    }
  }

  await order.save();

  const User = require("../models/User");
  const user = await User.findById(order.user);

  await notifyAndEmail({
    userId: order.user,
    email: user?.email,
    order,
    type: "orderConfirmed",
    title: "Order Confirmed",
    message: `Your order #${order._id
      .toString()
      .slice(-8)
      .toUpperCase()} has been confirmed.`,
  });

  return order;
};

/*
|--------------------------------------------------------------------------
| MANUAL PAYMENT CONFIRMATION BY ADMIN
|--------------------------------------------------------------------------
*/
const confirmManualPayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("user");

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({
        message: "Payment is already confirmed",
      });
    }

    const reference =
      req.body.reference?.trim() ||
      order.paymentReference ||
      "manual-confirmation";

    await finalizeOrderAfterPayment(order, reference);

    return res.json(order);
  } catch (err) {
    console.error("confirmManualPayment:", err);

    return res.status(500).json({
      message: err.message || "Could not confirm payment",
    });
  }
};

/*
|--------------------------------------------------------------------------
| MY ORDERS
|--------------------------------------------------------------------------
*/
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    return res.json(orders);
  } catch (err) {
    return res.status(500).json({
      message: err.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET SINGLE ORDER
|--------------------------------------------------------------------------
*/
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (
      order.user.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        message: "Not authorized to view this order",
      });
    }

    return res.json(order);
  } catch (err) {
    return res.status(500).json({
      message: err.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET ALL ORDERS - ADMIN
|--------------------------------------------------------------------------
*/
const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });

    return res.json(orders);
  } catch (err) {
    return res.status(500).json({
      message: err.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE ORDER STATUS
|--------------------------------------------------------------------------
*/
const updateOrderStatus = async (req, res) => {
  try {
    const { status, riderName = "" } = req.body;

    const validStatuses = [
      "Pending",
      "Confirmed",
      "Processing",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status",
      });
    }

    const order = await Order.findById(req.params.id).populate("user");

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const previousStatus = order.status;

    if (
      status === "Out for Delivery" &&
      !String(riderName).trim()
    ) {
      return res.status(400).json({
        message: "Rider name is required for Out for Delivery",
      });
    }

    order.status = status;

    if (status === "Out for Delivery") {
      order.riderName = String(riderName).trim();
    }

    if (
      status !== "Out for Delivery" &&
      status !== "Delivered"
    ) {
      order.riderName = order.riderName || "";
    }

    await order.save();

    /*
     * Only notify when status actually changes.
     */
    if (previousStatus !== status) {
      const orderNo = `#${order._id
        .toString()
        .slice(-8)
        .toUpperCase()}`;

      if (status === "Confirmed") {
        await notifyAndEmail({
          userId: order.user._id,
          email: order.user.email,
          order,
          type: "orderConfirmed",
          title: "Order Confirmed",
          message: `Your order ${orderNo} has been confirmed.`,
        });
      } else if (status === "Out for Delivery") {
        await notifyAndEmail({
          userId: order.user._id,
          email: order.user.email,
          order,
          type: "outForDelivery",
          title: "Out for Delivery",
          message: `Your order ${orderNo} is out for delivery. Rider: ${order.riderName}.`,
        });
      } else if (status === "Delivered") {
        await notifyAndEmail({
          userId: order.user._id,
          email: order.user.email,
          order,
          type: "delivered",
          title: "Order Delivered",
          message: `Your order ${orderNo} has been delivered.`,
        });
      }
    }

    return res.json(order);
  } catch (err) {
    console.error("updateOrderStatus:", err);

    return res.status(500).json({
      message: err.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| CANCEL ORDER
|--------------------------------------------------------------------------
*/
const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("user");

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (
      order.user._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    if (["Delivered", "Cancelled"].includes(order.status)) {
      return res.status(400).json({
        message: `Order already ${order.status.toLowerCase()}, cannot cancel`,
      });
    }

    /*
     * If payment was already confirmed, restore stock.
     */
    if (order.paymentStatus === "paid") {
      for (const item of order.items) {
        const product = await Product.findById(item.productId);

        if (product) {
          product.stock += item.qty;
          product.inStock = true;

          await product.save();
        }
      }
    }

    order.status = "Cancelled";

    order.cancelReason =
      req.body.reason || "Cancelled by customer";

    if (order.paymentStatus === "paid") {
      order.paymentStatus = "refunded";
    }

    await order.save();

    await notifyAndEmail({
      userId: order.user._id,
      email: order.user.email,
      order,
      type: "cancelled",
      title: "Order Cancelled",
      message: `Order #${order._id
        .toString()
        .slice(-8)
        .toUpperCase()} has been cancelled.`,
    });

    return res.json(order);
  } catch (err) {
    console.error("cancelOrder:", err);

    return res.status(500).json({
      message: err.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| ADMIN — DELETE CUSTOMER (delete all orders for a phone number)
|--------------------------------------------------------------------------
*/
const deleteCustomer = async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone?.trim()) {
      return res.status(400).json({
        message: "Phone number is required",
      });
    }

    const result = await Order.deleteMany({ phone: phone.trim() });

    return res.json({
      message: "Customer deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("deleteCustomer:", err);

    return res.status(500).json({
      message: err.message || "Could not delete customer",
    });
  }
};

module.exports = {
  createOrder,
  confirmManualPayment,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  cancelOrder,
  deleteCustomer,
};