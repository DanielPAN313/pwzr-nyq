const { get, post, request } = require("../../utils/api");

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
  const openSlots = Array.isArray(venue.open_slots) ? venue.open_slots : [];

  return {
    id: venue.id,
    name: venue.name || "未命名场馆",
    area: venue.area || "区域待定",
    status: venue.status || "",
    statusText: venue.status === "approved" ? "营业中" : "待审核",
    pricePerHour: Number(venue.price_per_hour || 0),
    contact: venue.contact || "",
    openSlotsText: openSlots.join(", ")
  };
}

function mapOrder(order, highlightedOrderId) {
  const status = order.status || "";

  return {
    id: order.id,
    anchorId: `venue-order-${order.id}`,
    title: order.title || "场地预约订单",
    venueName: order.venue_name || "场馆待定",
    username: order.username || "用户",
    status,
    statusText: statusText[status] || status || "未知状态",
    amountText: money(order.amount),
    timeText: formatTime(order.start_time || order.booking_start_time || order.create_time),
    checkinCode: order.checkin_code || "------",
    canCheckin: status === "paid" && Boolean(order.can_checkin),
    highlighted: highlightedOrderId && String(order.id) === String(highlightedOrderId)
  };
}

function mapDashboard(data, highlightedOrderId) {
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
    orders: Array.isArray(data.orders) ? data.orders.map((order) => mapOrder(order, highlightedOrderId)) : []
  };
}

Page({
  data: {
    loading: false,
    actionOrderId: "",
    highlightedOrderId: "",
    checkinCode: "",
    checkinResultText: "",
    maintenance: {
      venueId: "",
      pricePerHour: "",
      contact: "",
      openSlotsText: ""
    },
    savingVenue: false,
    application: {
      name: "",
      area: "",
      address: "",
      contact: ""
    },
    submittingVenue: false,
    error: "",
    empty: false,
    scopeText: "演示场馆",
    canMaintainVenue: false,
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
        const dashboard = mapDashboard(data || {}, this.data.highlightedOrderId);
        const canMaintainVenue = data && data.scope === "owned" && dashboard.venues.length > 0;
        const primaryVenue = canMaintainVenue ? dashboard.venues[0] : null;

        this.setData({
          loading: false,
          scopeText: data && data.scope === "owned" ? "我的场馆" : "演示场馆",
          canMaintainVenue,
          maintenance: primaryVenue
            ? {
              venueId: primaryVenue.id,
              pricePerHour: String(primaryVenue.pricePerHour || ""),
              contact: primaryVenue.contact || "",
              openSlotsText: primaryVenue.openSlotsText || ""
            }
            : this.data.maintenance,
          metrics: dashboard.metrics,
          venues: dashboard.venues,
          orders: dashboard.orders,
          empty: dashboard.orders.length === 0
        });

        if (this.data.highlightedOrderId) {
          this.scrollToOrder(this.data.highlightedOrderId);
        }
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

  onApplicationInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;

    this.setData({
      [`application.${field}`]: String(event.detail.value || "").trim()
    });
  },

  onMaintenanceInput(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;

    this.setData({
      [`maintenance.${field}`]: String(event.detail.value || "").trim()
    });
  },

  saveVenueMaintenance() {
    const maintenance = this.data.maintenance;
    if (!maintenance.venueId || this.data.savingVenue) return;

    const openSlots = String(maintenance.openSlotsText || "")
      .split(/[,\n，]/)
      .map((slot) => slot.trim())
      .filter(Boolean);

    this.setData({ savingVenue: true });

    request(`/api/sports-app/venue-admin/venues/${maintenance.venueId}`, {
      method: "PATCH",
      data: {
        price_per_hour: maintenance.pricePerHour === "" ? 0 : Number(maintenance.pricePerHour),
        contact: maintenance.contact,
        open_slots: openSlots
      },
      loadingTitle: "保存中"
    })
      .then(() => {
        wx.showToast({
          title: "已保存",
          icon: "success"
        });

        return this.loadDashboard();
      })
      .catch((error) => {
        wx.showToast({
          title: error.message || "保存失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ savingVenue: false });
      });
  },

  submitVenueApplication() {
    const application = this.data.application;
    if (!application.name || !application.address || this.data.submittingVenue) {
      wx.showToast({
        title: "请填写场馆名和地址",
        icon: "none"
      });
      return;
    }

    this.setData({ submittingVenue: true });

    post("/api/sports-app/venues", {
      name: application.name,
      area: application.area || "区域待定",
      address: application.address,
      contact: application.contact,
      sports: ["football", "basketball"],
      indoor: true,
      price_per_hour: 0,
      open_slots: []
    }, { loadingTitle: "提交中" })
      .then(() => {
        wx.showToast({
          title: "已提交入驻",
          icon: "success"
        });

        this.setData({
          application: {
            name: "",
            area: "",
            address: "",
            contact: ""
          }
        });

        return this.loadDashboard();
      })
      .catch((error) => {
        wx.showToast({
          title: error.message || "提交失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ submittingVenue: false });
      });
  },

  onCodeInput(event) {
    this.setData({
      checkinCode: String(event.detail.value || "").trim(),
      checkinResultText: ""
    });
  },

  checkinByCode() {
    const code = this.data.checkinCode;
    if (!code || this.data.actionOrderId) {
      wx.showToast({
        title: "请输入核销码",
        icon: "none"
      });
      return;
    }

    this.setData({ actionOrderId: "code" });

    post("/api/sports-app/venue-admin/checkin-code", { checkin_code: code }, { loadingTitle: "核销中" })
      .then((result) => {
        const highlightedOrderId = String(result.order_id || "");
        this.setData({
          highlightedOrderId,
          checkinCode: "",
          checkinResultText: result.already_checked_in ? "该订单此前已完成核销。" : "核销成功，已更新订单状态。"
        });

        wx.showToast({
          title: result.already_checked_in ? "已核销" : "核销成功",
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
  },

  checkinOrder(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.actionOrderId) return;

    this.setData({ actionOrderId: id, highlightedOrderId: String(id) });

    post(`/api/sports-app/venue-admin/orders/${id}/checkin`, {}, { loadingTitle: "核销中" })
      .then((result) => {
        this.setData({
          checkinResultText: result.already_checked_in ? "该订单此前已完成核销。" : "核销成功，已更新订单状态。"
        });

        wx.showToast({
          title: result.already_checked_in ? "已核销" : "核销成功",
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
  },

  scrollToOrder(id) {
    setTimeout(() => {
      wx.pageScrollTo({
        selector: `#venue-order-${id}`,
        duration: 260
      });
    }, 120);
  }
});
