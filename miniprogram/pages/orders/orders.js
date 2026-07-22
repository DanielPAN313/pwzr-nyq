const { get, post } = require("../../utils/api");
const { setPendingPaymentCount } = require("../../utils/tab-bar-state");

const fallbackOrders = [
  {
    id: "",
    title: "报名后会在这里生成订单",
    venueName: "宁约球",
    amountText: "¥0",
    status: "local",
    statusText: "待同步",
    checkinCode: "------",
    hint: "当前显示本地兜底订单。",
    canPay: false,
    canCancel: false,
    canCheckin: false,
    canCopyCode: false
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
    timeText: formatTime(order.start_time || order.booking_start_time || order.create_time),
    canPay: Boolean(order.can_pay),
    canCancel: Boolean(order.can_cancel),
    canCheckin: Boolean(order.can_checkin),
    canCopyCode: Boolean(order.checkin_code),
    canReview: Boolean(order.game_id && ["checked_in", "review_open", "completed"].includes(order.status)),
    gameId: order.game_id,
    cancelHint: order.cancel_hint || "",
    cancelPenaltyPreview: Number(order.cancel_penalty_preview || 0)
  };
}

Page({
  data: {
    loading: false,
    error: "",
    empty: false,
    payingId: "",
    cancellingId: "",
    checkingInId: "",
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
        const pendingPaymentCount = list.filter((order) => order && order.status === "pending_payment").length;

        this.setData({
          loading: false,
          orders: list.length ? list : [],
          empty: list.length === 0
        });
        setPendingPaymentCount(pendingPaymentCount);
        if (typeof this.getTabBar === "function" && this.getTabBar() && typeof this.getTabBar().syncTabState === "function") {
          this.getTabBar().syncTabState();
        }
      })
      .catch(() => {
        this.setData({
          loading: false,
          error: "",
          empty: false,
          orders: fallbackOrders
        });
      });
  },

  goVenues() {
    wx.switchTab({ url: "/pages/venues/venues" });
  },

  goGames() {
    wx.navigateTo({ url: "/pages/games/games" });
  },

  copyCheckinCode(event) {
    const code = event.currentTarget.dataset.code;
    if (!code || code === "------") {
      wx.showToast({ title: "暂无可复制核销码", icon: "none" });
      return;
    }

    wx.setClipboardData({
      data: String(code),
      success() {
        wx.showToast({ title: "核销码已复制", icon: "success" });
      }
    });
  },

  payOrder(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.payingId) return;

    this.setData({ payingId: id });

    post(`/api/sports-app/orders/${id}/prepay`, {}, { loadingTitle: "准备支付" })
      .then((prepay) => new Promise((resolve, reject) => {
        wx.requestPayment({
          ...(prepay.pay_params || {}),
          success: resolve,
          fail: reject
        });
      }))
      .then(() => post(`/api/sports-app/orders/${id}/pay/confirm`, {}, { loadingTitle: "确认支付" }))
      .then(() => {
        wx.showToast({ title: "支付成功", icon: "success" });
        return this.loadOrders();
      })
      .catch(() => {
        wx.showToast({ title: "支付未完成，请稍后重试", icon: "none" });
      })
      .finally(() => {
        this.setData({ payingId: "" });
      });
  },

  cancelOrder(event) {
    const id = event.currentTarget.dataset.id;
    const hint = event.currentTarget.dataset.hint || "取消后名额和场地将释放。";
    if (!id || this.data.cancellingId) return;

    wx.showModal({
      title: "确认取消订单？",
      content: hint,
      confirmText: "取消订单",
      confirmColor: "#0b6f41",
      success: (result) => {
        if (!result.confirm) return;

        this.setData({ cancellingId: id });
        post(`/api/sports-app/orders/${id}/cancel`, {}, { loadingTitle: "取消中" })
          .then(() => {
            wx.showToast({ title: "订单已取消", icon: "success" });
            return this.loadOrders();
          })
          .catch(() => {
            wx.showToast({ title: "取消未完成，请稍后重试", icon: "none" });
          })
          .finally(() => {
            this.setData({ cancellingId: "" });
          });
      }
    });
  },

  checkinOrder(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.checkingInId) return;

    this.setData({ checkingInId: id });

    post(`/api/sports-app/orders/${id}/checkin`, {}, { loadingTitle: "核销中" })
      .then(() => {
        wx.showToast({ title: "核销成功", icon: "success" });
        return this.loadOrders();
      })
      .catch(() => {
        wx.showToast({ title: "暂不能核销，请稍后重试", icon: "none" });
      })
      .finally(() => {
        this.setData({ checkingInId: "" });
      });
  },

  openGameReview(event) {
    const gameId = event.currentTarget.dataset.gameId;
    if (!gameId) {
      wx.showToast({ title: "该订单暂无关联球局", icon: "none" });
      return;
    }

    wx.navigateTo({ url: `/pages/game-detail/game-detail?id=${gameId}&review=1` });
  }
});
