const { post } = require("../api");
const { mockPay } = require("./mock");
const { wechatPay } = require("./wechat");

const USE_MOCK = true;
const PAYMENT_RESULT_KEY = "nyq_latest_payment_result";

function storePaymentResult(result) {
  try {
    wx.setStorageSync(PAYMENT_RESULT_KEY, result);
  } catch (_error) {
    // The caller still receives the in-memory result when storage is unavailable.
  }
  return result;
}

function getLatestPaymentResult(orderId) {
  try {
    const result = wx.getStorageSync(PAYMENT_RESULT_KEY) || null;
    if (!orderId || String(result?.orderId) === String(orderId)) return result;
  } catch (_error) {
    return null;
  }
  return null;
}

function payOrder(order, options = {}) {
  const source = order || {};
  const orderId = source.orderId || source.id;
  if (!orderId) return Promise.reject(new Error("缺少订单号"));
  const useMock = options.useMock === undefined ? USE_MOCK : Boolean(options.useMock);

  return post(`/api/sports-app/orders/${orderId}/prepay`, {}, { showLoading: false })
    .catch(() => ({ ok: true, fallback: true, pay_params: null }))
    .then((prepay) => {
      const adapter = useMock ? mockPay : wechatPay;
      return adapter(source, { ...options, prepay });
    })
    .then((paymentResult) => post(`/api/sports-app/orders/${orderId}/pay/confirm`, {
      mode: paymentResult.mode,
      pay_time: paymentResult.payTime
    }, { showLoading: false })
      .then((confirmation) => ({ ...paymentResult, confirmation, synced: true }))
      .catch(() => ({ ...paymentResult, confirmation: null, synced: false })))
    .then(storePaymentResult);
}

module.exports = {
  PAYMENT_RESULT_KEY,
  USE_MOCK,
  getLatestPaymentResult,
  payOrder,
  storePaymentResult
};
