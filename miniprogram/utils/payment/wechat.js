function requestWechatPayment(payParams) {
  return new Promise((resolve, reject) => {
    wx.requestPayment({
      ...(payParams || {}),
      success: resolve,
      fail: reject
    });
  });
}

function wechatPay(order, options = {}) {
  const source = order || {};
  const prepay = options.prepay || {};
  if (!prepay.pay_params) return Promise.reject(new Error("微信支付参数未配置"));

  // TODO: 正式启用前，后端必须完成商户签名、支付回调验签和订单查询。
  return requestWechatPayment(prepay.pay_params).then((result) => ({
    success: true,
    mode: "wechat",
    orderId: source.orderId || source.id || "",
    payTime: new Date().toISOString(),
    amount: Number(source.amount || 0),
    venueId: source.venueId || source.venue_id || "",
    matchId: source.matchId || source.gameId || source.game_id || "",
    transactionId: result.transactionId || "",
    merchantId: prepay.merchant_id || ""
  }));
}

module.exports = {
  requestWechatPayment,
  wechatPay
};
