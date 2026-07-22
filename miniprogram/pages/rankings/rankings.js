const { get } = require("../../utils/api");

const tabs = [{ key: "attendance", label: "出勤榜" }];

const fallbackSummary = {
  total_goals: 128,
  total_attendance: 462,
  active_players: 38,
  avg_attendance_rate: 91
};

const fallbackScorers = [
  { id: "scorer-1", name: "周子豪", team: "卡子门 U21", goals: 18, matches: 9, note: "近 5 场 7 球" },
  { id: "scorer-2", name: "陈启", team: "江宁联队", goals: 15, matches: 8, note: "连续 3 场破门" },
  { id: "scorer-3", name: "李昊然", team: "大学城公开局", goals: 13, matches: 10, note: "前场终结稳定" },
  { id: "scorer-4", name: "王泽", team: "周末拼场", goals: 11, matches: 7, note: "禁区把握度高" },
  { id: "scorer-5", name: "刘航", team: "老球友联盟", goals: 10, matches: 6, note: "侧翼内切强" }
];

const fallbackAttendance = [
  { id: "attendance-1", name: "王一鸣", team: "周三固定局", attendance: 14, rate: 100, note: "连续 8 周到场" },
  { id: "attendance-2", name: "赵子墨", team: "卡子门夜场", attendance: 13, rate: 97, note: "请假率很低" },
  { id: "attendance-3", name: "孙晨", team: "大学城足球圈", attendance: 12, rate: 96, note: "守约记录稳定" },
  { id: "attendance-4", name: "胡宇", team: "场馆会员局", attendance: 11, rate: 94, note: "经常提前到场" },
  { id: "attendance-5", name: "郭凯", team: "江宁周赛", attendance: 10, rate: 92, note: "替补补位积极" }
];

function safeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function formatCount(value, suffix) {
  return `${safeNumber(value, 0)}${suffix}`;
}

function buildSummaryCards(summary, scorers, attendance) {
  const totalAttendance = summary.total_attendance ?? attendance.reduce((sum, item) => sum + safeNumber(item.attendance), 0);
  const activePlayers = summary.active_players ?? attendance.length;
  const avgRate = summary.avg_attendance_rate ?? 91;

  return [
    { label: "累计出勤", value: formatCount(totalAttendance, " 次") },
    { label: "活跃球友", value: formatCount(activePlayers, " 人") },
    { label: "平均到场率", value: `${safeNumber(avgRate, 91)}%` },
    { label: "更新频率", value: "T+1" }
  ];
}

function mapScorer(item, index) {
  const goals = safeNumber(item.goals ?? item.goal_count ?? item.value, 0);
  const matches = safeNumber(item.matches ?? item.appearances ?? item.games, 0);

  return {
    id: item.id || `scorer-${index}`,
    rank: index + 1,
    rankLabel: `#${index + 1}`,
    name: item.name || item.username || "球友",
    team: item.team || item.team_name || "未分组",
    valueText: `${goals} 球`,
    metaText: matches ? `${matches} 场出战` : "本期统计",
    note: item.note || "稳定输出",
    accent: index < 3 ? `top-${index + 1}` : "normal",
    goals
  };
}

function mapAttendance(item, index) {
  const attendance = safeNumber(item.attendance ?? item.attendance_count ?? item.value, 0);
  const rate = safeNumber(item.rate ?? item.attendance_rate ?? item.percent, 0);

  return {
    id: item.id || `attendance-${index}`,
    rank: index + 1,
    rankLabel: `#${index + 1}`,
    name: item.name || item.username || "球友",
    team: item.team || item.team_name || "未分组",
    valueText: `${attendance} 次`,
    metaText: rate ? `${rate}% 到场率` : "到场记录",
    note: item.note || "守约稳定",
    accent: index < 3 ? `top-${index + 1}` : "normal",
    attendance
  };
}

function buildView(_activeTab, _scorers, attendance) {
  const rows = attendance;
  return {
    activeTab: "attendance",
    rankTitle: "出勤榜",
    rankHint: "按核销后的到场次数排序，每日 00:00 更新。",
    rankRows: rows,
    podiumRows: rows.slice(0, 3)
  };
}

Page({
  data: {
    loading: false,
    error: "",
    sourceLabel: "演示数据",
    bannerText: "当前显示演示榜单，接入后会按报名、核销和互评自动统计。",
    tabs,
    activeTab: "attendance",
    summaryCards: buildSummaryCards(fallbackSummary, fallbackScorers, fallbackAttendance),
    rankTitle: "出勤榜",
    rankHint: "按核销后的到场次数排序，每日 00:00 更新。",
    scorerRows: fallbackScorers.map(mapScorer),
    attendanceRows: fallbackAttendance.map(mapAttendance),
    rankRows: fallbackAttendance.map(mapAttendance),
    podiumRows: fallbackAttendance.map(mapAttendance).slice(0, 3)
  },

  onLoad() {
    this.loadRankings();
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
      if (typeof this.getTabBar().syncTabState === "function") {
        this.getTabBar().syncTabState();
      }
    }
  },

  onPullDownRefresh() {
    this.loadRankings().finally(() => wx.stopPullDownRefresh());
  },

  loadRankings() {
    this.setData({ loading: true, error: "" });

    return get("/api/sports-app/rankings", { showLoading: false })
      .then((payload) => {
        const summary = payload && payload.summary ? payload.summary : {};
        const scorerSource = Array.isArray(payload?.scorers) ? payload.scorers : fallbackScorers;
        const attendanceSource = Array.isArray(payload?.attendance) ? payload.attendance : fallbackAttendance;
        const scorers = scorerSource.map(mapScorer);
        const attendance = attendanceSource.map(mapAttendance);

        this.setData({
          loading: false,
          sourceLabel: payload?.source_label || "真实统计",
          bannerText: payload?.hint || "榜单来自报名、核销和赛后记录，帮助场馆筛选稳定球友。",
          summaryCards: buildSummaryCards(summary, scorerSource, attendanceSource),
          scorerRows: scorers,
          attendanceRows: attendance,
          ...buildView(this.data.activeTab, scorers, attendance)
        });
      })
      .catch(() => {
        const scorers = fallbackScorers.map(mapScorer);
        const attendance = fallbackAttendance.map(mapAttendance);

        this.setData({
          loading: false,
          sourceLabel: "演示数据",
          bannerText: "当前显示演示榜单，接入后会按报名、核销和互评自动统计。",
          summaryCards: buildSummaryCards(fallbackSummary, fallbackScorers, fallbackAttendance),
          scorerRows: scorers,
          attendanceRows: attendance,
          ...buildView(this.data.activeTab, scorers, attendance)
        });
      });
  },

  changeTab(event) {
    const key = "attendance";
    const scorers = Array.isArray(this.data.scorerRows) ? this.data.scorerRows : fallbackScorers.map(mapScorer);
    const attendance = Array.isArray(this.data.attendanceRows) ? this.data.attendanceRows : fallbackAttendance.map(mapAttendance);

    this.setData({
      ...buildView(key, scorers, attendance)
    });
  },

  goGames() {
    wx.navigateTo({ url: "/pages/games/games" });
  }
});
