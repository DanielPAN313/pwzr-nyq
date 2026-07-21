const { get, post } = require("../../utils/api");

const fallbackTeams = [
  {
    id: "",
    name: "南师附中校友足球队",
    venue: "卡子门足球场",
    description: "每周固定训练，优先招中后场和门将。",
    memberText: "18 人",
    tagText: "公开招募",
    joined: false
  },
  {
    id: "",
    name: "江宁周末五人制",
    venue: "卡子门足球场",
    description: "周末晚场长期组局，适合稳定出勤球友。",
    memberText: "12 人",
    tagText: "稳定出勤",
    joined: true
  }
];

function mapTeam(team) {
  const members = Number(team.member_count || team.members || 0);
  return {
    id: team.id,
    name: team.name || "未命名球队",
    venue: team.home_venue_name || team.venue || "卡子门足球场",
    description: team.description || "球队资料完善中。",
    memberText: members ? `${members} 人` : "招募中",
    tagText: team.tag || team.sport || "足球",
    joined: Boolean(team.joined || team.is_joined)
  };
}

Page({
  data: {
    loading: false,
    joiningId: "",
    teams: fallbackTeams
  },

  onLoad() {
    this.loadTeams();
  },

  onPullDownRefresh() {
    this.loadTeams().finally(() => wx.stopPullDownRefresh());
  },

  loadTeams() {
    this.setData({ loading: true });

    return get("/api/sports-app/teams", { showLoading: false })
      .then((teams) => {
        const list = Array.isArray(teams) && teams.length ? teams.map(mapTeam) : fallbackTeams;
        this.setData({ loading: false, teams: list });
      })
      .catch(() => {
        this.setData({ loading: false, teams: fallbackTeams });
      });
  },

  joinTeam(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) {
      wx.showToast({ title: "体验球队暂不支持加入", icon: "none" });
      return;
    }

    this.setData({ joiningId: id });
    post(`/api/sports-app/teams/${id}/join`, {}, { loadingTitle: "加入中" })
      .then(() => {
        wx.showToast({ title: "已申请加入", icon: "success" });
        return this.loadTeams();
      })
      .catch(() => {})
      .finally(() => {
        this.setData({ joiningId: "" });
      });
  },

  createGame() {
    wx.navigateTo({ url: "/pages/create-game/create-game" });
  }
});
