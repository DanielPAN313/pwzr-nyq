const { getStoredUser } = require("../../../utils/auth");
const { get, post } = require("../../../utils/api");

const LOGIN_PAGE = "/pages/login/login";
const SCAN_PAGE = "/pages/venue/scan/index";
const CREATE_GAME_PAGE = "/pages/venue/create-game/index";
const TEAM_BALANCE_PAGE = "/pages/venue/team-balance/index";
const SETTINGS_PAGE = "/pages/venue/settings/index";

const fallbackStats = [
  { label: "今日收入", value: "¥680" },
  { label: "今日订单", value: "5" },
  { label: "到场率", value: "80%" }
];

const fallbackSchedules = [
  { id: "s1", time: "09:00", project: "五人制约场", typeText: "散客局", typeTone: "casual", status: "已确认", statusTone: "confirmed", people: "10人" },
  { id: "s2", time: "14:00", project: "青少年训练", typeText: "赛事局", typeTone: "event", status: "待确认", statusTone: "pending", people: "16人" },
  { id: "s3", time: "19:30", project: "周末球局", typeText: "散客局", typeTone: "casual", status: "已确认", statusTone: "confirmed", people: "12人" },
  { id: "s4", time: "21:00", project: "企业包场", typeText: "赛事局", typeTone: "event", status: "待确认", statusTone: "pending", people: "18人" }
];

const fallbackOrders = [
  { id: "o1", title: "周末球局 A 场", time: "7月20日 19:30", user: "张同学", people: "12人" },
  { id: "o2", title: "企业包场", time: "7月20日 21:00", user: "李先生", people: "18人" }
];

const fallbackGames = [
  { id: "g1", title: "周末 5v5 散客局", timeText: "19:30-21:30", signupText: "8/10", statusText: "报名中" },
  { id: "g2", title: "企业交流赛", timeText: "21:00-23:00", signupText: "12/14", statusText: "即将满员" }
];

function mapDashboard(data) {
  const summary = data.summary || {};
  const attendanceBase = Number(summary.pending_checkins || 0) + Number(summary.checked_in_orders || 0);
  const attendanceRate = attendanceBase ? Math.round((Number(summary.checked_in_orders || 0) / attendanceBase) * 100) : 0;
  const venues = Array.isArray(data.venues) ? data.venues : [];
  const orders = Array.isArray(data.orders) ? data.orders : [];
  return {
    venueName: venues[0]?.name || "卡子门足球场",
    stats: [
      { label: "今日收入", value: `¥${Number(summary.today_revenue ?? summary.revenue ?? 0).toFixed(0)}` },
      { label: "今日订单", value: String(summary.today_orders || 0) },
      { label: "到场率", value: `${Number(summary.attendance_rate ?? attendanceRate)}%` }
    ],
    pendingOrders: orders
      .filter((order) => order.status === "pending_payment")
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        title: order.title || "场地预约订单",
        time: order.start_time || order.booking_start_time || "时间待定",
        user: order.username || "球友",
        people: "1人"
      })),
    ongoingGames: Array.isArray(data.ongoing_games) && data.ongoing_games.length
      ? data.ongoing_games.map((game) => ({
        ...game,
        timeText: game.time_text || game.start_time || "时间待定",
        signupText: `${Number(game.joined_count || game.signup_count || 0)}/${Number(game.capacity || 0)}`,
        statusText: game.status === "open" ? "报名中" : "进行中"
      }))
      : fallbackGames,
    pendingMakeupCount: Number(summary.pending_makeups || 0)
  };
}

function hasVenueAdminRole(user) {
  const role = user && (user.role || user.profile?.role || user.venueRole || user.user?.role);
  return role === "venue_admin";
}

function backToPlayerHome() {
  wx.reLaunch({ url: LOGIN_PAGE });
}

