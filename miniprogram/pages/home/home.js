const { get } = require("../../utils/api");
const { setPendingPaymentCount } = require("../../utils/tab-bar-state");

const fallbackSummary = "这里会从旧 H5 原型迁移真实首页数据、推荐场馆、今日球局和订单提醒。";
const homeGameTemplate = {
  title: "5v5足球",
  desc: "阿杰已预留 1 个名额 · 今晚 20:00",
  venue: "卡子门足球场",
  mode: "3v3",
  fee: "AA ¥32",
  actionText: "查看邀请"
};

const recruitingGames = [
  { id: "recruit-1", countdownSeconds: 430, slotsLeft: 1 },
  { id: "recruit-2", countdownSeconds: 980, slotsLeft: 2 },
  { id: "recruit-3", countdownSeconds: 1960, slotsLeft: 3 }
];

const nearbyGames = [
  { id: "nearby-1", countdownSeconds: 620, slotsLeft: 1, distanceText: "距你 1.2km" },
  { id: "nearby-2", countdownSeconds: 1240, slotsLeft: 2, distanceText: "距你 1.8km" },
  { id: "nearby-3", countdownSeconds: 1820, slotsLeft: 3, distanceText: "距你 2.4km" }
];

const fallbackAttendance = [
  { id: "attendance-1", rank: 1, name: "王一鸣", attendanceText: "14 次", rateText: "100%" },
  { id: "attendance-2", rank: 2, name: "赵子墨", attendanceText: "13 次", rateText: "97%" },
  { id: "attendance-3", rank: 3, name: "孙晨", attendanceText: "12 次", rateText: "96%" }
];

const feedCopy = {
  recruiting: {
    title: "正在招人",
    subtitle: "附近还缺人的公开球局，报名即可锁位"
  },
  nearby: {
    title: "离我最近",
    subtitle: "优先展示离你更近的卡子门附近球局"
  }
};

function gameCountdownSeconds(game) {
  const start = new Date(game.start_time || Date.now() + 30 * 60 * 1000);
  if (Number.isNaN(start.getTime())) return 1800;
  return Math.max(0, Math.floor((start.getTime() - Date.now()) / 1000));
}

function mapHomeGame(game, index) {
  const joined = Number(game.joined_count || 0);
  const capacity = Number(game.capacity || 0);
  const slotsLeft = capacity > joined ? capacity - joined : Math.max(1, index + 1);
  const start = game.start_time ? new Date(game.start_time) : null;
  const hostName = game.username || game.host_name || game.creator_name || game.nickName || "发起人";
  const timeText = start && !Number.isNaN(start.getTime())
    ? `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`
    : "20:00";
  const fee = Number(game.fee_per_person || 0);
  const typeValue = game.game_type || game.match_type || game.type || "casual";
  const eventGame = ["event", "tournament", "赛事局"].includes(typeValue);

  return {
    id: game.id || `game-${index}`,
    title: game.title || homeGameTemplate.title,
    desc: `${slotsLeft} 个名额 · ${timeText}`,
    venue: game.venue_name || game.area || homeGameTemplate.venue,
    mode: capacity ? `${capacity}人局` : homeGameTemplate.mode,
    fee: fee ? `¥${fee}/人` : homeGameTemplate.fee,
    hostName,
    timeText,
    actionText: homeGameTemplate.actionText,
    typeText: eventGame ? "赛事局" : "散客局",
    typeTone: eventGame ? "event" : "casual",
    countdownSeconds: gameCountdownSeconds(game),
    slotsLeft
  };
}

function mapAttendancePreview(item, index) {
  const attendance = Number(item.attendance ?? item.attendance_count ?? item.value ?? 0);
  const rate = Number(item.rate ?? item.attendance_rate ?? item.percent ?? 0);
  return {
    id: item.id || `attendance-${index}`,
    rank: index + 1,
    name: item.name || item.username || "球友",
    attendanceText: `${attendance} 次`,
    rateText: `${rate || 0}%`
  };
}

const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
};

const buildPrioritizedGames = (games) =>
  games
    .map((game) => ({
      ...homeGameTemplate,
      ...game,
      countdownText: formatCountdown(game.countdownSeconds),
      slotsText: `余 ${game.slotsLeft} 人`
    }))
    .sort((a, b) => a.countdownSeconds - b.countdownSeconds)
    .map((game, index) => ({
      ...game,
      featured: index === 0
    }));

