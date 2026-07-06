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

function todayDateText() {
  const date = new Date();
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

function dateTimeShort(date, time) {
  return `${date} ${time}`;
}

function mapVenue(venue) {
  return {
    id: venue.id,
    name: venue.name || "未命名场馆",
    area: venue.area || venue.address || "附近"
  };
}

function buildFormSummary(data) {
  const venue = data.venues[data.venueIndex] || null;
  const sport = sportOptions[data.sportIndex] || sportOptions[0];
  const duration = durationOptions[data.durationIndex] || durationOptions[0];
  const endTime = addHours(data.startTime, duration.value);
  const capacity = Number(data.capacity || 0);
  const fee = Number(data.fee || 0);
  const title = String(data.title || "").trim();
  const validationItems = buildValidationItems({
    venue,
    title,
    capacity,
    fee,
    date: data.date,
    startTime: data.startTime,
    loading: data.loading
  });
  const canSubmit = validationItems.every((item) => item.ok) && !data.submitting;

  return {
    selectedVenueText: venue ? `${venue.name} · ${venue.area}` : "请选择场馆",
    timeRangeText: `${dateTimeShort(data.date, data.startTime)}-${endTime}`,
    submitHint: canSubmit
      ? "发布后会进入球局详情，其他用户报名后生成待支付订单。"
      : "请补齐标题、场馆和至少 2 人的名额。",
    canSubmit,
    validationItems,
    summaryCards: [
      { label: "运动", value: sport.label },
      { label: "人数", value: capacity ? `${capacity} 人` : "待填写" },
      { label: "费用", value: fee ? `¥${fee}/人` : "免费/AA" }
    ]
  };
}

function buildValidationItems({ venue, title, capacity, fee, date, startTime, loading }) {
  const startAt = new Date(dateTimeText(date, startTime)).getTime();
  const isFuture = !Number.isNaN(startAt) && startAt > Date.now();

  return [
    {
      key: "title",
      text: title ? "标题已填写" : "填写球局标题",
      ok: Boolean(title)
    },
    {
      key: "venue",
      text: venue ? "场馆已选择" : loading ? "正在加载场馆" : "选择可用场馆",
      ok: Boolean(venue)
    },
    {
      key: "capacity",
      text: capacity >= 2 ? "人数不少于 2 人" : "人数至少 2 人",
      ok: capacity >= 2
    },
    {
      key: "time",
      text: isFuture ? "开始时间有效" : "开始时间需要晚于当前时间",
      ok: isFuture
    },
    {
      key: "fee",
      text: fee >= 0 ? "费用有效" : "费用不能为负数",
      ok: fee >= 0
    }
  ];
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
    minDate: todayDateText(),
    startTime: "19:00",
    sportOptions,
    sportIndex: 0,
    durationOptions,
    durationIndex: 0,
    venues: [],
    venueIndex: 0,
    selectedVenueText: "请选择场馆",
    timeRangeText: "",
    submitHint: "请补齐标题、场馆和至少 2 人的名额。",
    canSubmit: false,
    validationItems: [],
    summaryCards: []
  },

  onLoad() {
    this.syncSummary();
    this.loadVenues();
  },

  syncSummary(patch) {
    const nextData = {
      ...this.data,
      ...(patch || {})
    };
    this.setData({
      ...(patch || {}),
      ...buildFormSummary(nextData)
    });
  },

  loadVenues() {
    this.setData({ loading: true, error: "" });

    return get("/api/sports-app/venues", { showLoading: false })
      .then((venues) => {
        const list = Array.isArray(venues) ? venues.map(mapVenue) : [];

        this.syncSummary({
          loading: false,
          venues: list,
          venueIndex: 0,
          error: list.length ? "" : "暂无可用场馆，先去订场页确认场馆数据。"
        });
      })
      .catch((error) => {
        this.syncSummary({
          loading: false,
          error: error.message || "场馆加载失败"
        });
      });
  },

  retryLoadVenues() {
    this.loadVenues();
  },

  goVenues() {
    wx.switchTab({ url: "/pages/venues/venues" });
  },

  updateTitle(event) {
    this.syncSummary({ title: event.detail.value });
  },

  updateCapacity(event) {
    this.syncSummary({ capacity: Number(event.detail.value || 0) });
  },

  updateFee(event) {
    this.syncSummary({ fee: Number(event.detail.value || 0) });
  },

  updateNotes(event) {
    this.setData({ notes: event.detail.value });
  },

  changeSport(event) {
    this.syncSummary({ sportIndex: Number(event.detail.value || 0) });
  },

  changeVenue(event) {
    this.syncSummary({ venueIndex: Number(event.detail.value || 0) });
  },

  changeDate(event) {
    this.syncSummary({ date: event.detail.value });
  },

  changeStartTime(event) {
    this.syncSummary({ startTime: event.detail.value });
  },

  changeDuration(event) {
    this.syncSummary({ durationIndex: Number(event.detail.value || 0) });
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
    this.syncSummary({ submitting: true });

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
      .then((result) => {
        wx.showToast({
          title: "球局已发布",
          icon: "success"
        });

        setTimeout(() => {
          if (result && result.id) {
            wx.redirectTo({ url: `/pages/game-detail/game-detail?id=${result.id}` });
            return;
          }

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
        this.syncSummary({ submitting: false });
      });
  }
});
