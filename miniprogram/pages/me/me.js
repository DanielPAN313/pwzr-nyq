const { get } = require("../../utils/api");
const { getStoredUser } = require("../../utils/auth");

const fallbackItems = [
  { label: "我的订单", value: "0" },
  { label: "我的球局", value: "0" },
  { label: "信用分", value: "100" },
  { label: "场馆合作", value: "联系中" }
];

function buildItems(profile) {
  const summary = profile.summary || {};
  const orders = Array.isArray(profile.orders) ? profile.orders : [];

  return [
    { label: "我的订单", value: String(orders.length) },
    { label: "我的球局", value: String(summary.played || 0) },
    { label: "信用分", value: String(summary.credit_score || 100) },
    { label: "已核销", value: String(summary.checked_in || 0) }
  ];
}

Page({
  data: {
    loading: false,
    error: "",
    profileName: "未登录用户",
    profileHint: "后续接入微信登录和用户资料。",
    items: fallbackItems
  },

  onLoad() {
    this.loadProfile();
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
          profileHint: `信用分 ${summary.credit_score || 100}，已参与 ${summary.played || 0} 场球局。`,
          items: buildItems(profile)
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "我的数据加载失败",
          profileName: "开发版体验用户",
          profileHint: "当前显示本地兜底资料。",
          items: fallbackItems
        });
      });
  }
});
