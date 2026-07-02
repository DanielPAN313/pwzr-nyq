const { get } = require("../../utils/api");
const { getStoredUser } = require("../../utils/auth");

const fallbackItems = [
  { label: "我的订单", value: "0", target: "/pages/orders/orders" },
  { label: "我的球局", value: "0", target: "/pages/my-games/my-games" },
  { label: "信用分", value: "100", target: "/pages/credit/credit" },
  { label: "场馆管理", value: "演示", target: "/pages/venue-admin/venue-admin" }
];

const fallbackStatCards = [
  { label: "待支付", value: "0", tone: "warning" },
  { label: "已参与", value: "0", tone: "success" },
  { label: "信用分", value: "100", tone: "info" }
];

function countOrders(orders, status) {
  return orders.filter((order) => order.status === status).length;
}

function buildStatCards(profile) {
  const summary = profile.summary || {};
  const orders = Array.isArray(profile.orders) ? profile.orders : [];

  return [
    { label: "待支付", value: String(countOrders(orders, "pending_payment")), tone: "warning" },
    { label: "已参与", value: String(summary.played || 0), tone: "success" },
    { label: "信用分", value: String(summary.credit_score || 100), tone: "info" }
  ];
}

function buildMenuSections(profile) {
  const summary = profile.summary || {};
  const orders = Array.isArray(profile.orders) ? profile.orders : [];
  const pendingPayment = countOrders(orders, "pending_payment");
  const activeOrders = orders.filter((order) => ["pending_payment", "paid"].includes(order.status)).length;

  return [
    {
      title: "用户中心",
      items: [
        { label: "我的订单", value: activeOrders ? `${activeOrders} 个进行中` : `${orders.length} 个订单`, hint: pendingPayment ? `${pendingPayment} 个待支付` : "查看支付、核销和退款状态", target: "/pages/orders/orders" },
        { label: "我的球局", value: `${summary.played || 0} 场`, hint: "查看已报名和已完成球局", target: "/pages/my-games/my-games" },
        { label: "信用分", value: String(summary.credit_score || 100), hint: `${summary.no_shows || 0} 次爽约记录`, target: "/pages/credit/credit" }
      ]
    },
    {
      title: "场馆与履约",
      items: [
        { label: "场馆管理", value: "进入", hint: "申请入驻、维护时段、核销订单", target: "/pages/venue-admin/venue-admin" },
        { label: "已核销", value: `${summary.checked_in || 0} 次`, hint: "已完成到场确认的球局记录", target: "/pages/credit/credit" }
      ]
    }
  ];
}

Page({
  data: {
    loading: false,
    error: "",
    profileName: "未登录用户",
    profileHint: "后续接入微信登录和用户资料。",
    statCards: fallbackStatCards,
    menuSections: [{ title: "快捷入口", items: fallbackItems }]
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
          statCards: buildStatCards(profile),
          menuSections: buildMenuSections(profile)
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "我的数据加载失败",
          profileName: "开发版体验用户",
          profileHint: "当前显示本地兜底资料。",
          statCards: fallbackStatCards,
          menuSections: [{ title: "快捷入口", items: fallbackItems }]
        });
      });
  },

  openMenu(event) {
    const target = event.currentTarget.dataset.target;
    if (!target) return;

    wx.navigateTo({ url: target });
  }
});