Page({
  data: {
    loading: false,
    venueName: "卡子门足球场",
    stats: fallbackStats,
    schedules: fallbackSchedules,
    pendingOrders: fallbackOrders,
    allPendingOrders: fallbackOrders,
    orderKeyword: "",
    ongoingGames: fallbackGames,
    pendingMakeupCount: 2,
    showConfirmSheet: false
  },

  onLoad() {
    if (this.guardVenueAdmin()) this.loadDashboard();
  },

  onShow() {
    if (this.guardVenueAdmin()) this.loadDashboard();
  },

  guardVenueAdmin() {
    const user = getStoredUser() || {};
    if (!hasVenueAdminRole(user)) {
      backToPlayerHome();
      return false;
    }

    return true;
  },

  returnPlayerMode() {
    backToPlayerHome();
  },

  loadDashboard() {
    this.setData({ loading: true });
    return get("/api/sports-app/venue-admin", { showLoading: false })
      .then((data) => {
        const dashboard = mapDashboard(data || {});
        this.setData({ ...dashboard, allPendingOrders: dashboard.pendingOrders, loading: false });
      })
      .catch(() => this.setData({ loading: false }));
  },

  openScanPage() {
    if (!this.guardVenueAdmin()) return;
    wx.navigateTo({ url: SCAN_PAGE });
  },

  openMakeupHandling() {
    if (!this.guardVenueAdmin()) return;
    wx.navigateTo({ url: `${SCAN_PAGE}?mode=makeup` });
  },

  openCreateGame() {
    if (!this.guardVenueAdmin()) return;
    wx.navigateTo({ url: CREATE_GAME_PAGE });
  },

  openTeamBalance() {
    if (!this.guardVenueAdmin()) return;
    wx.navigateTo({ url: TEAM_BALANCE_PAGE });
  },

  openSettings() {
    if (!this.guardVenueAdmin()) return;
    wx.navigateTo({ url: SETTINGS_PAGE });
  },

  editGame(event) {
    const game = this.data.ongoingGames.find((item) => String(item.id) === String(event.currentTarget.dataset.id));
    if (!game) return;
    const signupCount = Number(game.joined_count || game.signup_count || String(game.signupText || "0").split("/")[0] || 0);
    wx.navigateTo({ url: `${CREATE_GAME_PAGE}?id=${game.id}&signupCount=${signupCount}` });
  },

  cancelGame(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: "取消球局",
      content: "取消后将通知所有已报名用户，关联订单会进入全额模拟退款。确定继续？",
      confirmText: "确认取消",
      confirmColor: "#d54d4d",
      success: (result) => {
        if (!result.confirm) return;
        post(`/api/sports-app/venue-admin/games/${id}/cancel`, {}, { loadingTitle: "取消中" })
          .then(() => this.finishCancelGame(id))
          .catch(() => this.finishCancelGame(id));
      }
    });
  },

  finishCancelGame(id) {
    this.setData({ ongoingGames: this.data.ongoingGames.filter((item) => String(item.id) !== String(id)) });
    wx.showToast({ title: "已取消并通知球员", icon: "success" });
  },

  openConfirmSheet() {
    if (!this.guardVenueAdmin()) return;
    this.setData({ showConfirmSheet: true });
  },

  closeConfirmSheet() {
    this.setData({ showConfirmSheet: false });
  },

  onOrderSearchInput(event) {
    const orderKeyword = String(event.detail.value || "").trim().toLowerCase();
    const pendingOrders = this.data.allPendingOrders.filter((order) =>
      `${order.id} ${order.user}`.toLowerCase().includes(orderKeyword)
    );
    this.setData({ orderKeyword, pendingOrders });
  },

  noop() {},

  confirmOrder(event) {
    this.finishOrder(event.currentTarget.dataset.id, "已确认");
  },

  rejectOrder(event) {
    this.finishOrder(event.currentTarget.dataset.id, "已拒绝");
  },

  finishOrder(id, actionText) {
    if (!id) return;

    const allPendingOrders = this.data.allPendingOrders.filter((order) => order.id !== id);
    const pendingOrders = this.data.pendingOrders.filter((order) => order.id !== id);
    this.setData({ pendingOrders, allPendingOrders });

    wx.showToast({
      title: actionText,
      icon: "none"
    });

    if (pendingOrders.length === 0) {
      this.setData({ showConfirmSheet: false });
    }
  }
});
