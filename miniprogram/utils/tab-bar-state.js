const STORAGE_KEY = "nyq_pending_payment_count";

function normalizeCount(value) {
  const count = Math.floor(Number(value) || 0);
  return count > 0 ? count : 0;
}

function setPendingPaymentCount(count) {
  const nextCount = normalizeCount(count);
  wx.setStorageSync(STORAGE_KEY, nextCount);
  return nextCount;
}

function getPendingPaymentCount() {
  return normalizeCount(wx.getStorageSync(STORAGE_KEY));
}

module.exports = {
  STORAGE_KEY,
  getPendingPaymentCount,
  setPendingPaymentCount
};
