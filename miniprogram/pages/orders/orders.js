const { get } = require("../../utils/api");

const fallbackOrders = [
  {
    title: "报名后会在这里生成订单",
    venueName: "宁约球",
    amountText: "¥0",
    statusText: "待同步",
    checkinCode: "------",
    hint: "当前显示本地兜底订单。"
  }
];

const statusText = {
  pending_payment: "待支付",
  paid: "已支付",
  checked_in: "已核销",
  cancelled: "已取消",
  refunded: "已退款"
};

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day} ${hour}:${minute}`;
}

function mapOrder(order) {
  const amount = Number(order.amount || 0);

  return {
    id: order.id,
    title: order.title || "场馆预订订单",
    venueName: order.venue_name || "场馆待定",
    amountText: `¥${amount}`,
    status: order.status,
    statusText: statusText[order.status] || order.status || "未知状态",
    checkinCode: order.checkin_code || "------",
    hint: order.checkin_hint || (order.can_pay ? "请完成支付后正式占位。" : "请按订单时间到场核销。"),
    timeText: formatTime(order.start_time || order.booking_start_time || order.create_time)
  };
}

Page({
  data: {
    loading: false,
    error: "",
    empty: false,
    orders: fallbackOrders
  },

  onLoad() {
    this.loadOrders();
  },

  onPullDownRefresh() {
    this.loadOrders().finally(() => wx.stopPullDownRefresh());
  },

  loadOrders() {
    this.setData({ loading: true, error: "", empty: false });

    return get("/api/sports-app/orders", { showLoading: false })
      .then((orders) => {
        const list = Array.isArray(orders) ? orders.map(mapOrder) : [];

        this.setData({
          loading: false,
          orders: list.length ? list : [],
          empty: list.length === 0
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "订单数据加载失败",
          empty: false,
          orders: fallbackOrders
        });
      });
  }
});
