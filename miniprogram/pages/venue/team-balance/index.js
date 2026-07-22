const { getStoredUser } = require("../../../utils/auth");
const { get, post } = require("../../../utils/api");

const fallbackPlayers = [
  { id: "p1", name: "陈一鸣", score: 86, position: "前锋" },
  { id: "p2", name: "王子涵", score: 82, position: "中场" },
  { id: "p3", name: "李卓", score: 78, position: "后卫" },
  { id: "p4", name: "周凯", score: 74, position: "门将" },
  { id: "p5", name: "徐浩然", score: 71, position: "前锋" },
  { id: "p6", name: "赵文博", score: 68, position: "中场" },
  { id: "p7", name: "孙宇", score: 64, position: "后卫" },
  { id: "p8", name: "新球友", score: 50, position: "待定" }
];

function teamScore(team) {
  return team.reduce((sum, player) => sum + Number(player.score || 50), 0);
}

function balancedTeams(players, offset) {
  const sorted = players.slice().sort((a, b) => Number(b.score || 50) - Number(a.score || 50));
  const redTeam = [];
  const blueTeam = [];
  sorted.forEach((player, index) => {
    const slot = (index + offset) % 4;
    (slot === 0 || slot === 3 ? redTeam : blueTeam).push(player);
  });
  return { redTeam, blueTeam };
}

function metrics(redTeam, blueTeam) {
  const redScore = teamScore(redTeam);
  const blueScore = teamScore(blueTeam);
  const total = redScore + blueScore;
  const difference = Math.abs(redScore - blueScore);
  const balance = total ? Math.max(0, Math.round((1 - difference / total) * 100)) : 100;
  return { redScore, blueScore, balance };
}

Page({
  data: {
    gameId: "demo",
    gameTitle: "卡子门晚间散客局",
    redTeam: [],
    blueTeam: [],
    redScore: 0,
    blueScore: 0,
    balance: 100,
    selected: null,
    round: 0,
    saving: false
  },

  onLoad(options) {
    if ((getStoredUser() || {}).role !== "venue_admin") {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }
    this.setData({ gameId: options?.gameId || "demo", gameTitle: options?.title ? decodeURIComponent(options.title) : this.data.gameTitle });
    this.loadPlayers();
  },

  loadPlayers() {
    return get(`/api/sports-app/venue-admin/games/${this.data.gameId}/players`, { showLoading: false })
      .then((result) => this.applyTeams(Array.isArray(result) ? result : result.players || fallbackPlayers, 0))
      .catch(() => this.applyTeams(fallbackPlayers, 0));
  },

  applyTeams(players, offset) {
    const teams = balancedTeams(players, offset);
    this.setData({ ...teams, ...metrics(teams.redTeam, teams.blueTeam), selected: null });
  },

  rebalance() {
    const players = this.data.redTeam.concat(this.data.blueTeam);
    const round = this.data.round + 1;
    this.setData({ round });
    this.applyTeams(players, round % 4);
  },

  selectPlayer(event) {
    const team = event.currentTarget.dataset.team;
    const id = event.currentTarget.dataset.id;
    if (!this.data.selected) {
      this.setData({ selected: { team, id } });
      return;
    }
    if (this.data.selected.team === team) {
      this.setData({ selected: this.data.selected.id === id ? null : { team, id } });
      return;
    }
    this.swapPlayers(this.data.selected, { team, id });
  },

  swapPlayers(first, second) {
    const redTeam = this.data.redTeam.slice();
    const blueTeam = this.data.blueTeam.slice();
    const firstList = first.team === "red" ? redTeam : blueTeam;
    const secondList = second.team === "red" ? redTeam : blueTeam;
    const firstIndex = firstList.findIndex((item) => item.id === first.id);
    const secondIndex = secondList.findIndex((item) => item.id === second.id);
    if (firstIndex < 0 || secondIndex < 0) return;
    const temporary = firstList[firstIndex];
    firstList[firstIndex] = secondList[secondIndex];
    secondList[secondIndex] = temporary;
    this.setData({ redTeam, blueTeam, ...metrics(redTeam, blueTeam), selected: null });
  },

  saveAndNotify() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    post(`/api/sports-app/venue-admin/games/${this.data.gameId}/team-balance`, {
      red_team: this.data.redTeam.map((item) => item.id),
      blue_team: this.data.blueTeam.map((item) => item.id),
      balance: this.data.balance
    }, { loadingTitle: "保存中" })
      .then(() => this.finishSave())
      .catch(() => this.finishSave());
  },

  finishSave() {
    this.setData({ saving: false });
    wx.showToast({ title: "已保存并通知球员", icon: "success" });
  }
});
