const { get } = require("../../utils/api");

const fallbackSummary = "这里会从旧 H5 原型迁移真实首页数据、推荐场馆、今日球局和订单提醒。";

function money(value) {
  return `¥${Number(value || 0).toFixed(0)}`;
}

function formatTime(value) {
  if (!value) return "时间待定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day} ${hour}:${minute}`;
}

function buildStatCards(data) {
  const venues = Array.isArray(data.venues) ? data.venues : [];
  const games = Array.isArray(data.games) ? data.games : [];
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const unread = Array.isArray(data.notifications) ? data.notifications.filter((item) => item.status !== "read").length : 0;

  return [
    { label: "可订场馆", value: String(venues.length), tone: "success" },
    { label: "近期球局", value: String(games.length), tone: "info" },
    { label: "待处理", value: String(orders.filter((order) => ["pending_payment", "paid"].includes(order.status)).length + unread), tone: "warning" }
  ];
}

function mapVenue(venue) {
  return {
    id: venue.id,
    name: venue.name || "未命名场馆",
    meta: `${venue.area || "附近"} · ${money(venue.price_per_hour)}/小时`,
    target: `/pages/venue-detail/venue-detail?id=${venue.id}`
  };
}

function mapGame(game) {
  const joined = Number(game.joined_count || 0);
  const capacity = Number(game.capacity || 0);
  const missing = capacity > joined ? `缺 ${capacity - joined} 人` : "已满员";

  return {
    id: game.id,
    title: game.title || "未命名球局",
    meta: `${formatTime(game.start_time)} · ${game.venue_name || "场地待定"} · ${missing}`,
    target: `/pages/game-detail/game-detail?id=${game.id}`
  };
}

function sportName(game) {
  return game.sport_name || game.sport || game.sport_type || "运动";
}

function levelText(game) {
  return game.skill_level || game.level || game.level_text || "新手友好";
}

function countdownText(value) {
  if (!value) return "时间待定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间待定";

  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "即将开场";

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `倒计时 ${hours}h ${minutes}m`;
  return `倒计时 ${Math.max(1, minutes)}m`;
}

function mapMatchCard(game, index, mode) {
  const joined = Number(game.joined_count || 0);
  const capacity = Number(game.capacity || 0);
  const missingCount = Math.max(0, capacity - joined);
  const fee = game.fee_per_person || game.price_per_person || game.price || 0;

  return {
    id: game.id,
    title: game.title || (mode === "invite" ? "好友邀请" : "正在组人"),
    badge: index === 0 ? "NEW" : mode === "invite" ? "INVITE" : "JOIN",
    sport: sportName(game),
    format: capacity ? `${capacity}人局` : "约球局",
    countdown: countdownText(game.start_time),
    missingText: missingCount > 0 ? `还差 ${missingCount} 人` : "已满员",
    feeText: Number(fee) > 0 ? `${money(fee)}/人` : "AA/免费",
    rows: [
      { label: "强度", value: levelText(game) },
      { label: "时间", value: formatTime(game.start_time) },
      { label: "场馆", value: game.venue_name || "场地待定" }
    ],
    target: `/pages/game-detail/game-detail?id=${game.id}`,
    actionText: mode === "invite" ? "接受邀请" : "去报名"
  };
}

function buildHomeMatchGroups(games) {
  const source = Array.isArray(games) ? games : [];
  const inviteSource = source.slice(0, 2);
  const formingSource = source.length > 1 ? source.slice(1, 4) : source.slice(0, 2);

  return {
    featuredInvites: inviteSource.map((game, index) => mapMatchCard(game, index, "invite")),
    formingGames: formingSource.map((game, index) => mapMatchCard(game, index, "forming"))
  };
}

function buildTodoItems(data) {
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const notifications = Array.isArray(data.notifications) ? data.notifications : [];
  const todos = [];

  const pendingOrder = orders.find((order) => order.status === "pending_payment");
  if (pendingOrder) {
    todos.push({
      title: "有订单待支付",
      text: `${pendingOrder.title || pendingOrder.venue_name || "订单"} 需要完成支付占位。`,
      target: `/pages/orders/orders?orderId=${pendingOrder.id}`,
      actionText: "去处理"
    });
  }

  const checkinOrder = orders.find((order) => order.status === "paid");
  if (checkinOrder) {
    todos.push({
      title: "有订单待到场",
      text: `核销码 ${checkinOrder.checkin_code || "------"}，到场后完成核销。`,
      target: `/pages/orders/orders?orderId=${checkinOrder.id}`,
      actionText: "查看订单"
    });
  }

  const unread = notifications.find((message) => message.status !== "read");
  if (unread) {
    todos.push({
      title: "有未读消息",
      text: unread.title || "查看最新通知和订单提醒。",
      target: "/pages/messages/messages",
      tab: true,
      actionText: "看消息"
    });
  }

  return todos.slice(0, 3);
}

Page({
  data: {
    loading: false,
    error: "",
    summary: fallbackSummary,
    statCards: [
      { label: "可订场馆", value: "0", tone: "success" },
      { label: "近期球局", value: "0", tone: "info" },
      { label: "待处理", value: "0", tone: "warning" }
    ],
    todoItems: [],
    recommendedVenues: [],
    recommendedGames: [],
    homeMode: "invite",
    homeModes: [
      { label: "好友邀请", value: "invite" },
      { label: "正在组人", value: "forming" }
    ],
    featuredInvites: [],
    formingGames: [],
    matchCards: [],
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

    return get("/api/sports-app/bootstrap", { showLoading: false })
      .then((data) => {
        const venueCount = Array.isArray(data.venues) ? data.venues.length : 0;
        const gameCount = Array.isArray(data.games) ? data.games.length : 0;
        const orderCount = Array.isArray(data.orders) ? data.orders.length : 0;
        const venues = Array.isArray(data.venues) ? data.venues.slice(0, 2).map(mapVenue) : [];
        const rawGames = Array.isArray(data.games) ? data.games : [];
        const games = rawGames.slice(0, 2).map(mapGame);
        const matchGroups = buildHomeMatchGroups(rawGames);
        const matchCards = this.data.homeMode === "forming" ? matchGroups.formingGames : matchGroups.featuredInvites;

        this.setData({
          loading: false,
          summary: `今日已加载 ${venueCount} 个场馆、${gameCount} 场球局、${orderCount} 条订单提醒。`,
          statCards: buildStatCards(data),
          todoItems: buildTodoItems(data),
          recommendedVenues: venues,
          recommendedGames: games,
          featuredInvites: matchGroups.featuredInvites,
          formingGames: matchGroups.formingGames,
          matchCards
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "首页数据加载失败",
          summary: fallbackSummary,
          todoItems: [],
          recommendedVenues: [],
          recommendedGames: [],
          featuredInvites: [],
          formingGames: [],
          matchCards: []
        });
      });
  },

  onPullDownRefresh() {
    this.loadBootstrap().finally(() => wx.stopPullDownRefresh());
  },

  createGame() {
    wx.navigateTo({ url: "/pages/create-game/create-game" });
  },

  switchTab(event) {
    wx.switchTab({
      url: event.currentTarget.dataset.target
    });
  },

  switchHomeMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!mode || mode === this.data.homeMode) return;

    this.setData({
      homeMode: mode,
      matchCards: mode === "forming" ? this.data.formingGames : this.data.featuredInvites
    });
  },

  openTarget(event) {
    const target = event.currentTarget.dataset.target;
    const tab = event.currentTarget.dataset.tab;
    if (!target) return;

    if (tab) {
      wx.switchTab({ url: target });
      return;
    }

    wx.navigateTo({ url: target });
  }
});
