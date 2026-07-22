const { get, post } = require("../../utils/api");
const { getStoredUser } = require("../../utils/auth");
const { saveLocalTeam } = require("../../utils/team-stats");

const fallbackVenues = [
  { id: "venue-kazimen", name: "卡子门足球场", area: "雨花台" },
  { id: "venue-future", name: "未来科技城五人制足球馆", area: "江宁开发区" },
  { id: "venue-baijiahu", name: "百家湖运动中心", area: "百家湖" }
];

const activityOptions = [
  "每周三晚",
  "每周五晚",
  "每周六下午",
  "每周六晚",
  "每周日全天",
  "时间灵活，群内约定"
];

const levelOptions = ["不限水平", "新手友好", "进阶及以上", "高强度竞技"];
const badgeColors = ["#D8FF3E", "#4FD1C5", "#F7C66B", "#70A5FF", "#FF8A80"];

function mapVenue(venue) {
  return {
    id: venue.id,
    name: venue.name || "未命名场馆",
    area: venue.area || venue.address || "附近"
  };
}

Page({
  data: {
    submitting: false,
    name: "",
    badgeUrl: "",
    badgeText: "队",
    badgeColor: badgeColors[0],
    badgeColors,
    venues: fallbackVenues,
    venueIndex: 0,
    activityOptions,
    activityIndex: 3,
    levelOptions,
    levelIndex: 0,
    acceptsTrial: true,
    requiresApproval: true,
    description: "",
    canSubmit: false
  },

  onLoad() {
    this.loadVenues();
  },

  syncForm(patch) {
    const next = { ...this.data, ...(patch || {}) };
    const name = String(next.name || "").trim();
    const description = String(next.description || "").trim();
    this.setData({
      ...(patch || {}),
      badgeText: name.slice(0, 1) || "队",
      canSubmit: name.length >= 2 && description.length >= 6 && !next.submitting
    });
  },

  loadVenues() {
    return get("/api/sports-app/venues", { showLoading: false })
      .then((venues) => {
        const list = Array.isArray(venues) && venues.length ? venues.map(mapVenue) : fallbackVenues;
        this.setData({ venues: list, venueIndex: 0 });
      })
      .catch(() => {
        this.setData({ venues: fallbackVenues, venueIndex: 0 });
      });
  },

  updateName(event) {
    this.syncForm({ name: event.detail.value });
  },

  updateDescription(event) {
    this.syncForm({ description: event.detail.value });
  },

  selectBadgeColor(event) {
    this.setData({ badgeColor: event.currentTarget.dataset.color });
  },

  chooseBadge() {
    const chooser = typeof wx.chooseMedia === "function" ? wx.chooseMedia : wx.chooseImage;
    if (typeof chooser !== "function") return;
    chooser({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: (result) => {
        const file = result.tempFiles?.[0]?.tempFilePath || result.tempFilePaths?.[0] || "";
        if (file) this.setData({ badgeUrl: file });
      },
      fail: () => {}
    });
  },

  changeVenue(event) {
    this.setData({ venueIndex: Number(event.detail.value || 0) });
  },

  changeActivity(event) {
    this.setData({ activityIndex: Number(event.detail.value || 0) });
  },

  changeLevel(event) {
    this.setData({ levelIndex: Number(event.detail.value || 0) });
  },

  toggleTrial(event) {
    this.setData({ acceptsTrial: Boolean(event.detail.value) });
  },

  toggleApproval(event) {
    this.setData({ requiresApproval: Boolean(event.detail.value) });
  },

  submitTeam() {
    const name = String(this.data.name || "").trim();
    const description = String(this.data.description || "").trim();
    if (name.length < 2) {
      wx.showToast({ title: "球队名称至少 2 个字", icon: "none" });
      return;
    }
    if (description.length < 6) {
      wx.showToast({ title: "请补充球队简介", icon: "none" });
      return;
    }
    if (this.data.submitting) return;

    const venue = this.data.venues[this.data.venueIndex] || fallbackVenues[0];
    const payload = {
      name,
      sport: "football",
      badge_url: this.data.badgeUrl,
      badge_color: this.data.badgeColor,
      home_venue_name: venue.name,
      area: venue.area,
      activity_time: activityOptions[this.data.activityIndex],
      level_requirement: levelOptions[this.data.levelIndex],
      accepts_trial: this.data.acceptsTrial,
      requires_approval: this.data.requiresApproval,
      description,
      member_limit: 20,
      tags: [this.data.acceptsTrial ? "长期招人" : "稳定阵容", levelOptions[this.data.levelIndex] === "高强度竞技" ? "竞技" : "休闲", "5v5"]
    };
    const user = getStoredUser();
    const finish = (id, localOnly) => {
      const team = saveLocalTeam(payload, user, id);
      this.setData({ submitting: false, canSubmit: true });
      wx.showToast({ title: localOnly ? "球队已保存" : "球队创建成功", icon: "success" });
      setTimeout(() => {
        wx.redirectTo({ url: `/pages/team-detail/team-detail?id=${encodeURIComponent(team.id)}` });
      }, 280);
    };

    this.syncForm({ submitting: true });
    post("/api/sports-app/teams", payload, { loadingTitle: "创建中" })
      .then((result) => finish(result?.id, false))
      .catch(() => finish("", true));
  }
});
