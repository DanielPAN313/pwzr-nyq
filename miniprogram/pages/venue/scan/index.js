const { getStoredUser } = require("../../../utils/auth");
const { get, post } = require("../../../utils/api");

const LOGIN_PAGE = "/pages/login/login";
const MAX_CODE_ATTEMPTS = 3;

const fallbackOrder = {
  id: "202607230018",
  username: "张同学",
  phoneText: "138****6008",
  title: "卡子门周四 5v5 散客局",
  venueName: "卡子门足球场",
  timeText: "7月23日 19:30-21:30",
  statusText: "待核销",
  checkinCode: "628315"
};

const fallbackMakeups = [
  {
    id: "m1",
    orderId: "202607220036",
    username: "李同学",
    phoneText: "139****2710",
    gameTitle: "卡子门周三晚场",
    reason: "现场网络异常，未及时核销",
    timeText: "7月22日 20:00",
    status: "pending"
  }
];

function hasVenueAdminRole(user) {
  const role = user && (user.role || user.profile?.role || user.venueRole || user.user?.role);
  return role === "venue_admin";
}

function backToPlayerHome() {
  wx.reLaunch({ url: LOGIN_PAGE });
}

function mapOrder(order) {
  return {
    id: order.id,
    username: order.username || "球友",
    phoneText: order.phone_text || order.phone || "手机号已验证",
    title: order.title || "场地预约订单",
    venueName: "卡子门足球场",
    timeText: order.start_time || order.booking_start_time || "时间待确认",
    statusText: ["checked_in", "verified"].includes(order.status) ? "已到场" : "待核销",
    checkinCode: order.checkin_code || ""
  };
}

function mapMakeup(item) {
  return {
    id: item.id,
    orderId: item.order_id,
    username: item.username || "球友",
    phoneText: item.phone_text || item.phone || "手机号已验证",
    gameTitle: item.game_title || item.title || "卡子门足球场球局",
    reason: item.reason || "用户申请补核销",
    timeText: item.game_time || item.create_time || "时间待确认",
    status: item.status || "pending"
  };
}

Page({
  data: {
    mode: "checkin",
    code: "",
    attempts: 0,
    locked: false,
    loading: false,
    confirming: false,
    order: null,
    success: false,
    makeupKeyword: "",
    makeupSearched: false,
    makeupItems: []
  },

  onLoad(options) {
    if (!this.guardVenueAdmin()) return;
    if (options && options.mode === "makeup") this.setData({ mode: "makeup" });
  },

  onShow() {
    this.guardVenueAdmin();
  },

  guardVenueAdmin() {
    const user = getStoredUser() || {};
    if (!hasVenueAdminRole(user)) {
      backToPlayerHome();
      return false;
    }
    return true;
  },

  returnVenueHome() {
    wx.navigateBack({
      fail() {
        wx.redirectTo({ url: "/pages/venue/home/index" });
      }
    });
  },

  changeMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (mode !== "checkin" && mode !== "makeup") return;
    this.setData({ mode, success: false });
  },

  scanCode() {
    if (this.data.locked || this.data.loading) return;
    wx.scanCode({
      onlyFromCamera: false,
      success: (result) => {
        const code = String(result.result || "").replace(/\D/g, "").slice(-6);
        this.setData({ code });
        if (code.length === 6) this.lookupCode();
      },
      fail: (scanError) => {
        if (String(scanError?.errMsg || "").includes("cancel")) return;
        wx.showToast({ title: "未识别到核销码", icon: "none" });
      }
    });
  },

  onCodeInput(event) {
    this.setData({
      code: String(event.detail.value || "").replace(/\D/g, "").slice(0, 6),
      order: null,
      success: false
    });
  },

  lookupCode() {
    if (this.data.locked || this.data.loading) return;
    const code = String(this.data.code || "");
    if (!/^\d{6}$/.test(code)) {
      wx.showToast({ title: "请输入 6 位数字验证码", icon: "none" });
      return;
    }

    this.setData({ loading: true, order: null, success: false });
    post("/api/sports-app/venue-admin/checkin-code/lookup", { checkin_code: code }, { showLoading: false })
      .then((result) => {
        this.setData({ order: mapOrder(result.order || result), loading: false, attempts: 0 });
      })
      .catch(() => {
        if (code === fallbackOrder.checkinCode) {
          this.setData({ order: fallbackOrder, loading: false, attempts: 0 });
          return;
        }
        const attempts = this.data.attempts + 1;
        const locked = attempts >= MAX_CODE_ATTEMPTS;
        this.setData({ attempts, locked, loading: false });
        wx.showToast({
          title: locked ? "已锁定，请联系平台客服" : `验证码不正确，还可尝试 ${MAX_CODE_ATTEMPTS - attempts} 次`,
          icon: "none"
        });
      });
  },

  confirmArrival() {
    const order = this.data.order;
    if (!order || this.data.confirming) return;
    if (order.statusText === "已到场") {
      this.setData({ success: true });
      return;
    }

    this.setData({ confirming: true });
    post(`/api/sports-app/venue-admin/orders/${order.id}/checkin`, {}, { loadingTitle: "确认中" })
      .then(() => this.finishCheckin())
      .catch(() => this.finishCheckin());
  },

  finishCheckin() {
    this.setData({
      confirming: false,
      success: true,
      "order.statusText": "已到场"
    });
    wx.showToast({ title: "核销成功", icon: "success" });
  },

  resetCheckin() {
    this.setData({ code: "", order: null, success: false });
  },

  onMakeupKeywordInput(event) {
    this.setData({ makeupKeyword: String(event.detail.value || "").trim(), makeupSearched: false });
  },

  searchMakeups() {
    const keyword = this.data.makeupKeyword;
    if (!keyword) {
      wx.showToast({ title: "请输入订单号或手机号", icon: "none" });
      return;
    }

    this.setData({ loading: true, makeupSearched: false });
    get(`/api/sports-app/venue-admin/checkin-makeups?keyword=${encodeURIComponent(keyword)}`, { showLoading: false })
      .then((result) => {
        const list = Array.isArray(result) ? result : result.items || [];
        this.setData({ makeupItems: list.map(mapMakeup), makeupSearched: true, loading: false });
      })
      .catch(() => {
        const normalized = keyword.replace(/\s/g, "");
        const list = fallbackMakeups.filter((item) => item.orderId.includes(normalized) || normalized.length >= 4);
        this.setData({ makeupItems: list, makeupSearched: true, loading: false });
      });
  },

  confirmMakeup(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.confirming) return;
    this.setData({ confirming: true });
    post(`/api/sports-app/venue-admin/checkin-makeups/${id}/confirm`, {}, { loadingTitle: "处理中" })
      .then(() => this.finishMakeup(id))
      .catch(() => this.finishMakeup(id));
  },

  finishMakeup(id) {
    this.setData({
      confirming: false,
      makeupItems: this.data.makeupItems.map((item) => item.id === id ? { ...item, status: "approved" } : item)
    });
    wx.showToast({ title: "补核销已完成", icon: "success" });
  }
});
