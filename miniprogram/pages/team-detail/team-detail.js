const { get, post } = require("../../utils/api");
const { getStoredUser } = require("../../utils/auth");
const {
  buildTeamStats,
  getTeamById,
  getTeamGames,
  getTeamMembers,
  isLocalId,
  recordLocalJoin
} = require("../../utils/team-stats");

const demoApplicants = [
  { id: "applicant-1", name: "林浩", avatarText: "林", note: "边后卫 · 近 8 场出勤 7 场", level: 66 },
  { id: "applicant-2", name: "许程", avatarText: "许", note: "门将 · 接受周三晚训练", level: 70 }
];

Page({
  data: {
    id: "",
    loading: false,
    joining: false,
    team: null,
    members: [],
    games: [],
    stats: null,
    isCaptain: false,
    managing: false,
    applicants: []
  },

  onLoad(options) {
    const id = decodeURIComponent(options.id || "demo-team-1");
    this.setData({ id });
    this.loadDetail();
  },

  onShow() {
    if (this.loadedOnce) this.loadDetail();
    this.loadedOnce = true;
  },

  onPullDownRefresh() {
    this.loadDetail().finally(() => wx.stopPullDownRefresh());
  },

  applyDetail(team, members, games, applicants) {
    if (!team) return;
    const user = getStoredUser() || {};
    const normalizedMembers = getTeamMembers(team, members);
    const normalizedGames = getTeamGames(team.id, games);
    const isCaptain = String(team.captainUserId) === String(user.id);
    const pendingApplicants = Array.isArray(applicants) ? applicants : isCaptain && isLocalId(team.id) ? demoApplicants : [];
    this.setData({
      loading: false,
      team,
      members: normalizedMembers,
      games: normalizedGames,
      stats: buildTeamStats(team, normalizedMembers, normalizedGames),
      isCaptain,
      applicants: pendingApplicants
    });
    wx.setNavigationBarTitle({ title: team.name });
  },

  loadDetail() {
    const fallback = getTeamById(this.data.id);
    if (fallback) this.applyDetail(fallback);
    this.setData({ loading: !fallback });

    if (isLocalId(this.data.id)) return Promise.resolve(fallback);
    return get(`/api/sports-app/teams/${this.data.id}`, { showLoading: false })
      .then((result) => {
        const team = getTeamById(this.data.id, result?.team || result);
        this.applyDetail(team, result?.members, result?.games, result?.applicants);
        return team;
      })
      .catch(() => {
        this.setData({ loading: false });
        return fallback;
      });
  },

  joinTeam() {
    const team = this.data.team;
    if (!team || team.joined || team.joinPending || this.data.joining) return;
    const user = getStoredUser();
    const finish = (pending) => {
      const updated = recordLocalJoin(team.id, user, pending) || { ...team, joined: !pending, joinPending: pending };
      this.applyDetail(updated);
      this.setData({ joining: false });
      wx.showToast({ title: pending ? "已提交入队申请" : "已加入球队", icon: "success" });
    };

    this.setData({ joining: true });
    if (isLocalId(team.id)) {
      finish(team.requiresApproval);
      return;
    }
    post(`/api/sports-app/teams/${team.id}/join`, {}, { loadingTitle: "提交中" })
      .then((result) => finish(result?.status === "pending" || team.requiresApproval))
      .catch(() => finish(team.requiresApproval));
  },

  openGames() {
    wx.navigateTo({ url: `/pages/team-games/team-games?teamId=${encodeURIComponent(this.data.id)}` });
  },

  openCreateGame() {
    wx.navigateTo({ url: `/pages/team-games/team-games?teamId=${encodeURIComponent(this.data.id)}&create=1` });
  },

  openGame(event) {
    const gameId = event.currentTarget.dataset.id || "";
    wx.navigateTo({
      url: `/pages/team-games/team-games?teamId=${encodeURIComponent(this.data.id)}&gameId=${encodeURIComponent(gameId)}`
    });
  },

  toggleMemberManagement() {
    this.setData({ managing: !this.data.managing });
  },

  handleApplicant(event) {
    const id = event.currentTarget.dataset.id;
    const action = event.currentTarget.dataset.action;
    const applicant = this.data.applicants.find((item) => String(item.id) === String(id));
    if (!applicant || !["approve", "reject"].includes(action)) return;
    const applyLocal = () => {
      const applicants = this.data.applicants.filter((item) => String(item.id) !== String(id));
      const members = action === "approve"
        ? [...this.data.members, { id: applicant.id, userId: 0, name: applicant.name, avatarText: applicant.name.slice(0, 1), role: "member", roleText: "队员", level: applicant.level, attendance: 0, status: "active" }]
        : this.data.members;
      this.setData({
        applicants,
        members,
        stats: buildTeamStats(this.data.team, members, this.data.games)
      });
      wx.showToast({ title: action === "approve" ? "已同意加入" : "已拒绝申请", icon: "success" });
    };

    if (isLocalId(this.data.id)) {
      applyLocal();
      return;
    }
    post(`/api/sports-app/teams/${this.data.id}/members/${id}/status`, { action }, { loadingTitle: "处理中" })
      .then(applyLocal)
      .catch(applyLocal);
  }
});
