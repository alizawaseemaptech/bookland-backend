const express = require("express");
const router = express.Router();
const { jazzcashCallback, easypaisaCallback } = require("../controllers/orderController");

// These are called by JazzCash / Easypaisa servers directly (not by the frontend), so no auth middleware
//router.post("/jazzcash/callback", jazzcashCallback);
//router.post("/easypaisa/callback", easypaisaCallback);

module.exports = router;
