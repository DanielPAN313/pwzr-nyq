const { get, post } = require("../../../utils/api");
const {
  calculateRating,
  clampScore,
  drawRadarChart,
  getEditPolicy,
  getStoredProfile,
  getStoredReviews,
  normalizeProfile,
  positionOptions,
  ratingDimensions,
  saveLocalProfile,
  storeProfileFromServer
} = require("../../../utils/player-rating");

function buildDimensionInputs(profile) {
  return ratingDimensions.map((item) => ({ ...item, value: clampScore(profile[item.key]) }));
}

function buildPositionItems(selectedPositions) {
  return positionOptions.map((position) => ({
    key: position,
    label: position,
    selected: selectedPositions.indexOf(position) >= 0
  }));
}

Page({
  data: {
    loading: false,
    saving: false,
    canvasSupported: true,
    profile: getStoredProfile(),
    dimensions: buildDimensionInputs(getStoredProfile()),
    positionItems: buildPositionItems(getStoredProfile().positions),
    selectedPositions: getStoredProfile().positions,
    averageText: calculateRating(getStoredProfile(), []).selfScore.toFixed(1),
    compositeText: calculateRating(getStoredProfile(), getStoredReviews()).compositeScoreText,
    levelLabel: calculateRating(getStoredProfile(), getStoredReviews()).levelLabel,
    editPolicy: getEditPolicy()
  },

  onLoad() {
    this.loadProfile();
  },

  onReady() {
    this.drawRadar();
  },

  onShow() {
    this.setData({ editPolicy: getEditPolicy() });
    this.scheduleRadar();
  },

  scheduleRadar() {
    const draw = () => this.drawRadar();
    if (typeof wx.nextTick === "function") wx.nextTick(draw);
    else setTimeout(draw, 0);
  },

  syncProfile(profileValue) {
    const profile = normalizeProfile(profileValue);
    const reviews = getStoredReviews();
    const rating = calculateRating(profile, reviews);
    this.setData({
      profile,
      dimensions: buildDimensionInputs(profile),
      selectedPositions: profile.positions,
      positionItems: buildPositionItems(profile.positions),
      averageText: rating.selfScore.toFixed(1),
      compositeText: rating.compositeScoreText,
      levelLabel: rating.levelLabel,
      editPolicy: getEditPolicy()
    });
    this.scheduleRadar();
  },

  loadProfile() {
    this.syncProfile(getStoredProfile());
    this.setData({ loading: true });
    return get("/api/sports-app/player-profile", { showLoading: false })
      .then((result) => {
        const profile = storeProfileFromServer(result && result.profile ? result.profile : result);
        this.syncProfile(profile);
      })
      .catch(() => {
        this.syncProfile(getStoredProfile());
      })
      .finally(() => this.setData({ loading: false }));
  },

  onDimensionChange(event) {
    if (!this.data.editPolicy.canEdit) return;
    const key = event.currentTarget.dataset.key;
    if (!ratingDimensions.some((item) => item.key === key)) return;
    const value = clampScore(event.detail && event.detail.value);
    const profile = { ...this.data.profile, [key]: value };
    this.syncDraft(profile, this.data.selectedPositions);
  },

  syncDraft(profileValue, selectedPositions) {
    const profile = normalizeProfile({ ...profileValue, positions: selectedPositions });
    const rating = calculateRating(profile, getStoredReviews());
    this.setData({
      profile,
      dimensions: buildDimensionInputs(profile),
      selectedPositions: [...selectedPositions],
      positionItems: buildPositionItems(selectedPositions),
      averageText: rating.selfScore.toFixed(1),
      compositeText: rating.compositeScoreText,
      levelLabel: rating.levelLabel
    });
    this.scheduleRadar();
  },

  togglePosition(event) {
    if (!this.data.editPolicy.canEdit) return;
    const position = event.currentTarget.dataset.position;
    if (positionOptions.indexOf(position) < 0) return;
    const selected = [...this.data.selectedPositions];
    const index = selected.indexOf(position);
    if (index >= 0) selected.splice(index, 1);
    else selected.push(position);
    this.syncDraft(this.data.profile, selected);
  },

  drawRadar() {
    if (typeof wx.createCanvasContext !== "function") {
      this.setData({ canvasSupported: false });
      return;
    }
    try {
      const context = wx.createCanvasContext("profileRadar", this);
      const rating = calculateRating(this.data.profile, getStoredReviews());
      const rendered = drawRadarChart(context, rating.compositeDimensions, { width: 320, height: 270 });
      if (!rendered) this.setData({ canvasSupported: false });
    } catch (_error) {
      this.setData({ canvasSupported: false });
    }
  },

  saveProfile() {
    if (this.data.saving) return;
    const policy = getEditPolicy();
    if (!policy.canEdit) {
      this.setData({ editPolicy: policy });
      wx.showToast({ title: "档案仍在修改冷却期", icon: "none" });
      return;
    }
    if (!this.data.selectedPositions.length) {
      wx.showToast({ title: "请至少选择一个擅长位置", icon: "none" });
      return;
    }

    const payload = normalizeProfile({ ...this.data.profile, positions: this.data.selectedPositions });
    const localResult = saveLocalProfile(payload);
    if (!localResult.ok) {
      this.setData({ editPolicy: localResult.policy });
      wx.showToast({ title: "档案仍在修改冷却期", icon: "none" });
      return;
    }

    this.setData({ saving: true });
    this.syncProfile(localResult.profile);
    post("/api/sports-app/player-profile", payload, { showLoading: false })
      .then((result) => {
        if (result && result.profile) this.syncProfile(storeProfileFromServer(result.profile));
      })
      .catch(() => {})
      .finally(() => {
        this.setData({ saving: false, editPolicy: getEditPolicy() });
        wx.showToast({ title: "实力档案已保存", icon: "success" });
      });
  }
});