const recruitingCardTemplate = {
  title: "正在招人",
  hostName: "发起人",
  timeText: "今晚 20:00",
  venue: "卡子门足球场",
  mode: "5v5",
  fee: "AA ¥32",
  thumbLabel: "招",
  actionText: "查看邀请",
  typeText: "散客局",
  typeTone: "casual"
};

const bookingHeroTemplate = {
  venueName: "卡子门足球场",
  weekBookings: 12
};

const buildRecruitingCards = (games) =>
  buildPrioritizedGames(games).map((game) => {
    const hostName = game.hostName || recruitingCardTemplate.hostName;
    const timeText = game.timeText || recruitingCardTemplate.timeText;
    const venue = game.venue || recruitingCardTemplate.venue;
    const mode = game.mode || recruitingCardTemplate.mode;
    const fee = game.fee || recruitingCardTemplate.fee;

    return {
      ...recruitingCardTemplate,
      ...game,
      title: game.title || recruitingCardTemplate.title,
      hostName,
      timeText,
      desc: game.desc || `${hostName} · ${timeText}`,
      venue,
      mode,
      fee,
      thumbLabel: game.thumbLabel || recruitingCardTemplate.thumbLabel,
      reserveLine: game.reserveLine || `${game.distanceText ? `${game.distanceText} · ` : ""}${hostName}已预留 ${Math.max(1, Number(game.slotsLeft || 1))} 个名额 · ${timeText}`,
      hostLine: `${hostName}·${timeText}`,
      metaLine: `${venue}·${mode}·${fee}`,
      actionText: recruitingCardTemplate.actionText
    };
  });

function buildGameHero(game) {
  const next = game || buildRecruitingCards(recruitingGames)[0] || {};
  const slotsLeft = Number(next.slotsLeft || 2);
  const feeText = String(next.fee || "AA ¥35").replace("楼", "¥").replace("/人", "");

  return {
    id: next.id || "recruit-1",
    title: next.title || "正在组局",
    timeText: next.timeText || "今晚 20:00",
    mode: next.mode || "五人制",
    slotsText: `缺 ${slotsLeft} 人`,
    feeText,
    venue: next.venue || "卡子门足球场",
    desc: next.desc || `${next.timeText || "今晚 20:00"} ${next.mode || "五人制"}`,
    fee: next.fee || feeText
  };
}

