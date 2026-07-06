const { get } = require("../../utils/api");

const fallbackSummary = "这里会从旧 H5 原型迁移真实首页数据、推荐场馆、今日球局和订单提醒。";
const homeGameTemplate = {
  title: "3v3篮球",
  desc: "阿杰已预留 1 个名额 · 今晚 20:00",
  venue: "江宁大学城篮球馆",
  mode: "3v3",
  fee: "AA ¥32",
  actionText: "查看邀请"
};

const inviteGames = [
  { id: "invite-1", countdownSeconds: 520, slotsLeft: 1 },
  { id: "invite-2", countdownSeconds: 1260, slotsLeft: 2 },
  { id: "invite-3", countdownSeconds: 2380, slotsLeft: 1 }
];

const recruitingGames = [
  { id: "recruit-1", countdownSeconds: 430, slotsLeft: 1 },
  { id: "recruit-2", countdownSeconds: 980, slotsLeft: 2 },
  { id: "recruit-3", countdownSeconds: 1960, slotsLeft: 3 }
];

const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
};

const buildPrioritizedGames = (games) =>
  games
    .map((game) => ({
      ...homeGameTemplate,
      ...game,
      countdownText: formatCountdown(game.countdownSeconds),
      slotsText: `余 ${game.slotsLeft} 人`
    }))
    .sort((a, b) => a.countdownSeconds - b.countdownSeconds)
    .map((game, index) => ({
      ...game,
      featured: index === 0
    }));

Page({
  data: {
    loading: false,
    error: "",
    summary: fallbackSummary,
    homePanel: 0,
    tabMotionClass: "",
    panelMotionClass: "",
    panelTransform: "translateX(0%)",
    homePanels: [
      { label: "好友邀请" },
      { label: "正在招人" }
    ],
    invitationGames: buildPrioritizedGames(inviteGames),
    recruitingGames: buildPrioritizedGames(recruitingGames),
    quickActions: [
      { label: "订场", target: "/pages/venues/venues" },
      { label: "找球局", target: "/pages/games/games" },
      { label: "消息", target: "/pages/messages/messages" },
      { label: "我的", target: "/pages/me/me" }
    ]
  },

  onLoad() {
    this.startHomeCountdown();
    this.loadBootstrap();
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
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
  },

  switchHomePanel(event) {
    const index = Number(event.currentTarget.dataset.index || 0);

    if (index === this.data.homePanel) return;

    if (this.tabMoveTimer) {
      clearTimeout(this.tabMoveTimer);
    }
    if (this.panelMoveTimer) {
      clearTimeout(this.panelMoveTimer);
    }

    this.setData({
      homePanel: index,
      tabMotionClass: "moving",
      panelMotionClass: "panel-entering",
      panelTransform: `translateX(-${index * 100}%)`
    });

    this.tabMoveTimer = setTimeout(() => {
      this.setData({ tabMotionClass: "" });
    }, 380);
    this.panelMoveTimer = setTimeout(() => {
      this.setData({ panelMotionClass: "" });
    }, 520);
  },

  onUnload() {
    if (this.tabMoveTimer) {
      clearTimeout(this.tabMoveTimer);
    }
    if (this.countdownTimer && typeof clearInterval === "function") {
      clearInterval(this.countdownTimer);
    }
    if (this.panelMoveTimer) {
      clearTimeout(this.panelMoveTimer);
    }
  },

  startHomeCountdown() {
    if (typeof setInterval !== "function") return;

    this.countdownTimer = setInterval(() => {
      inviteGames.forEach((game) => {
        game.countdownSeconds = Math.max(0, game.countdownSeconds - 1);
      });
      recruitingGames.forEach((game) => {
        game.countdownSeconds = Math.max(0, game.countdownSeconds - 1);
      });

      this.setData({
        invitationGames: buildPrioritizedGames(inviteGames),
        recruitingGames: buildPrioritizedGames(recruitingGames)
      });
    }, 1000);
  }
});
