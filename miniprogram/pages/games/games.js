const { get, post } = require("../../utils/api");

const fallbackGames = [
  { id: "", title: "今晚江宁五人制足球", time: "今天 19:30", status: "缺 2 人", venueName: "卡子门足球场", mode: "5v5", fee: "AA", typeText: "散客局", typeTone: "casual", canJoin: false, actionText: "去这场" },
  { id: "", title: "卡子门周末对抗赛", time: "明天 20:00", status: "缺 1 人", venueName: "卡子门足球场", mode: "7v7", fee: "AA", typeText: "赛事局", typeTone: "event", canJoin: false, actionText: "去这场" }
];

const statusText = {
  forming: "待成局",
  open: "可报名",
  locked: "已满员",
  pending_checkin: "待核销",
  checked_in: "已核销",
  review_open: "待评价",
  completed: "已完成",
  cancelled: "已取消"
};

function formatGameTime(value) {
  if (!value) return "时间待定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day} ${hour}:${minute}`;
}

function mapGame(game) {
  const joined = Number(game.joined_count || 0);
  const capacity = Number(game.capacity || 0);
  const missing = capacity > joined ? `缺 ${capacity - joined} 人` : "已满员";
  const fee = Number(game.fee_per_person || 0);
  const canJoin = Boolean(game.id) && !game.is_joined && ["forming", "open"].includes(game.status);
  const typeValue = game.game_type || game.match_type || game.type || "casual";
  const eventGame = ["event", "tournament", "赛事局"].includes(typeValue);

  return {
    id: game.id,
    title: game.title || "未命名球局",
    time: formatGameTime(game.start_time),
    status: statusText[game.status] || missing,
    venueName: game.venue_name || game.area || "场地待定",
    mode: game.mode || game.format || (capacity ? `${capacity}人局` : "5v5"),
    fee: fee ? `¥${fee}/人` : "免费/AA",
    typeText: eventGame ? "赛事局" : "散客局",
    typeTone: eventGame ? "event" : "casual",
    canJoin,
    actionText: "去这场"
  };
}

function filterGames(games, keyword) {
  const query = String(keyword || "").trim().toLowerCase();
  const list = Array.isArray(games) ? games : [];
  if (!query) return list.slice();

  return list.filter((game) => {
    const text = [
      game.title,
      game.time,
      game.status,
      game.venueName,
      game.typeText,
      game.mode,
      game.fee
    ].join(" ").toLowerCase();

    return text.includes(query);
  });
}

Page({
  data: {
    loading: false,
    joiningId: "",
    error: "",
    empty: false,
    keyword: "",
    allGames: fallbackGames,
    games: fallbackGames
  },

  onLoad() {
    this.loadGames();
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  onPullDownRefresh() {
    this.loadGames().finally(() => wx.stopPullDownRefresh());
  },

  loadGames() {
    this.setData({ loading: true, error: "", empty: false });

    return get("/api/sports-app/games", { showLoading: false })
      .then((games) => {
        const list = Array.isArray(games) ? games.map(mapGame) : [];
        const allGames = list.length ? list : [];
        const visibleGames = filterGames(allGames, this.data.keyword);

        this.setData({
          loading: false,
          allGames,
          games: visibleGames,
          empty: visibleGames.length === 0
        });
      })
      .catch(() => {
        const visibleGames = filterGames(fallbackGames, this.data.keyword);

        this.setData({
          loading: false,
          error: "",
          empty: visibleGames.length === 0,
          allGames: fallbackGames,
          games: visibleGames
        });
      });
  },

  onSearchInput(event) {
    const keyword = event.detail.value || "";
    const games = filterGames(this.data.allGames, keyword);

    this.setData({
      keyword,
      games,
      empty: games.length === 0
    });
  },

  clearSearch() {
    const games = filterGames(this.data.allGames, "");

    this.setData({
      keyword: "",
      games,
      empty: games.length === 0
    });
  },

  openGame(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) {
      wx.showToast({ title: "体验数据暂不支持报名", icon: "none" });
      return;
    }

    this.joinGame(event);
  },

  openGameDetail(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) {
      wx.showToast({ title: "体验数据暂无详情", icon: "none" });
      return;
    }

    wx.navigateTo({ url: `/pages/game-detail/game-detail?id=${id}` });
  },

  createGame() {
    wx.navigateTo({ url: "/pages/create-game/create-game" });
  },

  goTeams() {
    wx.navigateTo({ url: "/pages/teams/teams" });
  },

  goMyGames() {
    wx.navigateTo({ url: "/pages/my-games/my-games" });
  },

  goRankings() {
    wx.navigateTo({ url: "/pages/rankings/rankings" });
  },

  joinGame(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.joiningId) return;

    this.setData({ joiningId: id });

    post(`/api/sports-app/games/${id}/join`, {}, { loadingTitle: "报名中" })
      .then((result) => {
        wx.showToast({
          title: result.order_id ? "已生成待支付订单" : "报名成功",
          icon: "success"
        });

        return this.loadGames();
      })
      .catch(() => {})
      .finally(() => {
        this.setData({ joiningId: "" });
      });
  }
});
