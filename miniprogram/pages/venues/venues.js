const { get } = require("../../utils/api");

const fallbackVenues = [
  { name: "江宁大学城篮球馆", area: "江宁大学城", price: "180/小时", sportsText: "篮球" },
  { name: "未来科技城五人制足球馆", area: "江宁开发区", price: "260/小时", sportsText: "足球" }
];

function mapVenue(venue) {
  const price = venue.price_per_hour || venue.price || 0;
  const sports = Array.isArray(venue.sports) ? venue.sports.join(" / ") : venue.sports;

  return {
    id: venue.id,
    name: venue.name || "未命名场馆",
    area: venue.area || venue.address || "附近",
    price: `${price}/小时`,
    sportsText: sports || "综合运动"
  };
}

Page({
  data: {
    loading: false,
    error: "",
    empty: false,
    venues: fallbackVenues
  },

  onLoad() {
    this.loadVenues();
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
          venues: list.length ? list : [],
          empty: list.length === 0
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "场馆数据加载失败",
          empty: false,
          venues: fallbackVenues
        });
      });
  }
});
