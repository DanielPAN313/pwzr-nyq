const { get, post } = require("../../utils/api");

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

function todayDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

Page({
  data: {
    loading: false,
    bookingId: "",
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
  },

  bookVenue(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.bookingId) {
      wx.showToast({ title: "真实场馆加载后可订场", icon: "none" });
      return;
    }

    const date = todayDate();
    this.setData({ bookingId: id });

    get(`/api/sports-app/venues/${id}/availability?date=${date}`, { loadingTitle: "查时段" })
      .then((availability) => {
        const slot = (availability.slots || []).find((item) => !item.occupied && item.start && item.end);
        if (!slot) throw new Error("今天暂无可订时段");

        return post(`/api/sports-app/venues/${id}/book`, {
          booking_date: date,
          booking_start_time: slot.start,
          booking_end_time: slot.end
        }, { loadingTitle: "锁定场地" });
      })
      .then(() => {
        wx.showToast({ title: "已生成订单", icon: "success" });
        wx.switchTab({ url: "/pages/orders/orders" });
      })
      .catch((error) => {
        wx.showToast({ title: error.message || "订场失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ bookingId: "" });
      });
  }
});
