const { get } = require("../../utils/api");

const fallbackSummary = "这里会从旧 H5 原型迁移真实首页数据、推荐场馆、今日球局和订单提醒。";

Page({
  data: {
    loading: false,
    error: "",
    summary: fallbackSummary,
    quickActions: [
      { label: "订场", target: "/pages/venues/venues" },
      { label: "找球局", target: "/pages/games/games" },
      { label: "消息", target: "/pages/messages/messages" },
      { label: "我的", target: "/pages/me/me" }
    ]
  },

  onLoad() {
    this.loadBootstrap();
  },

  loadBootstrap() {
    this.setData({ loading: true, error: "" });

    get("/api/sports-app/bootstrap", { showLoading: false })
      .then((data) => {
        const venueCount = Array.isArray(data.venues) ? data.venues.length : 0;
        const gameCount = Array.isArray(data.games) ? data.games.length : 0;
        const orderCount = Array.isArray(data.orders) ? data.orders.length : 0;

        this.setData({
          loading: false,
          summary: `今日已加载 ${venueCount} 个场馆、${gameCount} 场球局、${orderCount} 条订单提醒。`
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "首页数据加载失败",
          summary: fallbackSummary
        });
      });
  },

  switchTab(event) {
    wx.switchTab({
      url: event.currentTarget.dataset.target
    });
  }
});
