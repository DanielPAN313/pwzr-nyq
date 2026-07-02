const { get, post } = require("../../utils/api");

const fallbackDashboard = {
  metrics: [
    { label: "今日订单", value: "0" },
    { label: "待核销", value: "0" },
    { label: "已核销", value: "0" },
    { label: "收入", value: "¥0" }
  ],
  venues: [
    {
      id: "demo",
      name: "宁约球合作场馆",
      area: "本地演示",
      statusText: "可管理"
    }
  ],
  orders: []
};

const statusText = {
  pending_payment: "待支付",
  paid: "待到场",
  checked_in: "已核销",
  cancelled: "已取消",
  refunded: "已退款"
};

function formatTime(value) {
  if (!value) return "时间待定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day} ${hour}:${minute}`;
}

function money(value) {
  return `¥${Number(value || 0).toFixed(0)}`;
}

function mapMetric(metric) {
  return {
    label: metric.label || "",
    value: String(metric.value == null ? "" : metric.value)
  };
}

function mapVenue(venue) {
  return {
    id: venue.id,
    name: venue.name || "未命名场馆",
    area: venue.area || "区域待定",
    statusText: venue.status === "approved" ? "营业中" : "待审核"
  };
}

function mapOrder(order) {
  const status = order.status || "";

  return {
    id: order.id,
    title: order.title || "场地预约订单",
    venueName: order.venue_name || "场馆待定",
    username: order.username || "用户",
    status,
    statusText: statusText[status] || status || "未知状态",
    amountText: money(order.amount),
    timeText: formatTime(order.start_time || order.booking_start_time || order.create_time),
    checkinCode: order.checkin_code || "------",
    canCheckin: status === "paid"
  };
}

function mapDashboard(data) {
  const summary = data.summary || {};
  const revenue = Number(summary.revenue || 0);
  const metrics = Array.isArray(data.metrics) && data.metrics.length
    ? data.metrics.map(mapMetric)
    : [
      { label: "今日订单", value: String(summary.today_orders || 0) },
      { label: "待核销", value: String(summary.pending_checkins || 0) },
      { label: "已核销", value: String(summary.checked_in_orders || 0) },
      { label: "收入", value: money(revenue) }
    ];

  return {
    metrics,
    venues: Array.isArray(data.venues) ? data.venues.map(mapVenue) : [],
    orders: Array.isArray(data.orders) ? data.orders.map(mapOrder) : []
  };
}

Page({
  data: {
    loading: false,
    actionOrderId: "",
    error: "",
    empty: false,
    metrics: fallbackDashboard.metrics,
    venues: fallbackDashboard.venues,
    orders: fallbackDashboard.orders
  },

  onLoad() {
    this.loadDashboard();
  },

  onPullDownRefresh() {
    this.loadDashboard().finally(() => wx.stopPullDownRefresh());
  },

  loadDashboard() {
    this.setData({ loading: true, error: "", empty: false });

    return get("/api/sports-app/venue-admin", { showLoading: false })
      .then((data) => {
        const dashboard = mapDashboard(data || {});

        this.setData({
          loading: false,
          metrics: dashboard.metrics,
          venues: dashboard.venues,
          orders: dashboard.orders,
          empty: dashboard.orders.length === 0
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "场馆管理数据加载失败",
          empty: false,
          metrics: fallbackDashboard.metrics,
          venues: fallbackDashboard.venues,
          orders: fallbackDashboard.orders
        });
      });
  },

  checkinOrder(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.actionOrderId) return;

    this.setData({ actionOrderId: id });

    post(`/api/sports-app/venue-admin/orders/${id}/checkin`, {}, { loadingTitle: "核销中" })
      .then(() => {
        wx.showToast({
          title: "核销成功",
          icon: "success"
        });

        return this.loadDashboard();
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
