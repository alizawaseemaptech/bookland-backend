const crypto = require("crypto-js");

// Easypaisa (Telenor Microfinance Bank) integration
// Docs available after merchant onboarding at easypaisa.com.pk/business

const SANDBOX_URL = "https://easypaystg.easypaisa.com.pk/easypay/Index.jsf";
const LIVE_URL = "https://easypay.easypaisa.com.pk/easypay/Index.jsf";

const generateHash = (params, hashKey) => {
  const sortedKeys = Object.keys(params).sort();
  const sortedValues = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  return crypto.HmacSHA256(sortedValues, hashKey).toString(crypto.enc.Hex);
};

const buildPaymentRequest = ({ amount, orderId, description }) => {
  const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  const expiryDateStr = `${expiryDate.getFullYear()}${pad(expiryDate.getMonth() + 1)}${pad(expiryDate.getDate())} ${pad(expiryDate.getHours())}:${pad(expiryDate.getMinutes())}:${pad(expiryDate.getSeconds())}`;

  const params = {
    storeId: process.env.EASYPAISA_STORE_ID,
    amount: amount.toFixed(2),
    postBackURL: process.env.EASYPAISA_RETURN_URL,
    orderRefNum: String(orderId),
    expiryDate: expiryDateStr,
    merchantHashedReq: "",
    autoRedirect: "1",
    paymentMethod: "MA_PAYMENT_METHOD", // mobile account
    emailAddr: "",
    mobileNum: "",
  };

  const hashInput = { ...params };
  delete hashInput.merchantHashedReq;
  params.merchantHashedReq = generateHash(hashInput, process.env.EASYPAISA_HASH_KEY);

  return {
    url: process.env.EASYPAISA_ENV === "live" ? LIVE_URL : SANDBOX_URL,
    fields: params,
  };
};

const verifyCallback = (callbackParams) => {
  const isSuccess = callbackParams.status === "0000" || callbackParams.status === "SUCCESS";
  return { isSuccess, orderRefNum: callbackParams.orderRefNum };
};

module.exports = { buildPaymentRequest, verifyCallback };
