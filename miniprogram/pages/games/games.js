const { get, post } = require("../../utils/api");
const { getStoredUser } = require("../../utils/auth");
const { buildSharePayload } = require("../../utils/share");
const { evaluateCreditAccess, loadCreditAccess } = require("../../utils/credit-access");

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
    venueName: "卡子门足球场",
    mode: game.mode || game.format || (capacity ? `${capacity}人局` : "5v5"),
    fee: fee ? `¥${fee}/人` : "免费/AA",
    typeText: eventGame ? "赛事局" : "散客局",
    typeTone: eventGame ? "event" : "casual",
    matchType: eventGame ? "event" : "casual",
    joinedCount: joined,
    capacity,
    feeAmount: fee,
    creatorUserId: game.creator_user_id || "",
    canJoin,
    baseCanJoin: canJoin,
    actionText: "去这场"
  };
}

function applyGameAccess(game, access) {
  const source = game || {};
  const casual = source.matchType === "casual" || source.typeTone === "casual";
  const currentUser = getStoredUser() || {};
  const ownGameBlocked = casual && access.creditScore < 80 && source.creatorUserId && String(source.creatorUserId) === String(currentUser.id || "");
  const creditBlocked = casual && (access.joinBlockedByCredit || ownGameBlocked);
  const profileBlocked = casual && !access.profileReady;
  return {
    ...source,
    creditBlocked,
    ownGameBlocked,
    profileBlocked,
    canJoin: Boolean(source.baseCanJoin ?? source.canJoin) && !creditBlocked && !profileBlocked,
    actionText: ownGameBlocked ? "仅可报名他人球局" : creditBlocked ? "信用分不足" : profileBlocked ? "先填档案" : source.actionText || "去这场"
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
    access: evaluateCreditAccess(100, false),
    allGames: fallbackGames,
    games: fallbackGames
  },

  onLoad() {
    wx.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage"] });
    this.refreshCreditAccess();
    this.loadGames();
  },

  onShareAppMessage(event) {
    const id = event?.target?.dataset?.id;
    const game = this.data.allGames.find((item) => String(item.id) === String(id)) || this.data.games[0] || {};
    const user = getStoredUser() || {};
    return buildSharePayload(game, user.id || user.username || "nyq-player");
  },

  copyInvitePath(event) {
    const id = event.currentTarget.dataset.id;
    const game = this.data.allGames.find((item) => String(item.id) === String(id)) || {};
    const user = getStoredUser() || {};
    const payload = buildSharePayload(game, user.id || user.username || "nyq-player");
    wx.setClipboardData({
      data: payload.path,
      success() {
        wx.showToast({ title: "邀请路径已复制", icon: "success" });
      }
    });
  },

  onShow() {
    this.refreshCreditAccess();
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
  },

  refreshCreditAccess() {
    return loadCreditAccess().then((access) => {
      const allGames = this.data.allGames.map((game) => applyGameAccess(game, access));
      this.setData({
        access,
        allGames,
        games: filterGames(allGames, this.data.keyword)
      });
      return access;
    });
  },

  onPullDownRefresh() {
    this.loadGames().finally(() => wx.stopPullDownRefresh());
  },

  loadGames() {
    this.setData({ loading: true, error: "", empty: false });

    return get("/api/sports-app/games", { showLoading: false })
      .then((games) => {
        const list = Array.isArray(games) ? games.map(mapGame) : [];
        const allGames = (list.length ? list : []).map((game) => applyGameAccess(game, this.data.access));
        const visibleGames = filterGames(allGames, this.data.keyword);

        this.setData({
          loading: false,
          allGames,
          games: visibleGames,
          empty: visibleGames.length === 0
        });
      })
      .catch(() => {
        const allGames = fallbackGames.map((game) => applyGameAccess(game, this.data.access));
        const visibleGames = filterGames(allGames, this.data.keyword);

        this.setData({
          loading: false,
          error: "",
          empty: visibleGames.length === 0,
          allGames,
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
    const game = this.data.allGames.find((item) => String(item.id) === String(id)) || null;
    if (game?.ownGameBlocked) {
      this.showOwnGameBlocked();
      return;
    }
    if (game?.creditBlocked) {
      this.showCreditBlocked();
      return;
    }
    if (game?.profileBlocked) {
      this.showProfileRequired();
      return;
    }
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
    if (this.data.access.createBlockedByCredit) {
      wx.showModal({
        title: "暂不能发起散客球局",
        content: this.data.access.createHint,
        showCancel: false
      });
      return;
    }
    wx.navigateTo({ url: "/pages/create-game/create-game" });
  },

  showCreditBlocked() {
    wx.showModal({
      title: "信用分不足",
      content: "信用分不足，无法报名。可通过按时到场踢球恢复（+2 分/次）",
      confirmText: "查看信用分",
      success(result) {
        if (result.confirm) wx.navigateTo({ url: "/pages/credit/credit" });
      }
    });
  },

  showOwnGameBlocked() {
    wx.showModal({
      title: "当前仅可报名他人球局",
      content: "信用分 60-79 分期间，可报名他人发起的散客球局；达到 80 分后恢复发起和本人球局能力。",
      showCancel: false
    });
  },

  showProfileRequired() {
    wx.showModal({
      title: "先完成球员档案",
      content: "报名散客球局前，需要填写六维实力和擅长位置。",
      confirmText: "去填写",
      success(result) {
        if (result.confirm) wx.navigateTo({ url: "/pages/player-profile/edit/index" });
      }
    });
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
    const game = this.data.allGames.find((item) => String(item.id) === String(id));
    if (game?.ownGameBlocked) return this.showOwnGameBlocked();
    if (game?.creditBlocked) return this.showCreditBlocked();
    if (game?.profileBlocked) return this.showProfileRequired();
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