Page({
  data: {
    loading: false,
    error: "",
    summary: fallbackSummary,
    heroIndex: 0,
    homeFeedMode: "recruiting",
    homeFeedTitle: feedCopy.recruiting.title,
    homeFeedSubtitle: feedCopy.recruiting.subtitle,
    bookingHero: bookingHeroTemplate,
    gameHero: buildGameHero(),
    attendancePreview: fallbackAttendance,
    recruitingGames: buildRecruitingCards(recruitingGames),
    nearbyGames: buildRecruitingCards(nearbyGames),
    displayedGames: buildRecruitingCards(recruitingGames)
  },

  onLoad() {
    this.startHomeCountdown();
    this.loadBootstrap();
    this.loadAttendancePreview();
  },

  loadAttendancePreview() {
    return get("/api/sports-app/rankings", { showLoading: false })
      .then((payload) => {
        const source = Array.isArray(payload?.attendance) ? payload.attendance : [];
        if (!source.length) return;
        this.setData({ attendancePreview: source.slice(0, 3).map(mapAttendancePreview) });
      })
      .catch(() => {});
  },

  openAttendanceRanking() {
    wx.navigateTo({ url: "/pages/rankings/rankings" });
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
      if (typeof this.getTabBar().syncTabState === "function") {
        this.getTabBar().syncTabState();
      }
    }
  },

  loadBootstrap() {
    this.setData({ loading: true, error: "" });

    get("/api/sports-app/bootstrap", { showLoading: false })
      .then((data) => {
        const venueCount = Array.isArray(data.venues) ? data.venues.length : 0;
        const games = Array.isArray(data.games) ? data.games : [];
        const gameCount = games.length;
        const orderCount = Array.isArray(data.orders) ? data.orders.length : 0;
        const pendingPaymentCount = Array.isArray(data.orders)
          ? data.orders.filter((order) => order && order.status === "pending_payment").length
          : 0;
        const mappedGames = games.map(mapHomeGame);
        const nextRecruitingGames = mappedGames.length ? buildRecruitingCards(mappedGames.slice(1, 4).length ? mappedGames.slice(1, 4) : mappedGames) : this.data.recruitingGames;
        const nextNearbyGames = mappedGames.length ? buildRecruitingCards(mappedGames.slice().reverse().slice(0, 3)) : this.data.nearbyGames;
        const nextDisplayedGames = this.data.homeFeedMode === "nearby" ? nextNearbyGames : nextRecruitingGames;

        setPendingPaymentCount(pendingPaymentCount);
        this.setData({
          loading: false,
          bookingHero: {
            ...bookingHeroTemplate,
            weekBookings: Math.max(12, orderCount || 0)
          },
          gameHero: buildGameHero(nextRecruitingGames[0]),
          summary: `今日已加载 ${venueCount} 个场馆、${gameCount} 场球局、${orderCount} 条订单提醒。`,
          recruitingGames: nextRecruitingGames,
          nearbyGames: nextNearbyGames,
          displayedGames: nextDisplayedGames
        });
        if (typeof this.getTabBar === "function" && this.getTabBar() && typeof this.getTabBar().syncTabState === "function") {
          this.getTabBar().syncTabState();
        }
      })
      .catch(() => {
        this.setData({
          loading: false,
          error: "",
          summary: fallbackSummary
        });
      });
  },

  switchTab(event) {
    const target = event.currentTarget.dataset.target;
    if (!target) return;

    if (["/pages/home/home", "/pages/venues/venues", "/pages/rankings/rankings", "/pages/messages/messages", "/pages/me/me"].includes(target)) {
      wx.switchTab({ url: target });
      return;
    }

    wx.navigateTo({ url: target });
  },

  onHeroSwiperChange(event) {
    this.setData({
      heroIndex: Number(event.detail.current || 0)
    });
  },

  setHomeFeedMode(event) {
    const mode = event.currentTarget.dataset.mode === "nearby" ? "nearby" : "recruiting";
    const copy = feedCopy[mode] || feedCopy.recruiting;
    this.setData({
      homeFeedMode: mode,
      homeFeedTitle: copy.title,
      homeFeedSubtitle: copy.subtitle,
      displayedGames: mode === "nearby" ? this.data.nearbyGames : this.data.recruitingGames
    });
  },

  openHeroCard(event) {
    const action = event.currentTarget.dataset.action || "";
    if (action === "bookVenue") {
      wx.switchTab({ url: "/pages/venues/venues" });
    }
  },

  openHomeGame(event) {
    const item = event.currentTarget.dataset || {};
    const id = item.id || "";
    const query = [
      `id=${encodeURIComponent(id)}`,
      `preview=1`,
      `title=${encodeURIComponent(item.title || "附近球局")}`,
      `venue=${encodeURIComponent(item.venue || "场地待定")}`,
      `desc=${encodeURIComponent(item.desc || "")}`,
      `fee=${encodeURIComponent(item.fee || "免费/AA")}`
    ].join("&");

    wx.navigateTo({ url: `/pages/game-detail/game-detail?${query}` });
  },

  onUnload() {
    if (this.countdownTimer && typeof clearInterval === "function") {
      clearInterval(this.countdownTimer);
    }
  },

  startHomeCountdown() {
    if (typeof setInterval !== "function") return;

    this.countdownTimer = setInterval(() => {
      const tick = (games) => (games || []).map((game) => ({
        ...game,
        countdownSeconds: Math.max(0, Number(game.countdownSeconds || 0) - 1)
      }));

      const nextRecruitingGames = buildPrioritizedGames(tick(this.data.recruitingGames));
      const nextNearbyGames = buildPrioritizedGames(tick(this.data.nearbyGames));

      this.setData({
        recruitingGames: nextRecruitingGames,
        nearbyGames: nextNearbyGames,
        displayedGames: this.data.homeFeedMode === "nearby" ? nextNearbyGames : nextRecruitingGames,
        gameHero: buildGameHero(nextRecruitingGames[0])
      });
    }, 1000);
  }
});
