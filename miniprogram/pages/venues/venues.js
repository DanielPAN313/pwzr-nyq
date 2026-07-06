const { get } = require("../../utils/api");

const fallbackVenues = [
  { id: 1, name: "江宁大学城篮球馆", area: "江宁大学城", price: "180/小时", sportsText: "篮球", distance: 1.2, rating: 4.8 },
  { id: 2, name: "未来科技城五人制足球馆", area: "江宁开发区", price: "260/小时", sportsText: "足球", distance: 2.7, rating: 4.9 }
];

function venueDistance(venue) {
  const raw = Number(venue.distance || venue.distance_km);
  if (!Number.isNaN(raw) && raw > 0) return raw;
  return 1 + (Number(venue.id || 1) % 6) * 0.6;
}

function venueRating(venue) {
  const raw = Number(venue.rating || venue.average_rating || venue.score);
  if (!Number.isNaN(raw) && raw > 0) return raw;
  return 4.4 + (Number(venue.id || 1) % 5) * 0.1;
}

function mapVenue(venue) {
  const price = venue.price_per_hour || venue.price || 0;
  const sports = Array.isArray(venue.sports) ? venue.sports.join(" / ") : venue.sports;

  return {
    id: venue.id,
    name: venue.name || "未命名场馆",
    area: venue.area || venue.address || "附近",
    price: `${price}/小时`,
    sportsText: sports || "综合运动",
    distance: venueDistance(venue),
    distanceText: `${venueDistance(venue).toFixed(1)}km`,
    rating: venueRating(venue).toFixed(1)
  };
}

function sortVenues(venues, mode) {
  const list = Array.isArray(venues) ? venues.slice() : [];
  if (mode === "rating") {
    return list.sort((a, b) => Number(b.rating) - Number(a.rating));
  }
  return list.sort((a, b) => Number(a.distance) - Number(b.distance));
}

Page({
  data: {
    loading: false,
    error: "",
    empty: false,
    venueMode: "nearby",
    venueMotionClass: "",
    venueTabs: [
      { label: "离我最近", mode: "nearby" },
      { label: "评分最高", mode: "rating" }
    ],
    allVenues: fallbackVenues,
    venues: sortVenues(fallbackVenues, "nearby")
  },

  onLoad() {
    this.loadVenues();
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  onPullDownRefresh() {
    this.loadVenues().finally(() => wx.stopPullDownRefresh());
  },

  loadVenues() {
    this.setData({ loading: true, error: "", empty: false });

    return get("/api/sports-app/venues", { showLoading: false })
      .then((venues) => {
        const list = Array.isArray(venues) ? venues.map(mapVenue) : [];

        this.setData({
          loading: false,
          allVenues: list.length ? list : [],
          venues: sortVenues(list.length ? list : [], this.data.venueMode),
          empty: list.length === 0
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "场馆数据加载失败",
          empty: false,
          allVenues: fallbackVenues,
          venues: sortVenues(fallbackVenues, this.data.venueMode)
        });
      });
  },

  switchVenueMode(event) {
    const mode = event.currentTarget.dataset.mode || "nearby";
    if (mode === this.data.venueMode) return;

    if (this.venueMoveTimer) {
      clearTimeout(this.venueMoveTimer);
    }

    this.setData({
      venueMode: mode,
      venueMotionClass: "venue-entering",
      venues: sortVenues(this.data.allVenues, mode)
    });

    this.venueMoveTimer = setTimeout(() => {
      this.setData({ venueMotionClass: "" });
    }, 520);
  }
});
