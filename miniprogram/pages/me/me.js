const { get } = require("../../utils/api");
const { getStoredUser } = require("../../utils/auth");

const fallbackItems = [
  { label: "我的订单", value: "0 单", target: "/pages/orders/orders", tone: "default", hint: "查看支付、核销和取消" },
  { label: "我的球局", value: "0 场", target: "/pages/my-games/my-games", tone: "default", hint: "回看报名、到场和互评" },
  { label: "信用分", value: "100", target: "/pages/credit/credit", tone: "accent", hint: "查看自评与信用记录" },
  { label: "场馆合作", value: "联系中", target: "/pages/venue-admin/venue-admin", tone: "default", hint: "场馆端管理与核销" },
  { label: "支付与规则", value: "查看", target: "/pages/legal/legal", tone: "subtle", hint: "支付、取消、信用说明" }
];

const venueModeEntry = {
  label: "切换至场馆模式",
  subLabel: "仅场馆管理员可见",
  target: "/pages/venue-admin/venue-admin"
};

function buildStats(summary) {
  const next = summary || {};

  return [
    { label: "信用分", value: String(next.credit_score || 100), tone: "accent" },
    { label: "待核销", value: String(next.pending_checkins || 0), tone: "warning" },
    { label: "本周局", value: String(next.week_games || next.played || 0), tone: "default" }
  ];
}

function buildItems(profile) {
  const summary = profile.summary || {};
  const orders = Array.isArray(profile.orders) ? profile.orders : [];
  const pendingCheckins = Number(summary.pending_checkins || 0);

  return [
    { label: "我的订单", value: `${orders.length} 单`, target: "/pages/orders/orders", tone: "default", hint: "查看支付、核销和取消" },
    { label: "我的球局", value: `${summary.played || 0} 场`, target: "/pages/my-games/my-games", tone: "default", hint: "回看报名、到场和互评" },
    { label: "信用分", value: String(summary.credit_score || 100), target: "/pages/credit/credit", tone: "accent", hint: "查看自评与信用记录" },
    { label: "场馆合作", value: pendingCheckins > 0 ? `${pendingCheckins} 个待处理` : "联系中", target: "/pages/venue-admin/venue-admin", tone: pendingCheckins > 0 ? "warning" : "default", hint: "场馆端管理与核销" },
    { label: "支付与规则", value: "查看", target: "/pages/legal/legal", tone: "subtle", hint: "支付、取消、信用说明" }
  ];
}

function isVenueAdmin(profile, user) {
  const summary = profile.summary || {};
  const role = profile.role || profile.user?.role || summary.role || user.role || "";
  return role === "venue_admin";
}

function buildProfileHint(summary) {
  const next = summary || {};
  return `信用分 ${next.credit_score || 100}，已参与 ${next.played || 0} 场球局。`;
}

Page({
  data: {
    loading: false,
    error: "",
    profileName: "未登录用户",
    profileHint: "后续接入微信登录和用户资料。",
    profileStats: buildStats({}),
    profileTag: "开发版本体验用户",
    items: fallbackItems,
    isVenueAdmin: false,
    venueModeEntry
  },

  onLoad() {
    this.loadProfile();
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
  },

  onPullDownRefresh() {
    this.loadProfile().finally(() => wx.stopPullDownRefresh());
  },

  loadProfile() {
    this.setData({ loading: true, error: "" });

    return get("/api/sports-app/me", { showLoading: false })
      .then((profile) => {
        const user = getStoredUser() || {};
        const summary = profile.summary || {};

        this.setData({
          loading: false,
          profileName: user.nickName || summary.username || "宁约球用户",
          profileHint: buildProfileHint(summary),
          profileTag: summary.credit_score >= 90 ? "守约良好" : summary.credit_score >= 80 ? "保持良好" : "继续完成履约",
          profileStats: buildStats(summary),
          items: buildItems(profile),
          isVenueAdmin: isVenueAdmin(profile, user)
        });
      })
      .catch(() => {
        this.setData({
          loading: false,
          error: "",
          profileName: "开发版本体验用户",
          profileHint: "当前显示本地资料，联网后可自动加载真实账户。",
          profileTag: "离线预览",
          profileStats: buildStats({}),
          items: fallbackItems,
          isVenueAdmin: isVenueAdmin({}, getStoredUser() || {})
        });
      });
  },

  openMenu(event) {
    const target = event.currentTarget.dataset.target;
    if (!target) {
      wx.showToast({ title: "该功能正在接入中", icon: "none" });
      return;
    }

    wx.navigateTo({ url: target });
  },

  switchVenueMode() {
    wx.navigateTo({ url: venueModeEntry.target });
  }
});
