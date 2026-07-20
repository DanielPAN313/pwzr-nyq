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

function gameCountdownSeconds(game) {
  const start = new Date(game.start_time || Date.now() + 30 * 60 * 1000);
  if (Number.isNaN(start.getTime())) return 1800;
  return Math.max(0, Math.floor((start.getTime() - Date.now()) / 1000));
}

function mapHomeGame(game, index) {
  const joined = Number(game.joined_count || 0);
  const capacity = Number(game.capacity || 0);
  const slotsLeft = capacity > joined ? capacity - joined : Math.max(1, index + 1);
  const start = game.start_time ? new Date(game.start_time) : null;
  const timeText = start && !Number.isNaN(start.getTime())
    ? `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`
    : "20:00";
  const fee = Number(game.fee_per_person || 0);

  return {
    id: game.id || `game-${index}`,
    title: game.title || homeGameTemplate.title,
    desc: `${slotsLeft} 个名额 · ${timeText}`,
    venue: game.venue_name || game.area || homeGameTemplate.venue,
    mode: capacity ? `${capacity}人局` : homeGameTemplate.mode,
    fee: fee ? `¥${fee}/人` : homeGameTemplate.fee,
    actionText: homeGameTemplate.actionText,
    countdownSeconds: gameCountdownSeconds(game),
    slotsLeft
  };
}

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
    homePanel: 1,
    tabMotionClass: "",
    panelMotionClass: "",
    panelTransform: "translateX(-100%)",
    homePanels: [
      { label: "好友邀请" },
      { label: "正在招人" }
    ],
    invitationGames: buildPrioritizedGames(inviteGames),
    recruitingGames: buildPrioritizedGames(recruitingGames),
    quickActions: [
      { label: "订场", hint: "锁定今天可用时段", target: "/pages/venues/venues", mode: "tab" },
      { label: "找球局", hint: "报名附近公开局", target: "/pages/games/games", mode: "page" },
      { label: "查订单", hint: "支付和核销码", target: "/pages/orders/orders", mode: "page" },
      { label: "消息", hint: "订单提醒", target: "/pages/messages/messages", mode: "tab" }
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
        const games = Array.isArray(data.games) ? data.games : [];
        const gameCount = games.length;
        const orderCount = Array.isArray(data.orders) ? data.orders.length : 0;
        const mappedGames = games.map(mapHomeGame);
        const nextInvitationGames = mappedGames.length ? buildPrioritizedGames(mappedGames.slice(0, 3)) : this.data.invitationGames;
        const nextRecruitingGames = mappedGames.length ? buildPrioritizedGames(mappedGames.slice(1, 4).length ? mappedGames.slice(1, 4) : mappedGames) : this.data.recruitingGames;

        this.setData({
          loading: false,
          summary: `今日已加载 ${venueCount} 个场馆、${gameCount} 场球局、${orderCount} 条订单提醒。`,
          invitationGames: nextInvitationGames,
          recruitingGames: nextRecruitingGames
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
    const target = event.currentTarget.dataset.target;
    if (!target) return;

    if (["/pages/home/home", "/pages/venues/venues", "/pages/rankings/rankings", "/pages/messages/messages", "/pages/me/me"].includes(target)) {
      wx.switchTab({ url: target });
      return;
    }

    wx.navigateTo({ url: target });
  },

  openQuickAction(event) {
    const target = event.currentTarget.dataset.target;
    const mode = event.currentTarget.dataset.mode;
    if (!target) return;

    if (mode === "page") {
      wx.navigateTo({ url: target });
      return;
    }

    wx.switchTab({ url: target });
  },

  openHomeGame(event) {
    const item = event.currentTarget.dataset || {};
    const id = item.id || "";
    const query = [
      `id=${encodeURIComponent(id)}`,
      `preview=1`,
      `title=${encodeURIComponent(item.title || "附近球局")}`,
      `venue=${encodeURIComponent(item.venue || "场地待定")}`,
      `desc=${encodeURIComponent(item.desc || "")}`,
      `fee=${encodeURIComponent(item.fee || "免费/AA")}`
    ].join("&");

    wx.navigateTo({ url: `/pages/game-detail/game-detail?${query}` });
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
      const tick = (games) => (games || []).map((game) => ({
        ...game,
        countdownSeconds: Math.max(0, Number(game.countdownSeconds || 0) - 1)
      }));

      this.setData({
        invitationGames: buildPrioritizedGames(tick(this.data.invitationGames)),
        recruitingGames: buildPrioritizedGames(tick(this.data.recruitingGames))
      });
    }, 1000);
  }
});
