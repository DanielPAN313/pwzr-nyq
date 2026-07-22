const { get } = require("../../utils/api");
const { clampCredit, storeCreditScore } = require("../../utils/credit-access");

const fallbackEvents = [
  {
    id: "credit-empty",
    title: "暂无信用记录",
    note: "完成散客球局报名、核销或取消后会生成记录。",
    gameTitle: "",
    scoreText: "0",
    timeText: "",
    tone: "neutral"
  }
];

const eventTypeText = {
  paid_signup: "完成报名支付",
  checkin: "按时到场核销",
  late_arrival: "迟到到场",
  review_submitted: "完成赛后互评",
  review_missed: "未参与互评",
  peer_complaint: "单场收到多人差评",
  no_show: "爽约：报名后未到场",
  late_cancel: "临近开赛取消",
  demo_reset: "开发数据重置"
};

const creditRules = [
  { title: "按时到场", text: "+2 分/次，仅用于修复已扣除的信用分，最高仍为 100 分。" },
  { title: "完成互评", text: "+1 分/次，不产生称号、徽章、隐藏分或兑换权益。" },
  { title: "爽约", text: "报名后未取消且未到场，-15 分/次。" },
  { title: "迟到", text: "迟到不超过 15 分钟 -3 分；超过 15 分钟 -5 分。" },
  { title: "互评约束", text: "单场收到至少 2 条 1-2 星评价 -5 分；未参与互评 -1 分。" },
  { title: "临近取消", text: "开场前 2-24 小时取消 -3 分；2 小时内取消 -8 分。" },
  { title: "报名门槛", text: "59 分及以下禁止报名；60-79 分可报名他人散客局，但不能发起散客局。" }
];

const recoveryTips = [
  "按时到场并完成核销：+2 分。",
  "完成赛后互评：+1 分。",
  "信用分不会按天或按周自动恢复。"
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

function mapCreditEvent(event) {
  const score = Number(event.score_delta || 0);
  return {
    id: event.id,
    eventType: event.event_type || "credit_event",
    title: eventTypeText[event.event_type] || event.event_type || "信用记录",
    note: event.note || "",
    gameTitle: event.game_title || "",
    scoreText: score > 0 ? `+${score}` : String(score),
    timeText: formatTime(event.create_time),
    tone: score > 0 ? "positive" : score < 0 ? "negative" : "neutral"
  };
}

function buildEventSections(events) {
  const list = Array.isArray(events) && events.length ? events : fallbackEvents;
  return [{ title: "按发生时间逐笔结算", events: list }];
}

Page({
  data: {
    loading: false,
    error: "",
    score: 100,
    scoreText: "信用分：100/100",
    creditRules,
    recoveryTips,
    events: fallbackEvents,
    eventSections: buildEventSections(fallbackEvents)
  },

  onLoad() {
    this.loadCredit();
  },

  onPullDownRefresh() {
    this.loadCredit().finally(() => wx.stopPullDownRefresh());
  },

  loadCredit() {
    this.setData({ loading: true, error: "" });
    return get("/api/sports-app/me", { showLoading: false })
      .then((profile) => {
        const score = storeCreditScore(clampCredit(profile?.summary?.credit_score ?? 100));
        const events = Array.isArray(profile?.credit) ? profile.credit.map(mapCreditEvent) : [];
        const visibleEvents = events.length ? events : fallbackEvents;
        this.setData({
          loading: false,
          score,
          scoreText: `信用分：${score}/100`,
          events: visibleEvents,
          eventSections: buildEventSections(visibleEvents)
        });
      })
      .catch(() => this.setData({ loading: false, error: "" }));
  },

  goOrders() {
    wx.navigateTo({ url: "/pages/orders/orders" });
  },

  goMyGames() {
    wx.navigateTo({ url: "/pages/my-games/my-games" });
  }
});

module.exports = {
  buildEventSections,
  creditRules,
  mapCreditEvent,
  recoveryTips
};
