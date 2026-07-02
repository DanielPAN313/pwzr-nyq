const { get } = require("../../utils/api");
const { getStoredUser } = require("../../utils/auth");

const fallbackGames = [
  {
    id: "",
    title: "报名或发起球局后会显示在这里",
    time: "待同步",
    venueName: "宁约球",
    roleText: "暂无",
    statusText: "待同步",
    fee: "AA",
    nextStepTitle: "先去报名或发起一场球局",
    nextStepText: "这里会自动汇总你参与、发起、待核销和待评价的球局。",
    actionText: "去看看"
  }
];

const tabs = [
  { key: "all", label: "全部" },
  { key: "todo", label: "待处理" },
  { key: "created", label: "我发起" },
  { key: "joined", label: "我报名" },
  { key: "completed", label: "已完成" }
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
  const joinedCount = Number(game.joined_count || 0);
  const capacity = Number(game.capacity || 0);
  const missing = Math.max(capacity - joinedCount, 0);
  const status = game.status || "";
  const nextStep = buildNextStep(status, isCreator, missing);

  return {
    id: game.id,
    status,
    isCreator,
    isJoined: Boolean(game.is_joined),
    title: game.title || "未命名球局",
    time: formatGameTime(game.start_time),
    venueName: game.venue_name || game.area || "场地待定",
    roleText: isCreator ? "我发起" : "我报名",
    statusText: statusText[game.status] || game.status || "未知状态",
    fee: fee ? `¥${fee}/人` : "免费/AA",
    joinedText: capacity ? `${joinedCount}/${capacity} 人` : `${joinedCount} 人`,
    progressPercent: capacity ? Math.min(Math.round((joinedCount / capacity) * 100), 100) : 0,
    nextStepTitle: nextStep.title,
    nextStepText: nextStep.text,
    actionText: nextStep.actionText,
    actionTone: nextStep.tone,
    sortTime: new Date(game.start_time).getTime() || 0
  };
}

function buildNextStep(status, isCreator, missing) {
  if (status === "review_open") {
    return {
      tone: "success",
      title: "下一步：提交赛后互评",
      text: "互评开放后尽快给已到场队友评价，信用和实力分会同步更新。",
      actionText: "去互评"
    };
  }

  if (status === "pending_checkin") {
    return {
      tone: "warning",
      title: "下一步：到场核销",
      text: "请准时到场，打开订单里的核销码给场馆端确认。",
      actionText: "看详情"
    };
  }

  if (status === "checked_in") {
    return {
      tone: "success",
      title: "已完成到场核销",
      text: "等待球局结束后进入赛后互评。",
      actionText: "看队友"
    };
  }

  if (["forming", "open"].includes(status)) {
    return {
      tone: missing > 0 ? "info" : "muted",
      title: isCreator ? "下一步：等球友报名" : "你已报名占位",
      text: missing > 0 ? `当前还缺 ${missing} 人，成局前可继续关注人数变化。` : "人数已满，开赛前关注消息提醒。",
      actionText: "看详情"
    };
  }

  if (status === "locked") {
    return {
      tone: "muted",
      title: "球局已满员",
      text: "开赛前请留意订单、核销和消息提醒。",
      actionText: "看详情"
    };
  }

  if (status === "completed") {
    return {
      tone: "muted",
      title: "球局已完成",
      text: "可以回看本场球友和互评状态。",
      actionText: "回看"
    };
  }

  return {
    tone: "muted",
    title: "查看球局状态",
    text: "后续动作会在订单和消息里同步提醒。",
    actionText: "看详情"
  };
}

function buildStatCards(games) {
  const todoStatuses = ["pending_checkin", "review_open"];

  return [
    { label: "我的球局", value: games.length },
    { label: "待处理", value: games.filter((game) => todoStatuses.includes(game.status)).length },
    { label: "我发起", value: games.filter((game) => game.isCreator).length },
    { label: "已完成", value: games.filter((game) => game.status === "completed").length }
  ];
}

function filterGames(games, activeTab) {
  if (activeTab === "todo") return games.filter((game) => ["pending_checkin", "review_open"].includes(game.status));
  if (activeTab === "created") return games.filter((game) => game.isCreator);
  if (activeTab === "joined") return games.filter((game) => game.isJoined && !game.isCreator);
  if (activeTab === "completed") return games.filter((game) => game.status === "completed");
  return games;
}

function sectionTitle(status) {
  if (status === "review_open") return "待赛后互评";
  if (["pending_checkin", "checked_in"].includes(status)) return "到场与核销";
  if (["forming", "open", "locked"].includes(status)) return "进行中";
  if (status === "completed") return "已完成";
  return "其他球局";
}

function buildGameSections(games) {
  const groups = [];

  games.forEach((game) => {
    const title = sectionTitle(game.status);
    let group = groups.find((item) => item.title === title);
    if (!group) {
      group = { title, games: [] };
      groups.push(group);
    }
    group.games.push(game);
  });

  groups.forEach((group) => {
    group.games.sort((a, b) => a.sortTime - b.sortTime);
  });

  return groups;
}

Page({
  data: {
    loading: false,
    error: "",
    empty: false,
    tabs,
    activeTab: "all",
    stats: buildStatCards([]),
    games: fallbackGames,
    visibleGames: fallbackGames,
    gameSections: buildGameSections(fallbackGames)
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
        const sorted = list.sort((a, b) => a.sortTime - b.sortTime);
        const visibleGames = filterGames(sorted, this.data.activeTab);

        this.setData({
          loading: false,
          games: sorted,
          visibleGames,
          gameSections: buildGameSections(visibleGames),
          stats: buildStatCards(sorted),
          empty: sorted.length === 0
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "我的球局加载失败",
          empty: false,
          games: fallbackGames,
          visibleGames: fallbackGames,
          gameSections: buildGameSections(fallbackGames),
          stats: buildStatCards([])
        });
      });
  },

  changeTab(event) {
    const key = event.currentTarget.dataset.key || "all";
    const visibleGames = filterGames(this.data.games, key);

    this.setData({
      activeTab: key,
      visibleGames,
      gameSections: buildGameSections(visibleGames)
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
    if (!id) {
      this.goGames();
      return;
    }

    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${id}`
    });
  },

  openGameAction(event) {
    const id = event.currentTarget.dataset.id;
    const status = event.currentTarget.dataset.status;
    if (!id) {
      this.goGames();
      return;
    }

    wx.navigateTo({
      url: `/pages/game-detail/game-detail?id=${id}${status === "review_open" ? "&review=1" : ""}`
    });
  }
});
