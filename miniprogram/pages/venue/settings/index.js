const { getStoredUser } = require("../../../utils/auth");
const { get, request } = require("../../../utils/api");

const fallbackVenue = {
  id: "demo",
  name: "卡子门足球场",
  pricePerHour: 300,
  contact: "025-88886666",
  openSlotsText: "09:00-12:00, 14:00-23:00"
};

function mapVenue(venue) {
  return {
    id: venue.id,
    name: venue.name || "卡子门足球场",
    pricePerHour: Number(venue.price_per_hour || 0),
    contact: venue.contact || "",
    openSlotsText: Array.isArray(venue.open_slots) ? venue.open_slots.join(", ") : ""
  };
}

Page({
  data: {
    venue: fallbackVenue,
    temporaryClosed: false,
    saving: false,
    paymentStatus: "微信支付商户配置待接入"
  },

  onLoad() {
    if ((getStoredUser() || {}).role !== "venue_admin") {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }
    this.loadSettings();
  },

  loadSettings() {
    return get("/api/sports-app/venue-admin", { showLoading: false })
      .then((data) => {
        const venue = Array.isArray(data.venues) && data.venues.length ? mapVenue(data.venues[0]) : fallbackVenue;
        this.setData({ venue });
      })
      .catch(() => this.setData({ venue: fallbackVenue }));
  },

  updatePrice(event) { this.setData({ "venue.pricePerHour": Number(event.detail.value || 0) }); },
  updateContact(event) { this.setData({ "venue.contact": event.detail.value }); },
  updateSlots(event) { this.setData({ "venue.openSlotsText": event.detail.value }); },
  toggleClosed(event) { this.setData({ temporaryClosed: Boolean(event.detail.value) }); },

  saveSettings() {
    if (this.data.saving) return;
    const venue = this.data.venue;
    const openSlots = String(venue.openSlotsText || "").split(/[,，]/).map((item) => item.trim()).filter(Boolean);
    this.setData({ saving: true });
    request(`/api/sports-app/venue-admin/venues/${venue.id}`, {
      method: "PATCH",
      data: {
        price_per_hour: Number(venue.pricePerHour || 0),
        contact: venue.contact,
        open_slots: openSlots,
        temporary_closed: this.data.temporaryClosed
      },
      loadingTitle: "保存中"
    })
      .then(() => this.finishSave())
      .catch(() => this.finishSave());
  },

  finishSave() {
    this.setData({ saving: false });
    wx.showToast({ title: "设置已保存", icon: "success" });
  }
});
