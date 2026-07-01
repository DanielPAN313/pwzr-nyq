const { get, post } = require("../../utils/api");

const fallbackMessages = [
  { title: "报名提醒", body: "你的球局名额已保留，等待支付确认。", statusText: "未读", timeText: "刚刚" },
  { title: "场馆动态", body: "江宁大学城篮球馆新增黄金时段。", statusText: "未读", timeText: "今天" }
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
  return {
    id: message.id,
    title: message.title || "系统通知",
    body: message.body || "",
    status: message.status || "unread",
    statusText: message.status === "read" ? "已读" : "未读",
    timeText: formatTime(message.create_time)
  };
}

Page({
  data: {
    loading: false,
    error: "",
    empty: false,
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
          empty: list.length === 0
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "消息数据加载失败",
          empty: false,
          messages: fallbackMessages
        });
      });
  },

  markRead(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;

    post(`/api/sports-app/notifications/${id}/read`, {}, { showLoading: false })
      .then(() => {
        const messages = this.data.messages.map((message) => {
          if (String(message.id) !== String(id)) return message;
          return {
            ...message,
            status: "read",
            statusText: "已读"
          };
        });

        this.setData({ messages });
      })
      .catch((error) => {
        wx.showToast({
          title: error.message || "操作失败",
          icon: "none"
        });
      });
  }
});
