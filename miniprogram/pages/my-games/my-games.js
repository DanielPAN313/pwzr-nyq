const { get } = require("../../utils/api");
const { getStoredUser } = require("../../utils/auth");

const fallbackGames = [
  {
    title: "报名或发起球局后会显示在这里",
    time: "待同步",
    venueName: "宁约球",
    roleText: "暂无",
    statusText: "待同步",
    fee: "AA"
  }
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

function isMine(game, user) {
  const userId = user && user.id ? Number(user.id) : 0;
  const creatorId = Number(game.creator_user_id || 0);
  return Boolean(game.is_joined) || (userId > 0 && creatorId === userId);
}

function mapGame(game, user) {
  const fee = Number(game.fee_per_person || 0);
  const userId = user && user.id ? Number(user.id) : 0;
  const isCreator = userId > 0 && Number(game.creator_user_id || 0) === userId;

  return {
    id: game.id,
    title: game.title || "未命名球局",
    time: formatGameTime(game.start_time),
    venueName: game.venue_name || game.area || "场地待定",
    roleText: isCreator ? "我发起" : "我报名",
    statusText: statusText[game.status] || game.status || "未知状态",
    fee: fee ? `¥${fee}/人` : "免费/AA"
  };
}

Page({
  data: {
    loading: false,
    error: "",
    empty: false,
    games: fallbackGames
  },

  onLoad() {
    this.loadMyGames();
  },

  onPullDownRefresh() {
    this.loadMyGames().finally(() => wx.stopPullDownRefresh());
  },

  loadMyGames() {
    this.setData({ loading: true, error: "", empty: false });

    return get("/api/sports-app/games", { showLoading: false })
      .then((games) => {
        const user = getStoredUser() || {};
        const list = Array.isArray(games)
          ? games.filter((game) => isMine(game, user)).map((game) => mapGame(game, user))
          : [];

        this.setData({
          loading: false,
          games: list.length ? list : [],
          empty: list.length === 0
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "我的球局加载失败",
          empty: false,
          games: fallbackGames
        });
      });
  },

  goGames() {
    wx.switchTab({ url: "/pages/games/games" });
  },

  createGame() {
    wx.navigateTo({ url: "/pages/create-game/create-game" });
  },

  openGame(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${id}`
    });
  }
});
