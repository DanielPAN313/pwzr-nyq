const { get, post } = require("../../utils/api");

const fallbackOrders = [
  {
    title: "报名后会在这里生成订单",
    venueName: "宁约球",
    amountText: "¥0",
    statusText: "待同步",
    checkinCode: "------",
    hint: "当前显示本地兜底订单。",
    canPay: false,
    canCancel: false,
    canCheckin: false,
    showCheckin: false
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
  const status = order.status || "";
  const canPay = Boolean(order.can_pay);
  const canCancel = ["pending_payment", "paid"].includes(status);
  const canCheckin = Boolean(order.can_checkin);
  const showCheckin = ["paid", "checked_in"].includes(status);

  return {
    id: order.id,
    title: order.title || "场馆预订订单",
    venueName: order.venue_name || "场馆待定",
    amountText: `¥${amount}`,
    status,
    statusText: statusText[status] || status || "未知状态",
    checkinCode: order.checkin_code || "------",
    hint: order.checkin_hint || (order.can_pay ? "请完成支付后正式占位。" : "请按订单时间到场核销。"),
    timeText: formatTime(order.start_time || order.booking_start_time || order.create_time),
    canPay,
    canCancel,
    canCheckin,
    showCheckin
  };
}

Page({
  data: {
    loading: false,
    actionOrderId: "",
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
  },

  payOrder(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.actionOrderId) return;

    this.setData({ actionOrderId: id });

    post(`/api/sports-app/orders/${id}/pay`, {}, { loadingTitle: "支付中" })
      .then(() => {
        wx.showToast({
          title: "支付成功",
          icon: "success"
        });

        return this.loadOrders();
      })
      .catch((error) => {
        wx.showToast({
          title: error.message || "支付失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ actionOrderId: "" });
      });
  },

  cancelOrder(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.actionOrderId) return;

    this.setData({ actionOrderId: id });

    post(`/api/sports-app/orders/${id}/cancel`, {}, { loadingTitle: "取消中" })
      .then((result) => {
        wx.showToast({
          title: result.status === "refunded" ? "已退款" : "已取消",
          icon: "success"
        });

        return this.loadOrders();
      })
      .catch((error) => {
        wx.showToast({
          title: error.message || "取消失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ actionOrderId: "" });
      });
  },

  checkinOrder(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.actionOrderId) return;

    this.setData({ actionOrderId: id });

    post(`/api/sports-app/orders/${id}/checkin`, {}, { loadingTitle: "核销中" })
      .then(() => {
        wx.showToast({
          title: "核销成功",
          icon: "success"
        });

        return this.loadOrders();
      })
      .catch((error) => {
        wx.showToast({
          title: error.message || "核销失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ actionOrderId: "" });
      });
  }
});
