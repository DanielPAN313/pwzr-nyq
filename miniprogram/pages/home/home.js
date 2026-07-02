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
        const venues = Array.isArray(data.venues) ? data.venues.slice(0, 2).map(mapVenue) : [];
        const games = Array.isArray(data.games) ? data.games.slice(0, 2).map(mapGame) : [];

        this.setData({
          loading: false,
          summary: `今日已加载 ${venueCount} 个场馆、${gameCount} 场球局、${orderCount} 条订单提醒。`,
          statCards: buildStatCards(data),
          todoItems: buildTodoItems(data),
          recommendedVenues: venues,
          recommendedGames: games
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "首页数据加载失败",
          summary: fallbackSummary,
          todoItems: [],
          recommendedVenues: [],
          recommendedGames: []
        });
      });
  },

  switchTab(event) {
    wx.switchTab({
      url: event.currentTarget.dataset.target
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
