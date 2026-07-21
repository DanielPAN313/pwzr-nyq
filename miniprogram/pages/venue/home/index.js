const { getStoredUser } = require("../../../utils/auth");

const PLAYER_HOME = "/pages/home/home";
const SCAN_PAGE = "/pages/venue/scan/index";

const fallbackStats = [
  { label: "今日订单", value: "5" },
  { label: "待确认", value: "2" },
  { label: "待核销", value: "3" }
];

const fallbackSchedules = [
  { id: "s1", time: "09:00", project: "五人制约场", status: "已确认", statusTone: "confirmed", people: "10人" },
  { id: "s2", time: "14:00", project: "青少年训练", status: "待确认", statusTone: "pending", people: "16人" },
  { id: "s3", time: "19:30", project: "周末球局", status: "已确认", statusTone: "confirmed", people: "12人" },
  { id: "s4", time: "21:00", project: "企业包场", status: "待确认", statusTone: "pending", people: "18人" }
];

const fallbackOrders = [
  { id: "o1", title: "周末球局 A 场", time: "7月20日 19:30", user: "张同学", people: "12人" },
  { id: "o2", title: "企业包场", time: "7月20日 21:00", user: "李先生", people: "18人" }
];

function hasVenueAdminRole(user) {
  const role = user && (user.role || user.profile?.role || user.venueRole || user.user?.role);
  return role === "venue_admin";
}

function backToPlayerHome() {
  wx.switchTab({
    url: PLAYER_HOME,
    fail() {
      wx.reLaunch({ url: PLAYER_HOME });
    }
  });
}

Page({
  data: {
    stats: fallbackStats,
    schedules: fallbackSchedules,
    pendingOrders: fallbackOrders,
    showConfirmSheet: false
  },

  onLoad() {
    this.guardVenueAdmin();
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

  returnPlayerMode() {
    backToPlayerHome();
  },

  openScanPage() {
    if (!this.guardVenueAdmin()) return;
    wx.navigateTo({ url: SCAN_PAGE });
  },

  openConfirmSheet() {
    if (!this.guardVenueAdmin()) return;
    this.setData({ showConfirmSheet: true });
  },

  closeConfirmSheet() {
    this.setData({ showConfirmSheet: false });
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

    const pendingOrders = this.data.pendingOrders.filter((order) => order.id !== id);
    this.setData({ pendingOrders });

    wx.showToast({
      title: actionText,
      icon: "none"
    });

    if (pendingOrders.length === 0) {
      this.setData({ showConfirmSheet: false });
    }
  }
});
