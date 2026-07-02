const { get, post } = require("../../utils/api");

const fallbackMessages = [
  {
    title: "报名提醒",
    body: "你的球局名额已保留，等待支付确认。",
    statusText: "未读",
    status: "unread",
    timeText: "刚刚",
    actionHint: "关联订单",
    targetText: "查看订单"
  },
  {
    title: "场馆动态",
    body: "宁约球新增黄金时段，快去看看可订场地。",
    statusText: "未读",
    status: "unread",
    timeText: "今天",
    actionHint: "系统通知",
    targetText: ""
  }
];

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
  const relatedOrderId = message.related_order_id || "";
  const relatedGameId = message.related_game_id || "";
  const status = message.status || "unread";
  const targetText = relatedOrderId ? "查看订单" : relatedGameId ? "查看球局" : "";

  return {
    id: message.id,
    title: message.title || "系统通知",
    body: message.body || "",
    status,
    statusText: status === "read" ? "已读" : "未读",
    statusTone: status === "read" ? "muted" : "active",
    timeText: formatTime(message.create_time),
    relatedOrderId,
    relatedGameId,
    actionHint: relatedOrderId ? "关联订单" : relatedGameId ? "关联球局" : "系统通知",
    targetText
  };
}

function buildMessageSections(messages) {
  const unread = messages.filter((message) => message.status !== "read");
  const read = messages.filter((message) => message.status === "read");
  const sections = [];

  if (unread.length) {
    sections.push({
      title: "未读消息",
      count: unread.length,
      messages: unread
    });
  }

  if (read.length) {
    sections.push({
      title: "已读消息",
      count: read.length,
      messages: read
    });
  }

  return sections;
}

function unreadCount(messages) {
  return messages.filter((message) => message.status !== "read").length;
}

Page({
  data: {
    loading: false,
    error: "",
    empty: false,
    unreadCount: 0,
    messageSections: [],
    messages: fallbackMessages
  },

  onLoad() {
    this.loadMessages();
  },

  onPullDownRefresh() {
    this.loadMessages().finally(() => wx.stopPullDownRefresh());
  },

  loadMessages() {
    this.setData({ loading: true, error: "", empty: false });

    return get("/api/sports-app/notifications", { showLoading: false })
      .then((messages) => {
        const list = Array.isArray(messages) ? messages.map(mapMessage) : [];

        this.setData({
          loading: false,
          messages: list.length ? list : [],
          unreadCount: unreadCount(list),
          messageSections: buildMessageSections(list),
          empty: list.length === 0
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "消息数据加载失败",
          empty: false,
          unreadCount: unreadCount(fallbackMessages),
          messageSections: buildMessageSections(fallbackMessages),
          messages: fallbackMessages
        });
      });
  },

  openMessage(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;

    const message = this.data.messages.find((item) => String(item.id) === String(id));
    if (!message) return;

    this.markMessageRead(id)
      .then(() => {
        this.navigateByMessage(message);
      })
      .catch((error) => {
        wx.showToast({
          title: error.message || "操作失败",
          icon: "none"
        });
      });
  },

  markMessageRead(id) {
    return post(`/api/sports-app/notifications/${id}/read`, {}, { showLoading: false })
      .then(() => {
        const messages = this.data.messages.map((message) => {
          if (String(message.id) !== String(id)) return message;
          return {
            ...message,
            status: "read",
            statusText: "已读",
            statusTone: "muted"
          };
        });

        this.setData({
          messages,
          unreadCount: unreadCount(messages),
          messageSections: buildMessageSections(messages),
          empty: messages.length === 0
        });
      });
  },

  navigateByMessage(message) {
    if (message.relatedOrderId) {
      wx.navigateTo({ url: `/pages/orders/orders?orderId=${message.relatedOrderId}` });
      return;
    }

    if (message.relatedGameId) {
      wx.navigateTo({ url: `/pages/game-detail/game-detail?id=${message.relatedGameId}` });
    }
  }
});
