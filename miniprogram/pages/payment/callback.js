const { get } = require("../../utils/api");
const { getLatestPaymentResult } = require("../../utils/payment/index");

function money(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

Page({
  data: {
    loading: true,
    success: true,
    modeText: "模拟支付",
    orderId: "",
    amountText: "¥0.00",
    payTime: "",
    syncText: "订单状态已同步"
  },

  onLoad(options) {
    const orderId = options?.orderId || "";
    const stored = getLatestPaymentResult(orderId) || {};
    this.setData({
      loading: false,
      success: options?.success !== "0",
      modeText: (options?.mode || stored.mode) === "wechat" ? "微信支付" : "模拟支付",
      orderId: orderId || stored.orderId || "",
      amountText: money(options?.amount || stored.amount),
      payTime: stored.payTime || "刚刚",
      syncText: stored.synced === false ? "本地结果已保存，联网后同步" : "订单状态已同步"
    });
    if (orderId) this.queryOrder(orderId);
  },

  queryOrder(orderId) {
    return get(`/api/sports-app/orders/${orderId}/payment-query`, { showLoading: false })
      .then((result) => this.setData({ syncText: result.status_text || "订单状态已同步" }))
      .catch(() => null);
  },

  goOrders() {
    wx.redirectTo({ url: "/pages/orders/orders" });
  },

  goHome() {
    wx.switchTab({ url: "/pages/home/home" });
  }
});
