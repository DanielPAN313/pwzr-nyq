const { get, post } = require("../../utils/api");

const fallbackVenues = [
  { name: "江宁大学城篮球馆", area: "江宁大学城", price: "180/小时", sportsText: "篮球", canBook: false, actionText: "待同步" },
  { name: "未来科技城五人制足球馆", area: "江宁开发区", price: "260/小时", sportsText: "足球", canBook: false, actionText: "待同步" }
];

const sportFilters = [
  { label: "全部", value: "all" },
  { label: "足球", value: "football" },
  { label: "篮球", value: "basketball" }
];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function tomorrowDateText() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function defaultSlot(venue) {
  const slots = Array.isArray(venue.open_slot_ranges) ? venue.open_slot_ranges : [];
  const firstSlot = slots.find((slot) => slot && slot.start && slot.end);

  return {
    date: tomorrowDateText(),
    start: firstSlot ? firstSlot.start : "19:00",
    end: firstSlot ? firstSlot.end : "20:00",
    label: firstSlot ? firstSlot.label : "19:00-20:00"
  };
}

function mapVenue(venue) {
  const price = venue.price_per_hour || venue.price || 0;
  const sports = Array.isArray(venue.sports) ? venue.sports.join(" / ") : venue.sports;
  const sportsList = Array.isArray(venue.sports)
    ? venue.sports
    : String(venue.sports || "").split(",").map((item) => item.trim()).filter(Boolean);
  const slot = defaultSlot(venue);

  return {
    id: venue.id,
    name: venue.name || "未命名场馆",
    area: venue.area || venue.address || "附近",
    price: `${price}/小时`,
    sportsText: sports || "综合运动",
    sportsList,
    bookingDate: slot.date,
    bookingStartTime: slot.start,
    bookingEndTime: slot.end,
    bookingLabel: `明天 ${slot.label}`,
    canBook: Boolean(venue.id),
    actionText: "订场"
  };
}

Page({
  data: {
    loading: false,
    bookingVenueId: "",
    query: "",
    activeSport: "all",
    sportFilters,
    error: "",
    empty: false,
    allVenues: [],
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
          allVenues: list
        });

        this.applyFilters();
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "场馆数据加载失败",
          empty: false,
          allVenues: fallbackVenues,
          venues: fallbackVenues
        });
      });
  },

  applyFilters() {
    const query = String(this.data.query || "").trim().toLowerCase();
    const activeSport = this.data.activeSport || "all";
    const allVenues = Array.isArray(this.data.allVenues) ? this.data.allVenues : [];

    const venues = allVenues.filter((venue) => {
      const text = `${venue.name || ""} ${venue.area || ""} ${venue.sportsText || ""}`.toLowerCase();
      const matchesQuery = !query || text.includes(query);
      const sportsList = Array.isArray(venue.sportsList) ? venue.sportsList : [];
      const matchesSport = activeSport === "all" || sportsList.includes(activeSport) || String(venue.sportsText || "").toLowerCase().includes(activeSport);

      return matchesQuery && matchesSport;
    });

    this.setData({
      venues,
      empty: !this.data.loading && venues.length === 0
    });
  },

  onSearchInput(event) {
    this.setData({
      query: event.detail.value || ""
    });
    this.applyFilters();
  },

  changeSport(event) {
    this.setData({
      activeSport: event.currentTarget.dataset.value || "all"
    });
    this.applyFilters();
  },

  retryLoadVenues() {
    this.loadVenues();
  },

  resetFilters() {
    this.setData({
      query: "",
      activeSport: "all"
    });
    this.applyFilters();
  },

  bookVenue(event) {
    const id = event.currentTarget.dataset.id;
    const venue = this.data.venues.find((item) => String(item.id) === String(id));
    if (!id || !venue || this.data.bookingVenueId) return;

    this.setData({ bookingVenueId: id });

    post(`/api/sports-app/venues/${id}/book`, {
      booking_date: venue.bookingDate,
      booking_start_time: venue.bookingStartTime,
      booking_end_time: venue.bookingEndTime
    }, { loadingTitle: "锁定场地" })
      .then((result) => {
        wx.showToast({
          title: result.order_id ? "已生成待支付订单" : "订场成功",
          icon: "success"
        });

        setTimeout(() => {
          wx.navigateTo({ url: "/pages/orders/orders" });
        }, 600);
      })
      .catch((error) => {
        wx.showToast({
          title: error.message || "订场失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ bookingVenueId: "" });
      });
  },

  openVenue(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;

    wx.navigateTo({
      url: `/pages/venue-detail/venue-detail?id=${id}`
    });
  }
});
