const { get, post } = require("../../utils/api");

const sportOptions = [
  { label: "足球", value: "football" },
  { label: "篮球", value: "basketball" },
  { label: "羽毛球", value: "badminton" },
  { label: "网球", value: "tennis" }
];

const durationOptions = [
  { label: "1 小时", value: 1 },
  { label: "1.5 小时", value: 1.5 },
  { label: "2 小时", value: 2 }
];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function tomorrowDateText() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addHours(time, hours) {
  const [hourText, minuteText] = String(time || "19:00").split(":");
  const date = new Date();
  date.setHours(Number(hourText || 19), Number(minuteText || 0), 0, 0);
  date.setMinutes(date.getMinutes() + Math.round(Number(hours || 1) * 60));
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function dateTimeText(date, time) {
  return `${date} ${time}:00`;
}

function mapVenue(venue) {
  return {
    id: venue.id,
    name: venue.name || "未命名场馆",
    area: venue.area || venue.address || "附近"
  };
}

Page({
  data: {
    loading: false,
    submitting: false,
    error: "",
    title: "南京同城约球",
    notes: "",
    capacity: 10,
    fee: 0,
    date: tomorrowDateText(),
    startTime: "19:00",
    sportOptions,
    sportIndex: 0,
    durationOptions,
    durationIndex: 0,
    venues: [],
    venueIndex: 0
  },

  onLoad() {
    this.loadVenues();
  },

  loadVenues() {
    this.setData({ loading: true, error: "" });

    return get("/api/sports-app/venues", { showLoading: false })
      .then((venues) => {
        const list = Array.isArray(venues) ? venues.map(mapVenue) : [];

        this.setData({
          loading: false,
          venues: list,
          venueIndex: 0,
          error: list.length ? "" : "暂无可用场馆，先去订场页确认场馆数据。"
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "场馆加载失败"
        });
      });
  },

  updateTitle(event) {
    this.setData({ title: event.detail.value });
  },

  updateCapacity(event) {
    this.setData({ capacity: Number(event.detail.value || 0) });
  },

  updateFee(event) {
    this.setData({ fee: Number(event.detail.value || 0) });
  },

  updateNotes(event) {
    this.setData({ notes: event.detail.value });
  },

  changeSport(event) {
    this.setData({ sportIndex: Number(event.detail.value || 0) });
  },

  changeVenue(event) {
    this.setData({ venueIndex: Number(event.detail.value || 0) });
  },

  changeDate(event) {
    this.setData({ date: event.detail.value });
  },

  changeStartTime(event) {
    this.setData({ startTime: event.detail.value });
  },

  changeDuration(event) {
    this.setData({ durationIndex: Number(event.detail.value || 0) });
  },

  submitGame() {
    const venue = this.data.venues[this.data.venueIndex];
    const sport = sportOptions[this.data.sportIndex];
    const duration = durationOptions[this.data.durationIndex];
    const title = String(this.data.title || "").trim();

    if (!venue) {
      wx.showToast({ title: "请先选择场馆", icon: "none" });
      return;
    }

    if (!title) {
      wx.showToast({ title: "请填写球局标题", icon: "none" });
      return;
    }

    if (Number(this.data.capacity || 0) < 2) {
      wx.showToast({ title: "人数至少 2 人", icon: "none" });
      return;
    }

    if (this.data.submitting) return;

    const endTime = addHours(this.data.startTime, duration.value);
    this.setData({ submitting: true });

    post("/api/sports-app/games", {
      sport: sport.value,
      title,
      venue_id: venue.id,
      start_time: dateTimeText(this.data.date, this.data.startTime),
      end_time: dateTimeText(this.data.date, endTime),
      capacity: Number(this.data.capacity || 10),
      fee_per_person: Number(this.data.fee || 0),
      notes: this.data.notes
    }, { loadingTitle: "发起中" })
      .then(() => {
        wx.showToast({
          title: "球局已发布",
          icon: "success"
        });

        setTimeout(() => {
          wx.navigateBack();
        }, 600);
      })
      .catch((error) => {
        wx.showToast({
          title: error.message || "发起失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  }
});
