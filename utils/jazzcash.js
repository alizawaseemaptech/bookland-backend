const crypto = require("crypto-js");
const axios = require("axios");

// JazzCash Mobile Wallet / Payment Page integration (HMAC-SHA256 signature based)
// Docs: https://developer.jazzcash.com.pk (sandbox + production endpoints differ)

const SANDBOX_URL = "https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/";
const LIVE_URL = "https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/";

const getTimestamps = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const txnDateTime = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const expiry = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
  const txnExpiryDateTime = `${expiry.getFullYear()}${pad(expiry.getMonth() + 1)}${pad(expiry.getDate())}${pad(expiry.getHours())}${pad(expiry.getMinutes())}${pad(expiry.getSeconds())}`;
  return { txnDateTime, txnExpiryDateTime };
};

const generateHash = (params, integritySalt) => {
  // JazzCash requires fields sorted alphabetically, concatenated with "&", salt prefixed
  const sortedKeys = Object.keys(params).sort();
  const sortedValues = sortedKeys.map((k) => params[k]).join("&");
  const hashString = `${integritySalt}&${sortedValues}`;
  return crypto.HmacSHA256(hashString, integritySalt).toString(crypto.enc.Hex);
};

// Builds the payload the frontend needs to POST (as a hidden auto-submit form) to JazzCash's page
const buildPaymentRequest = ({ amount, billReference, description, orderId }) => {
  const { txnDateTime, txnExpiryDateTime } = getTimestamps();
  const amountInPaisa = Math.round(amount * 100); // JazzCash expects amount in paisa, no decimals

  const params = {
    pp_Version: "1.1",
    pp_TxnType: "MWALLET",
    pp_Language: "EN",
    pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID,
    pp_Password: process.env.JAZZCASH_PASSWORD,
    pp_TxnRefNo: `T${orderId}`,
    pp_Amount: String(amountInPaisa),
    pp_TxnCurrency: "PKR",
    pp_TxnDateTime: txnDateTime,
    pp_BillReference: billReference || orderId,
    pp_Description: description || "Book Land Order Payment",
    pp_TxnExpiryDateTime: txnExpiryDateTime,
    pp_ReturnURL: process.env.JAZZCASH_RETURN_URL,
    ppmpf_1: "1",
  };

  params.pp_SecureHash = generateHash(params, process.env.JAZZCASH_HASH_KEY);

  return {
    url: process.env.JAZZCASH_ENV === "live" ? LIVE_URL : SANDBOX_URL,
    fields: params,
  };
};

// Verifies the callback JazzCash sends back after payment
const verifyCallback = (callbackParams) => {
  const receivedHash = callbackParams.pp_SecureHash;
  const paramsForHash = { ...callbackParams };
  delete paramsForHash.pp_SecureHash;
  const expectedHash = generateHash(paramsForHash, process.env.JAZZCASH_HASH_KEY);
  const isValid = receivedHash === expectedHash;
  const isSuccess = callbackParams.pp_ResponseCode === "000";
  return { isValid, isSuccess, txnRefNo: callbackParams.pp_TxnRefNo };
};

module.exports = { buildPaymentRequest, verifyCallback };
