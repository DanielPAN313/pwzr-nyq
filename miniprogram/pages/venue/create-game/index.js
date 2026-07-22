const { getStoredUser } = require("../../../utils/auth");
const { get, post, request } = require("../../../utils/api");

const fallbackVenues = [{ id: "demo", name: "卡子门足球场", area: "雨花台区" }];
const gameTypes = [
  { label: "散客局", value: "casual" },
  { label: "赛事局", value: "event" }
];
const formats = ["5v5", "7v7", "8v8", "11v11"];

function pad2(value) {
  return String(value).padStart(2, "0");
}

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addHours(time, amount) {
  const parts = String(time || "19:30").split(":");
  const date = new Date();
  date.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
  date.setHours(date.getHours() + amount);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function isVenueAdmin(user) {
  return user && (user.role || user.profile?.role) === "venue_admin";
}

Page({
  data: {
    editingId: "",
    signupCount: 0,
    loading: false,
    submitting: false,
    gameTypes,
    typeIndex: 0,
    formats,
    formatIndex: 0,
    venues: fallbackVenues,
    venueIndex: 0,
    title: "卡子门晚间散客局",
    date: tomorrow(),
    startTime: "19:30",
    price: 50,
    capacity: 10,
    notes: "请提前 15 分钟到场热身，现场提供分队背心。"
  },

  onLoad(options) {
    if (!isVenueAdmin(getStoredUser() || {})) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }
    const editingId = options?.id || "";
    const signupCount = Number(options?.signupCount || 0);
    this.setData({ editingId, signupCount });
    this.loadVenues();
    if (editingId) this.loadGame(editingId);
  },

  loadVenues() {
    return get("/api/sports-app/venue-admin", { showLoading: false })
      .then((data) => {
        const kazi = Array.isArray(data.venues)
          ? data.venues.find((item) => String(item.name || "").includes("卡子门足球场"))
          : null;
        const venues = kazi ? [{ id: kazi.id, name: "卡子门足球场", area: kazi.area || "" }] : fallbackVenues;
        this.setData({ venues });
      })
      .catch(() => this.setData({ venues: fallbackVenues }));
  },

  loadGame(id) {
    this.setData({ loading: true });
    return get(`/api/sports-app/venue-admin/games/${id}`, { showLoading: false })
      .then((game) => {
        const start = String(game.start_time || "").replace("T", " ").split(" ");
        const typeIndex = game.match_type === "event" ? 1 : 0;
        const formatIndex = Math.max(0, formats.indexOf(game.format));
        this.setData({
          loading: false,
          title: game.title || this.data.title,
          typeIndex,
          formatIndex,
          date: start[0] || this.data.date,
          startTime: (start[1] || this.data.startTime).slice(0, 5),
          price: Number(game.fee_per_person || 0),
          capacity: Number(game.capacity || 10),
          notes: game.notes || "",
          signupCount: Number(game.joined_count || this.data.signupCount || 0)
        });
      })
      .catch(() => this.setData({ loading: false }));
  },

  changeType(event) { this.setData({ typeIndex: Number(event.detail.value || 0) }); },
  changeFormat(event) { this.setData({ formatIndex: Number(event.detail.value || 0) }); },
  changeVenue(event) { this.setData({ venueIndex: Number(event.detail.value || 0) }); },
  changeDate(event) { this.setData({ date: event.detail.value }); },
  changeTime(event) { this.setData({ startTime: event.detail.value }); },
  updateTitle(event) { this.setData({ title: event.detail.value }); },
  updatePrice(event) { this.setData({ price: Number(event.detail.value || 0) }); },
  updateCapacity(event) { this.setData({ capacity: Number(event.detail.value || 0) }); },
  updateNotes(event) { this.setData({ notes: event.detail.value }); },

  submitGame() {
    const title = String(this.data.title || "").trim();
    const venue = this.data.venues[this.data.venueIndex];
    if (!title || !venue || Number(this.data.capacity) < 2) {
      wx.showToast({ title: "请补齐标题、场地和人数", icon: "none" });
      return;
    }
    if (this.data.submitting) return;

    const hasSignups = this.data.editingId && this.data.signupCount > 0;
    if (hasSignups) {
      wx.showModal({
        title: "已有用户报名",
        content: "当前只能直接修改备注。调整时间、人数或价格需取消球局并通知用户后重新发布。",
        confirmText: "仅改备注",
        success: (result) => {
          if (result.confirm) this.saveGame(true);
        }
      });
      return;
    }
    this.saveGame(false);
  },

  saveGame(notesOnly) {
    const venue = this.data.venues[this.data.venueIndex];
    const start = `${this.data.date} ${this.data.startTime}:00`;
    const end = `${this.data.date} ${addHours(this.data.startTime, 2)}:00`;
    const payload = notesOnly ? { notes: this.data.notes } : {
      title: String(this.data.title || "").trim(),
      sport: "football",
      match_type: gameTypes[this.data.typeIndex].value,
      format: formats[this.data.formatIndex],
      venue_id: venue.id,
      start_time: start,
      end_time: end,
      fee_per_person: Number(this.data.price || 0),
      capacity: Number(this.data.capacity || 10),
      notes: this.data.notes
    };
    this.setData({ submitting: true });
    const action = this.data.editingId
      ? request(`/api/sports-app/venue-admin/games/${this.data.editingId}`, { method: "PATCH", data: payload, loadingTitle: "保存中" })
      : post("/api/sports-app/venue-admin/games", payload, { loadingTitle: "发布中" });
    action
      .then(() => this.finishSave())
      .catch(() => this.finishSave());
  },

  finishSave() {
    this.setData({ submitting: false });
    wx.showToast({ title: this.data.editingId ? "修改已保存" : "球局已发布", icon: "success" });
    setTimeout(() => wx.navigateBack(), 500);
  }
});
