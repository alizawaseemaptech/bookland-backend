const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.EMAIL_PORT || 465),
  secure: String(process.env.EMAIL_SECURE || "true") === "true",

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const orderNumber = (order) =>
  `#${order._id.toString().slice(-8).toUpperCase()}`;

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const sendOrderEmail = async (
  type,
  order,
  recipient
) => {
  if (!recipient) return;

  if (
    !process.env.EMAIL_USER ||
    !process.env.EMAIL_PASS
  ) {
    throw new Error(
      "EMAIL_USER / EMAIL_PASS are not configured"
    );
  }

  const riderLine = order.riderName
    ? `<p><strong>Rider:</strong> ${escapeHtml(
        order.riderName
      )}</p>`
    : "";

  const content = {
    orderConfirmed: {
      subject: `Your Book Land order ${orderNumber(
        order
      )} is confirmed`,
      heading: "Your order is confirmed",
      message: `Your Book Land order ${orderNumber(
        order
      )} has been confirmed and is being prepared.`,
    },

    outForDelivery: {
      subject: `Your Book Land order ${orderNumber(
        order
      )} is out for delivery`,
      heading: "Your order is out for delivery",
      message: `Your Book Land order ${orderNumber(
        order
      )} is on the way to you.`,
    },

    delivered: {
      subject: `Your Book Land order ${orderNumber(
        order
      )} is delivered`,
      heading: "Your order is delivered",
      message: `Your Book Land order ${orderNumber(
        order
      )} has been delivered. Thank you for shopping with us!`,
    },

    cancelled: {
      subject: `Your Book Land order ${orderNumber(
        order
      )} was cancelled`,
      heading: "Your order was cancelled",
      message: `Your Book Land order ${orderNumber(
        order
      )} has been cancelled.`,
    },
  }[type];

  if (!content) {
    throw new Error(
      `Unknown order email type: ${type}`
    );
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(content.heading)}</title>
</head>

<body style="margin:0;padding:0;background:#f5f5f5;">
  <div style="
    max-width:600px;
    margin:30px auto;
    padding:30px;
    background:#ffffff;
    font-family:Arial,Helvetica,sans-serif;
    line-height:1.6;
    color:#222;
  ">

    <h2 style="margin-top:0;">
      ${escapeHtml(content.heading)}
    </h2>

    <p>
      ${escapeHtml(content.message)}
    </p>

    ${riderLine}

    <p>
      <strong>Order:</strong>
      ${escapeHtml(orderNumber(order))}
    </p>

    <p>
      <strong>Total:</strong>
      Rs. ${Number(order.total).toLocaleString()}
    </p>

    <p style="color:#777;">
      Book Land — Stationery · Toys · Gifts & More
    </p>

  </div>
</body>
</html>
`;

  const text = [
    content.heading,
    "",
    content.message,
    `Order: ${orderNumber(order)}`,
    order.riderName
      ? `Rider: ${order.riderName}`
      : "",
    `Total: Rs. ${Number(order.total).toLocaleString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  return transporter.sendMail({
    from:
      process.env.EMAIL_FROM ||
      `Book Land <${process.env.EMAIL_USER}>`,

    to: recipient,

    subject: content.subject,

    text,

    html,

    replyTo:
      process.env.EMAIL_REPLY_TO ||
      process.env.EMAIL_USER,

    headers: {
      "X-Mailer": "Book Land Order System",
      "X-Auto-Response-Suppress": "All",
    },
  });
};

module.exports = {
  sendOrderEmail,
};