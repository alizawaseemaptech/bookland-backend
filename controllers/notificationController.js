const Notification = require("../models/Notification");

// GET /api/notifications — logged-in user's notifications for the bell icon
const getMyNotifications = async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30);
  const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ notifications, unreadCount });
};

// PUT /api/notifications/:id/read
const markAsRead = async (req, res) => {
  const notif = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { read: true },
    { new: true }
  );
  if (!notif) return res.status(404).json({ message: "Notification not found" });
  res.json(notif);
};

// PUT /api/notifications/read-all
const markAllAsRead = async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ message: "All notifications marked as read" });
};

module.exports = { getMyNotifications, markAsRead, markAllAsRead };
