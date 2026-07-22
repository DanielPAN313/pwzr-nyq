const { get, post } = require("../../utils/api");
const { getStoredUser } = require("../../utils/auth");
const { getTeams, isLocalId, recordLocalJoin } = require("../../utils/team-stats");

const hubEntries = [
  { key: "join", icon: "队", title: "加入球队", note: "查看长期招募队伍" },
  { key: "create", icon: "+", title: "创建球队", note: "建立固定阵容" },
  { key: "casual", icon: "球", title: "散客找球局", note: "直接报名公开球局" }
];

Page({
  data: {
    loading: false,
    joiningId: "",
    hubEntries,
    teams: getTeams()
  },

  onLoad() {
    this.loadTeams();
  },

  onShow() {
    if (this.loadedOnce) this.loadTeams();
    this.loadedOnce = true;
  },

  onPullDownRefresh() {
    this.loadTeams().finally(() => wx.stopPullDownRefresh());
  },

  loadTeams() {
    this.setData({ loading: true });
    return get("/api/sports-app/teams", { showLoading: false })
      .then((teams) => {
        this.setData({ loading: false, teams: getTeams(Array.isArray(teams) ? teams : []) });
      })
      .catch(() => {
        this.setData({ loading: false, teams: getTeams() });
      });
  },

  openHubEntry(event) {
    const key = event.currentTarget.dataset.key;
    if (key === "create") {
      wx.navigateTo({ url: "/pages/team-create/team-create" });
      return;
    }
    if (key === "casual") {
      wx.switchTab({ url: "/pages/games/games" });
      return;
    }
    wx.pageScrollTo({ selector: "#team-list", duration: 260 });
  },

  openTeam(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/team-detail/team-detail?id=${encodeURIComponent(id)}` });
  },

  joinTeam(event) {
    const id = event.currentTarget.dataset.id;
    const team = this.data.teams.find((item) => String(item.id) === String(id));
    if (!team || team.joined || team.joinPending || this.data.joiningId) return;
    const user = getStoredUser();
    const applyLocal = (pending) => {
      recordLocalJoin(id, user, pending);
      this.setData({ teams: getTeams(), joiningId: "" });
      wx.showToast({ title: pending ? "已提交入队申请" : "已加入球队", icon: "success" });
    };

    this.setData({ joiningId: String(id) });
    if (isLocalId(id)) {
      applyLocal(team.requiresApproval);
      return;
    }

    post(`/api/sports-app/teams/${id}/join`, {}, { loadingTitle: "提交中" })
      .then((result) => applyLocal(result?.status === "pending" || team.requiresApproval))
      .catch(() => applyLocal(team.requiresApproval));
  },

  createGame() {
    wx.navigateTo({ url: "/pages/create-game/create-game" });
  }
});
