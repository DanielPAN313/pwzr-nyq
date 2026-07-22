const ORDER_STATUS = {
  PENDING_PAY: "pending_pay",
  PAID: "paid",
  OFFLINE_PAID: "offline_paid",
  PENDING_VERIFY: "pending_verify",
  VERIFIED: "verified",
  CANCELLED: "cancelled",
  REFUNDING: "refunding",
  REFUNDED: "refunded"
};

const statusAliases = {
  pending_payment: ORDER_STATUS.PENDING_PAY,
  checked_in: ORDER_STATUS.VERIFIED
};

const statusLabels = {
  [ORDER_STATUS.PENDING_PAY]: "待支付",
  [ORDER_STATUS.PAID]: "已支付",
  [ORDER_STATUS.OFFLINE_PAID]: "线下已支付",
  [ORDER_STATUS.PENDING_VERIFY]: "待核销",
  [ORDER_STATUS.VERIFIED]: "已核销",
  [ORDER_STATUS.CANCELLED]: "已取消",
  [ORDER_STATUS.REFUNDING]: "模拟退款中",
  [ORDER_STATUS.REFUNDED]: "已退款"
};

const transitions = {
  [ORDER_STATUS.PENDING_PAY]: [ORDER_STATUS.PAID, ORDER_STATUS.OFFLINE_PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]: [ORDER_STATUS.PENDING_VERIFY, ORDER_STATUS.REFUNDING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.OFFLINE_PAID]: [ORDER_STATUS.PENDING_VERIFY, ORDER_STATUS.REFUNDING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PENDING_VERIFY]: [ORDER_STATUS.VERIFIED, ORDER_STATUS.REFUNDING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.REFUNDING]: [ORDER_STATUS.REFUNDED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.VERIFIED]: [],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.REFUNDED]: []
};

function normalizeOrderStatus(status) {
  const value = String(status || "");
  return statusAliases[value] || value || ORDER_STATUS.PENDING_PAY;
}

function orderStatusLabel(status) {
  const normalized = normalizeOrderStatus(status);
  return statusLabels[normalized] || "状态待同步";
}

function canTransition(from, to) {
  const current = normalizeOrderStatus(from);
  const next = normalizeOrderStatus(to);
  return (transitions[current] || []).includes(next);
}

module.exports = {
  ORDER_STATUS,
  canTransition,
  normalizeOrderStatus,
  orderStatusLabel,
  statusAliases,
  statusLabels,
  transitions
};
