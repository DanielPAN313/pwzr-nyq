const { get, post } = require("../../utils/api");

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

function filterVenues(venues, keyword) {
  const query = String(keyword || "").trim().toLowerCase();
  const list = Array.isArray(venues) ? venues : [];
  if (!query) return list.slice();

  return list.filter((venue) => {
    const text = [
      venue.name,
      venue.area,
      venue.sportsText,
      venue.price,
      venue.distanceText,
      venue.rating
    ].join(" ").toLowerCase();

    return text.includes(query);
  });
}

function buildVenueView(venues, mode, keyword) {
  return sortVenues(filterVenues(venues, keyword), mode);
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
    venueMode: "nearby",
    venueMotionClass: "",
    venueTabs: [
      { label: "离我最近", mode: "nearby" },
      { label: "评分最高", mode: "rating" }
    ],
    keyword: "",
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
        const allVenues = list.length ? list : [];
        const visibleVenues = buildVenueView(allVenues, this.data.venueMode, this.data.keyword);

        this.setData({
          loading: false,
          allVenues,
          venues: visibleVenues,
          empty: visibleVenues.length === 0
        });
      })
      .catch((error) => {
        const visibleVenues = buildVenueView(fallbackVenues, this.data.venueMode, this.data.keyword);

        this.setData({
          loading: false,
          error: error.message || "场馆数据加载失败",
          empty: visibleVenues.length === 0,
          allVenues: fallbackVenues,
          venues: visibleVenues
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
      venues: buildVenueView(this.data.allVenues, mode, this.data.keyword)
    });

    this.venueMoveTimer = setTimeout(() => {
      this.setData({ venueMotionClass: "" });
    }, 520);
  },

  onSearchInput(event) {
    const keyword = event.detail.value || "";
    const venues = buildVenueView(this.data.allVenues, this.data.venueMode, keyword);

    this.setData({
      keyword,
      venues,
      empty: venues.length === 0
    });
  },

  clearSearch() {
    const venues = buildVenueView(this.data.allVenues, this.data.venueMode, "");

    this.setData({
      keyword: "",
      venues,
      empty: venues.length === 0
    });
  },

  bookVenue(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || this.data.bookingId) return;

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
        wx.navigateTo({ url: "/pages/orders/orders" });
      })
      .catch((error) => {
        wx.showToast({ title: error.message || "订场失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ bookingId: "" });
      });
  }
});
