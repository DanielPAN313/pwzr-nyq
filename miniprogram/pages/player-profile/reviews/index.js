const { get } = require("../../../utils/api");
const {
  calculateRating,
  drawRadarChart,
  getStoredProfile,
  getStoredReviews,
  normalizeReviews,
  storeReviewsFromServer
} = require("../../../utils/player-rating");

function buildState(reviews) {
  const normalized = normalizeReviews(reviews);
  const rating = calculateRating(getStoredProfile(), normalized);
  const starAverage = normalized.length
    ? normalized.reduce((sum, item) => sum + item.starScore, 0) / normalized.length
    : 0;
  return {
    reviews: normalized,
    reviewCount: normalized.length,
    starAverageText: starAverage.toFixed(1),
    peerScoreText: rating.peerScore == null ? "待积累" : rating.peerScore.toFixed(1),
    effectivePeerGames: rating.effectivePeerGames,
    peerDimensions: rating.peerDimensions
  };
}

Page({
  data: {
    loading: false,
    canvasSupported: true,
    ...buildState(getStoredReviews())
  },

  onLoad() {
    this.loadReviews();
  },

  onReady() {
    this.drawRadar();
  },

  scheduleRadar() {
    const draw = () => this.drawRadar();
    if (typeof wx.nextTick === "function") wx.nextTick(draw);
    else setTimeout(draw, 0);
  },

  syncReviews(reviewValue) {
    this.setData(buildState(reviewValue));
    this.scheduleRadar();
  },

  loadReviews() {
    this.syncReviews(getStoredReviews());
    this.setData({ loading: true });
    return get("/api/sports-app/player-profile/reviews", { showLoading: false })
      .then((result) => {
        const reviews = storeReviewsFromServer(result && result.reviews ? result.reviews : result);
        this.syncReviews(reviews);
      })
      .catch(() => this.syncReviews(getStoredReviews()))
      .finally(() => this.setData({ loading: false }));
  },

  onPullDownRefresh() {
    this.loadReviews().finally(() => wx.stopPullDownRefresh());
  },

  drawRadar() {
    if (typeof wx.createCanvasContext !== "function") {
      this.setData({ canvasSupported: false });
      return;
    }
    try {
      const context = wx.createCanvasContext("peerRadar", this);
      const rendered = drawRadarChart(context, this.data.peerDimensions, { width: 320, height: 270 });
      if (!rendered) this.setData({ canvasSupported: false });
    } catch (_error) {
      this.setData({ canvasSupported: false });
    }
  }
});
