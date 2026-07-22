const { get } = require("../../utils/api");
const { getStoredUser } = require("../../utils/auth");
const {
  calculateRating,
  drawRadarChart,
  getStoredProfile,
  getStoredReviews,
  storeProfileFromServer,
  storeReviewsFromServer
} = require("../../utils/player-rating");

const fallbackItems = [
  { label: "我的订单", value: "0 单", target: "/pages/orders/orders", tone: "default", hint: "查看支付、核销和取消" },
  { label: "我的球局", value: "0 场", target: "/pages/my-games/my-games", tone: "default", hint: "回看报名、到场和互评" },
  { label: "信用分", value: "100", target: "/pages/credit/credit", tone: "default", hint: "查看信用记录" },
  { label: "支付与规则", value: "查看", target: "/pages/legal/legal", tone: "subtle", hint: "支付、取消、信用说明" }
];

const venueModeEntry = {
  label: "切换至场馆模式",
  subLabel: "仅场馆管理员可见",
  target: "/pages/venue/home/index"
};

function buildStats(summary) {
  const next = summary || {};

  return [
    { label: "信用分", value: String(next.credit_score ?? 100), tone: "default" },
    { label: "待核销", value: String(next.pending_checkins || 0), tone: "warning" },
    { label: "本周局", value: String(next.week_games || next.played || 0), tone: "default" }
  ];
}

function buildItems(profile) {
  const summary = profile.summary || {};
  const orders = Array.isArray(profile.orders) ? profile.orders : [];
  return [
    { label: "我的订单", value: `${orders.length} 单`, target: "/pages/orders/orders", tone: "default", hint: "查看支付、核销和取消" },
    { label: "我的球局", value: `${summary.played || 0} 场`, target: "/pages/my-games/my-games", tone: "default", hint: "回看报名、到场和互评" },
    { label: "信用分", value: String(summary.credit_score ?? 100), target: "/pages/credit/credit", tone: "default", hint: "查看信用记录" },
    { label: "支付与规则", value: "查看", target: "/pages/legal/legal", tone: "subtle", hint: "支付、取消、信用说明" }
  ];
}

function isVenueAdmin(profile, user) {
  const summary = profile.summary || {};
  const role = profile.role || profile.user?.role || summary.role || user.role || "";
  return role === "venue_admin";
}

function buildProfileHint(summary) {
  const next = summary || {};
  return `信用分 ${next.credit_score ?? 100}，已参与 ${next.played || 0} 场球局。`;
}

function buildPlayerProfileState(profile, reviews) {
  const rating = calculateRating(profile, reviews);
  return {
    playerCompositeScore: rating.compositeScoreText,
    playerLevelLabel: rating.levelLabel,
    playerDimensions: rating.compositeDimensions,
    playerPositions: profile.positions,
    playerPeerCount: rating.peerCount
  };
}

Page({
  data: {
    loading: false,
    error: "",
    profileName: "未登录用户",
    profileHint: "后续接入微信登录和用户资料。",
    profileStats: buildStats({}),
    profileTag: "开发版本体验用户",
    items: fallbackItems,
    isVenueAdmin: false,
    venueModeEntry,
    canvasSupported: true,
    ...buildPlayerProfileState(getStoredProfile(), getStoredReviews())
  },

  onLoad() {
    this.loadProfile();
    this.loadPlayerProfile();
  },

  onReady() {
    this.drawPlayerRadar();
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
    this.syncPlayerProfile(getStoredProfile(), getStoredReviews());
  },

  syncPlayerProfile(profile, reviews) {
    this.setData(buildPlayerProfileState(profile, reviews));
    const draw = () => this.drawPlayerRadar();
    if (typeof wx.nextTick === "function") wx.nextTick(draw);
    else setTimeout(draw, 0);
  },

  loadPlayerProfile() {
    this.syncPlayerProfile(getStoredProfile(), getStoredReviews());
    const profilePromise = get("/api/sports-app/player-profile", { showLoading: false })
      .then((result) => storeProfileFromServer(result && result.profile ? result.profile : result))
      .catch(() => getStoredProfile());
    const reviewPromise = get("/api/sports-app/player-profile/reviews", { showLoading: false })
      .then((result) => storeReviewsFromServer(result && result.reviews ? result.reviews : result))
      .catch(() => getStoredReviews());
    return Promise.all([profilePromise, reviewPromise]).then(([profile, reviews]) => {
      this.syncPlayerProfile(profile, reviews);
    });
  },

  drawPlayerRadar() {
    if (typeof wx.createCanvasContext !== "function") {
      this.setData({ canvasSupported: false });
      return;
    }
    try {
      const context = wx.createCanvasContext("mePlayerRadar", this);
      const rendered = drawRadarChart(context, this.data.playerDimensions, { width: 300, height: 250 });
      if (!rendered) this.setData({ canvasSupported: false });
    } catch (_error) {
      this.setData({ canvasSupported: false });
    }
  },

  editPlayerProfile() {
    wx.navigateTo({ url: "/pages/player-profile/edit/index" });
  },

  openPlayerReviews() {
    wx.navigateTo({ url: "/pages/player-profile/reviews/index" });
  },

  onPullDownRefresh() {
    Promise.all([this.loadProfile(), this.loadPlayerProfile()]).finally(() => wx.stopPullDownRefresh());
  },

  loadProfile() {
    this.setData({ loading: true, error: "" });

    return get("/api/sports-app/me", { showLoading: false })
      .then((profile) => {
        const user = getStoredUser() || {};
        const summary = profile.summary || {};

        this.setData({
          loading: false,
          profileName: user.nickName || summary.username || "宁约球用户",
          profileHint: buildProfileHint(summary),
          profileTag: "球友档案",
          profileStats: buildStats(summary),
          items: buildItems(profile),
          isVenueAdmin: isVenueAdmin(profile, user)
        });
      })
      .catch(() => {
        this.setData({
          loading: false,
          error: "",
          profileName: "开发版本体验用户",
          profileHint: "当前显示本地资料，联网后可自动加载真实账户。",
          profileTag: "离线资料",
          profileStats: buildStats({}),
          items: fallbackItems,
          isVenueAdmin: isVenueAdmin({}, getStoredUser() || {})
        });
      });
  },

  openMenu(event) {
    const target = event.currentTarget.dataset.target;
    if (!target) {
      wx.showToast({ title: "该功能正在接入中", icon: "none" });
      return;
    }

    wx.navigateTo({ url: target });
  },

  switchVenueMode() {
    wx.navigateTo({ url: venueModeEntry.target });
  }
});
