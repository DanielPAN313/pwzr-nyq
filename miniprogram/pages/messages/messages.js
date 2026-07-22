const { get, post } = require("../../utils/api");
const {
  getLocalNotifications,
  getHiddenNotificationIds,
  hideNotification,
  markLocalNotificationRead
} = require("../../utils/notifications");

const fallbackMessages = [
  { id: "fallback-order", type: "order_notification", title: "订单通知", body: "你的球局名额已保留，等待支付确认。", status: "unread", create_time: new Date().toISOString(), related_game_id: "" },
  { id: "fallback-checkin", type: "checkin_notification", title: "核销通知", body: "卡子门足球场周末黄金时段已准备好，到场后请出示核销码。", status: "unread", create_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(), related_game_id: "" },
  { id: "fallback-team", type: "team_notification", title: "分队通知", body: "本场球局分队结果已更新，点击查看对阵。", status: "read", create_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), related_game_id: "" },
  { id: "fallback-review", type: "review_reminder", title: "评价提醒", body: "你有已到场队友等待赛后互评。", status: "unread", create_time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), related_game_id: "" },
  { id: "fallback-credit", type: "credit_change", title: "信用分变动", body: "按时到场记录已更新，信用分明细可查看。", status: "read", create_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), related_game_id: "" },
  { id: "fallback-system", type: "system_announcement", title: "系统公告", body: "支付、取消与信用规则已更新。", status: "read", create_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), related_game_id: "" }
];

const typeMeta = {
  payment_required: { type: "order_notification", icon: "单" },
  order_cancelled: { type: "order_notification", icon: "单" },
  refund_success: { type: "order_notification", icon: "单" },
  order_notification: { type: "order_notification", icon: "单" },
  checkin_success: { type: "checkin_notification", icon: "核" },
  checkin_notification: { type: "checkin_notification", icon: "核" },
  team_balance: { type: "team_notification", icon: "队" },
  team_notification: { type: "team_notification", icon: "队" },
  review_reminder: { type: "review_reminder", icon: "评" },
  credit_change: { type: "credit_change", icon: "信" },
  system: { type: "system_announcement", icon: "告" },
  system_announcement: { type: "system_announcement", icon: "告" }
};

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}

function mapMessage(message) {
  const meta = typeMeta[message.type] || typeMeta.system_announcement;
  const relatedGameId = message.related_game_id || message.game_id || "";
  const relatedOrderId = message.related_order_id || message.order_id || "";
  return {
    id: message.id || `message-${Date.now()}`,
    type: meta.type,
    icon: meta.icon,
    title: message.title || "系统通知",
    body: message.body || "",
    status: message.status || "unread",
    statusText: message.status === "read" ? "已读" : "未读",
    unread: message.status !== "read",
    timeText: formatTime(message.create_time || message.created_at),
    relatedGameId,
    relatedOrderId,
    local: Boolean(message.local)
  };
}

function sortMessages(messages) {
  return messages.slice().sort((a, b) => {
    const left = new Date(a.create_time || a.created_at || 0).getTime();
    const right = new Date(b.create_time || b.created_at || 0).getTime();
    return right - left;
  });
}

Page({
  data: {
    loading: false,
    error: "",
    empty: false,
    swipedId: "",
    messages: fallbackMessages.map(mapMessage),
    touchStartX: 0
  },

  onLoad() {
    this.loadMessages();
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
  },

  onPullDownRefresh() {
    this.loadMessages().finally(() => wx.stopPullDownRefresh());
  },

  loadMessages() {
    this.setData({ loading: true, error: "", empty: false, swipedId: "" });
    const hiddenIds = getHiddenNotificationIds();
    const local = getLocalNotifications().filter((message) => !hiddenIds.includes(String(message.id)));

    return get("/api/sports-app/notifications", { showLoading: false })
      .then((messages) => {
        const server = Array.isArray(messages) ? messages : [];
        const merged = sortMessages([...local, ...server].filter((message) => !hiddenIds.includes(String(message.id))));
        const list = merged.length ? merged.map(mapMessage) : [];
        this.setData({ loading: false, messages: list, empty: list.length === 0 });
      })
      .catch(() => {
        const list = sortMessages(local.length ? local : fallbackMessages).map(mapMessage);
        this.setData({ loading: false, error: "", messages: list, empty: list.length === 0 });
      });
  },

  onTouchStart(event) {
    this.setData({ touchStartX: Number(event.touches?.[0]?.clientX || 0) });
  },

  onTouchEnd(event) {
    const endX = Number(event.changedTouches?.[0]?.clientX || 0);
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    const delta = this.data.touchStartX - endX;
    this.setData({ swipedId: delta > 60 ? String(id) : "" });
  },

  closeSwipe() {
    this.setData({ swipedId: "" });
  },

  removeMessage(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    hideNotification(id);
    this.setData({
      swipedId: "",
      messages: this.data.messages.filter((message) => String(message.id) !== String(id))
    });
  },

  openMessage(event) {
    if (this.data.swipedId) {
      this.closeSwipe();
      return;
    }
    const id = event.currentTarget.dataset.id;
    const item = this.data.messages.find((message) => String(message.id) === String(id));
    if (!item) return;
    this.markReadById(item.id);
    const routes = {
      order_notification: item.relatedOrderId ? `/pages/orders/orders?orderId=${item.relatedOrderId}` : "/pages/orders/orders",
      checkin_notification: "/pages/my-games/my-games",
      team_notification: item.relatedGameId ? `/pages/game-detail/game-detail?id=${item.relatedGameId}` : "/pages/games/games",
      review_reminder: item.relatedGameId ? `/pages/game-detail/game-detail?id=${item.relatedGameId}&review=1` : "/pages/my-games/my-games",
      credit_change: "/pages/credit/credit",
      system_announcement: "/pages/legal/legal"
    };
    wx.navigateTo({ url: routes[item.type] || routes.system_announcement });
  },

  markReadById(id) {
    if (!id) return;
    markLocalNotificationRead(id);
    const messages = this.data.messages.map((message) => (
      String(message.id) === String(id) ? { ...message, status: "read", statusText: "已读", unread: false } : message
    ));
    this.setData({ messages });
    if (String(id).startsWith("local-") || String(id).startsWith("fallback-")) return;
    post(`/api/sports-app/notifications/${id}/read`, {}, { showLoading: false }).catch(() => {});
  },

  markRead(event) {
    this.markReadById(event.currentTarget.dataset.id);
  }
});
