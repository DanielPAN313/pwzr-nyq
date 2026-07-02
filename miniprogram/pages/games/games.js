const { get, post } = require("../../utils/api");

const fallbackGames = [
  { title: "今晚江宁五人制足球", time: "今天 19:30", status: "缺 2 人", venueName: "未来科技城五人制足球馆", fee: "AA", canJoin: false, actionText: "待同步" },
  { title: "大学城 3v3 篮球局", time: "明天 20:00", status: "缺 1 人", venueName: "江宁大学城篮球馆", fee: "AA", canJoin: false, actionText: "待同步" }
];

const sportFilters = [
  { label: "全部", value: "all" },
  { label: "足球", value: "football" },
  { label: "篮球", value: "basketball" }
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

  return {
    id: game.id,
    title: game.title || "未命名球局",
    sport: game.sport || "",
    time: formatGameTime(game.start_time),
    status: statusText[game.status] || missing,
    venueName: game.venue_name || game.area || "场地待定",
    fee: fee ? `¥${fee}/人` : "免费/AA",
    canJoin,
    actionText: game.is_joined ? "已报名" : canJoin ? "报名" : "不可报名"
  };
}

Page({
  data: {
    loading: false,
    joiningId: "",
    query: "",
    activeSport: "all",
    sportFilters,
    error: "",
    empty: false,
    allGames: [],
    games: fallbackGames
  },

  onLoad() {
    this.loadGames();
  },

  onShow() {
    this.loadGames();
  },

  onPullDownRefresh() {
    this.loadGames().finally(() => wx.stopPullDownRefresh());
  },

  loadGames() {
    this.setData({ loading: true, error: "", empty: false });

    return get("/api/sports-app/games", { showLoading: false })
      .then((games) => {
        const list = Array.isArray(games) ? games.map(mapGame) : [];

        this.setData({
          loading: false,
          allGames: list
        });

        this.applyFilters();
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "球局数据加载失败",
          empty: false,
          allGames: fallbackGames,
          games: fallbackGames
        });
      });
  },

  applyFilters() {
    const query = String(this.data.query || "").trim().toLowerCase();
    const activeSport = this.data.activeSport || "all";
    const allGames = Array.isArray(this.data.allGames) ? this.data.allGames : [];

    const games = allGames.filter((game) => {
      const text = `${game.title || ""} ${game.venueName || ""} ${game.status || ""}`.toLowerCase();
      const matchesQuery = !query || text.includes(query);
      const matchesSport = activeSport === "all" || game.sport === activeSport;

      return matchesQuery && matchesSport;
    });

    this.setData({
      games,
      empty: !this.data.loading && games.length === 0
    });
  },

  onSearchInput(event) {
    this.setData({
      query: event.detail.value || ""
    });
    this.applyFilters();
  },

  changeSport(event) {
    this.setData({
      activeSport: event.currentTarget.dataset.value || "all"
    });
    this.applyFilters();
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
      .catch((error) => {
        wx.showToast({
          title: error.message || "报名失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ joiningId: "" });
      });
  },

  createGame() {
    wx.navigateTo({
      url: "/pages/create-game/create-game"
    });
  },

  openGame(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${id}`
    });
  }
});
