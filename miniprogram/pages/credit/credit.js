const { get } = require("../../utils/api");

const fallbackEvents = [
  { title: "暂无信用记录", note: "完成报名、支付、核销后会在这里生成记录。", scoreText: "0", timeText: "" }
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

function mapCreditEvent(event) {
  const score = Number(event.score_delta || 0);

  return {
    id: event.id,
    title: event.event_type || "信用记录",
    note: event.note || "",
    scoreText: score > 0 ? `+${score}` : String(score),
    timeText: formatTime(event.create_time)
  };
}

Page({
  data: {
    loading: false,
    error: "",
    score: 100,
    level: "守约良好",
    played: 0,
    checkedIn: 0,
    noShows: 0,
    events: fallbackEvents
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

        this.setData({
          loading: false,
          score,
          level: levelText(score),
          played: Number(summary.played || 0),
          checkedIn: Number(summary.checked_in || 0),
          noShows: Number(summary.no_shows || 0),
          events: events.length ? events : fallbackEvents
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "信用分加载失败",
          events: fallbackEvents
        });
      });
  }
});
