const { get, post } = require("../../utils/api");
const { getStoredUser } = require("../../utils/auth");
const {
  getTeamById,
  getTeamGames,
  isLocalId,
  saveLocalGame,
  signupLocalGame,
  typeMeta
} = require("../../utils/team-stats");

const filterOptions = [
  { value: "all", label: "全部" },
  { value: "training", label: "训练赛" },
  { value: "recruiting", label: "公开招人" },
  { value: "challenge", label: "球队约战" }
];

const gameTypeOptions = [
  { value: "training", label: "队内训练赛" },
  { value: "recruiting", label: "公开招人球局" },
  { value: "challenge", label: "与其他球队约战" }
];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function dateText(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

Page({
  data: {
    teamId: "",
    team: null,
    loading: false,
    submitting: false,
    joiningId: "",
    isCaptain: false,
    createOpen: false,
    selectedGameId: "",
    filterOptions,
    filterIndex: 0,
    allGames: [],
    games: [],
    gameTypeOptions,
    gameTypeIndex: 0,
    title: "周末队内训练",
    date: dateText(3),
    minDate: dateText(),
    startTime: "19:30",
    venueOptions: ["球队主场", "卡子门足球场"],
    venueIndex: 0,
    opponentName: "",
    capacity: 12,
    fee: 0,
    notes: ""
  },

  onLoad(options) {
    const teamId = decodeURIComponent(options.teamId || "demo-team-1");
    const selectedGameId = decodeURIComponent(options.gameId || "");
    this.setData({ teamId, selectedGameId, createOpen: options.create === "1" });
    this.loadGames();
  },

  onShow() {
    if (this.loadedOnce) this.loadGames();
    this.loadedOnce = true;
  },

  onPullDownRefresh() {
    this.loadGames().finally(() => wx.stopPullDownRefresh());
  },

  applyGames(team, remoteGames) {
    if (!team) return;
    const user = getStoredUser() || {};
    const allGames = getTeamGames(team.id, remoteGames);
    const isCaptain = String(team.captainUserId) === String(user.id);
    const currentFilter = filterOptions[this.data.filterIndex]?.value || "all";
    const games = currentFilter === "all" ? allGames : allGames.filter((game) => game.type === currentFilter);
    this.setData({
      loading: false,
      team,
      isCaptain,
      createOpen: isCaptain && this.data.createOpen,
      allGames,
      games,
      venueOptions: ["卡子门足球场"]
    });
    wx.setNavigationBarTitle({ title: `${team.name} · 比赛` });
  },

  loadGames() {
    const fallbackTeam = getTeamById(this.data.teamId);
    if (fallbackTeam) this.applyGames(fallbackTeam);
    this.setData({ loading: !fallbackTeam });
    if (isLocalId(this.data.teamId)) return Promise.resolve();
    return get(`/api/sports-app/teams/${this.data.teamId}/games`, { showLoading: false })
      .then((result) => {
        const team = getTeamById(this.data.teamId, result?.team) || fallbackTeam;
        this.applyGames(team, Array.isArray(result) ? result : result?.games);
      })
      .catch(() => this.setData({ loading: false }));
  },

  changeFilter(event) {
    const filterIndex = Number(event.currentTarget.dataset.index || 0);
    const filter = filterOptions[filterIndex]?.value || "all";
    const games = filter === "all" ? this.data.allGames : this.data.allGames.filter((game) => game.type === filter);
    this.setData({ filterIndex, games });
  },

  toggleCreateForm() {
    if (!this.data.isCaptain) return;
    this.setData({ createOpen: !this.data.createOpen });
  },

  changeGameType(event) {
    this.setData({ gameTypeIndex: Number(event.detail.value || 0) });
  },

  updateTitle(event) {
    this.setData({ title: event.detail.value });
  },

  changeDate(event) {
    this.setData({ date: event.detail.value });
  },

  changeStartTime(event) {
    this.setData({ startTime: event.detail.value });
  },

  changeVenue(event) {
    this.setData({ venueIndex: Number(event.detail.value || 0) });
  },

  updateOpponent(event) {
    this.setData({ opponentName: event.detail.value });
  },

  updateCapacity(event) {
    this.setData({ capacity: Number(event.detail.value || 0) });
  },

  updateFee(event) {
    this.setData({ fee: Number(event.detail.value || 0) });
  },

  updateNotes(event) {
    this.setData({ notes: event.detail.value });
  },

  submitGame() {
    const title = String(this.data.title || "").trim();
    const type = gameTypeOptions[this.data.gameTypeIndex]?.value || "training";
    if (!this.data.isCaptain || this.data.submitting) return;
    if (!title) {
      wx.showToast({ title: "请填写比赛名称", icon: "none" });
      return;
    }
    if (type === "challenge" && !String(this.data.opponentName || "").trim()) {
      wx.showToast({ title: "请填写约战球队", icon: "none" });
      return;
    }
    if (Number(this.data.capacity || 0) < 2) {
      wx.showToast({ title: "参赛人数至少 2 人", icon: "none" });
      return;
    }

    const payload = {
      team_id: this.data.teamId,
      type,
      title,
      venue_name: this.data.venueOptions[this.data.venueIndex],
      opponent_name: String(this.data.opponentName || "").trim(),
      start_time: `${this.data.date} ${this.data.startTime}:00`,
      capacity: Number(this.data.capacity),
      fee_per_person: Math.max(0, Number(this.data.fee || 0)),
      notes: String(this.data.notes || "").trim(),
      status: "open",
      signup_count: 1,
      joined: true
    };
    const finish = (id, localOnly) => {
      saveLocalGame(payload, id);
      this.setData({ submitting: false, createOpen: false, title: "周末队内训练", opponentName: "", notes: "" });
      this.applyGames(this.data.team, this.data.allGames);
      wx.showToast({ title: localOnly ? "比赛已保存" : "比赛发布成功", icon: "success" });
    };

    this.setData({ submitting: true });
    if (isLocalId(this.data.teamId)) {
      finish("", true);
      return;
    }
    post(`/api/sports-app/teams/${this.data.teamId}/games`, payload, { loadingTitle: "发布中" })
      .then((result) => finish(result?.id, false))
      .catch(() => finish("", true));
  },

  signupGame(event) {
    const id = event.currentTarget.dataset.id;
    const game = this.data.allGames.find((item) => String(item.id) === String(id));
    if (!game || game.joined || game.status !== "open" || this.data.joiningId) return;
    const finish = () => {
      saveLocalGame(game, id);
      signupLocalGame(id);
      this.setData({ joiningId: "" });
      this.applyGames(this.data.team, this.data.allGames);
      wx.showToast({ title: "报名成功", icon: "success" });
    };
    this.setData({ joiningId: String(id) });
    if (isLocalId(id)) {
      finish();
      return;
    }
    post(`/api/sports-app/team-games/${id}/join`, {}, { loadingTitle: "报名中" })
      .then(finish)
      .catch(finish);
  },

  toggleGameDetail(event) {
    const id = String(event.currentTarget.dataset.id || "");
    this.setData({ selectedGameId: this.data.selectedGameId === id ? "" : id });
  }
});
