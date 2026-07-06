const { get } = require("../../utils/api");

const fallbackEvents = [
  {
    title: "暂无信用记录",
    note: "完成报名、支付、核销后会在这里生成记录。",
    scoreText: "0",
    timeText: "",
    tone: "neutral"
  }
];

const eventTypeText = {
  paid_signup: "完成报名支付",
  checkin: "到场核销",
  create_game: "发起真实球局",
  review_submitted: "提交赛后互评",
  no_show: "无故缺席",
  late_cancel: "临近开赛取消",
  auto_recovery: "信用自动恢复",
  demo_reset: "开发数据重置"
};

const creditRules = [
  { title: "按时到场", text: "订单核销后会增加信用记录，后续报名更稳定。" },
  { title: "避免爽约", text: "无故缺席会扣信用分，低分会限制订场和发局。" },
  { title: "完成互评", text: "赛后给队友评价，有助于完善球友实力和信用画像。" }
];

const recoveryTips = [
  "优先完成已报名球局的到场核销。",
  "需要取消时尽早处理，避免临近开赛扣分。",
  "赛后互评开放后及时提交。"
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

function levelText(score) {
  if (score >= 90) return "守约良好";
  if (score >= 80) return "可正常报名";
  if (score >= 60) return "部分能力受限";
  return "发局和订场受限";
}

function levelTone(score) {
  if (score >= 90) return "excellent";
  if (score >= 80) return "good";
  if (score >= 60) return "warning";
  return "danger";
}

function progressHint(score) {
  if (score >= 90) return "当前信用健康，继续保持按时到场和赛后互评。";
  if (score >= 80) return "仍可正常使用核心功能，建议优先完成核销和互评。";
  if (score >= 60) return "部分能力可能受限，先把已报名场次按时完成。";
  return "信用较低，建议暂停新增风险操作，先通过履约慢慢恢复。";
}

function mapCreditEvent(event) {
  const score = Number(event.score_delta || 0);

  return {
    id: event.id,
    eventType: event.event_type || "credit_event",
    title: eventTypeText[event.event_type] || event.event_type || "信用记录",
    note: event.note || "",
    scoreText: score > 0 ? `+${score}` : String(score),
    timeText: formatTime(event.create_time),
    tone: score > 0 ? "positive" : score < 0 ? "negative" : "neutral"
  };
}

function buildEventSections(events) {
  const positive = events.filter((event) => event.tone === "positive");
  const negative = events.filter((event) => event.tone === "negative");
  const neutral = events.filter((event) => event.tone === "neutral");
  const sections = [];

  if (negative.length) sections.push({ title: "需要注意", events: negative });
  if (positive.length) sections.push({ title: "守约加分", events: positive });
  if (neutral.length) sections.push({ title: "普通记录", events: neutral });

  return sections.length ? sections : [{ title: "信用记录", events: fallbackEvents }];
}

function buildScoreCards(summary) {
  const played = Number(summary.played || 0);
  const checkedIn = Number(summary.checked_in || 0);
  const noShows = Number(summary.no_shows || 0);
  const checkinRate = played ? Math.round((checkedIn / played) * 100) : 0;

  return [
    { label: "参与场次", value: played, hint: "报名或发起后计入" },
    { label: "到场核销", value: checkedIn, hint: `${checkinRate}% 到场率` },
    { label: "爽约次数", value: noShows, hint: noShows > 0 ? "后续请尽早取消" : "暂无爽约记录" }
  ];
}

Page({
  data: {
    loading: false,
    error: "",
    score: 100,
    scorePercent: 100,
    level: "守约良好",
    levelTone: "excellent",
    progressHint: progressHint(100),
    scoreCards: buildScoreCards({}),
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
        const summary = profile.summary || {};
        const score = Number(summary.credit_score || 100);
        const events = Array.isArray(profile.credit) ? profile.credit.map(mapCreditEvent) : [];
        const visibleEvents = events.length ? events : fallbackEvents;

        this.setData({
          loading: false,
          score,
          scorePercent: Math.max(0, Math.min(score, 100)),
          level: levelText(score),
          levelTone: levelTone(score),
          progressHint: progressHint(score),
          scoreCards: buildScoreCards(summary),
          events: visibleEvents,
          eventSections: buildEventSections(visibleEvents)
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "信用分加载失败",
          events: fallbackEvents,
          eventSections: buildEventSections(fallbackEvents)
        });
      });
  },

  goOrders() {
    wx.navigateTo({ url: "/pages/orders/orders" });
  },

  goMyGames() {
    wx.navigateTo({ url: "/pages/my-games/my-games" });
  }
});
