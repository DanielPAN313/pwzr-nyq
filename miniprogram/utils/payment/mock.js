const { getVenuePaymentConfig } = require("./venue-config");

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(delayMs || 0))));
}

function mockPay(order, options = {}) {
  const source = order || {};
  const venueId = source.venueId || source.venue_id || "kazimen";
  const venueConfig = getVenuePaymentConfig(venueId);
  const delayMs = options.delayMs === undefined ? 1000 : options.delayMs;

  return wait(delayMs).then(() => ({
    success: true,
    mode: "mock",
    orderId: source.orderId || source.id || "",
    payTime: new Date().toISOString(),
    amount: Number(source.amount || 0),
    venueId,
    matchId: source.matchId || source.gameId || source.game_id || "",
    transactionId: "",
    merchantId: venueConfig.merchantId || ""
  }));
}

module.exports = {
  mockPay
};
