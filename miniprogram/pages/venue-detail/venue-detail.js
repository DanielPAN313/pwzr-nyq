const { get, post } = require("../../utils/api");

function pad2(value) {
  return String(value).padStart(2, "0");
}

function todayDateText() {
  const date = new Date();
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function tomorrowDateText() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function mapVenue(venue) {
  const sports = Array.isArray(venue.sports) ? venue.sports.join(" / ") : venue.sports;
  const openSlots = Array.isArray(venue.open_slots) ? venue.open_slots : [];
  const priceText = `¥${Number(venue.price_per_hour || 0).toFixed(0)}/小时`;
  const contact = venue.contact || "到店咨询";
  const openSlotsText = openSlots.length ? openSlots.join("、") : "场馆暂未配置固定开放时段";

  return {
    id: venue.id,
    name: venue.name || "未命名场馆",
    area: venue.area || "附近",
    address: venue.address || "暂无详细地址",
    priceText,
    sportsText: sports || "综合运动",
    indoorText: venue.indoor ? "室内" : "室外",
    contact,
    openSlotsText,
    detailCards: [
      { label: "价格", value: priceText },
      { label: "联系", value: contact },
      { label: "类型", value: venue.indoor ? "室内场馆" : "室外场地" }
    ]
  };
}

function mapSlot(slot) {
  return {
    id: slot.id,
    label: slot.label || `${slot.start}-${slot.end}`,
    start: slot.start,
    end: slot.end,
    occupied: Boolean(slot.occupied),
    statusText: slot.occupied ? "已占用" : "可预约",
    statusTone: slot.occupied ? "disabled" : "available"
  };
}

function bookingState(date, slots, selectedSlotIndex) {
  const slot = slots[selectedSlotIndex];

  if (!slot) {
    return {
      selectedSlotLabel: "请先选择可预约时段",
      selectedSlotStatusText: "暂无可约",
      canSubmitBooking: false
    };
  }

  return {
    selectedSlotLabel: `${date} ${slot.label}`,
    selectedSlotStatusText: slot.occupied ? "该时段已占用，请换一个时段" : "可生成待支付订单",
    canSubmitBooking: !slot.occupied
  };
}

Page({
  data: {
    id: "",
    date: tomorrowDateText(),
    minDate: todayDateText(),
    loading: false,
    bookingSlotId: "",
    error: "",
    venue: null,
    slots: [],
    selectedSlotIndex: 0,
    selectedSlotLabel: "请先选择可预约时段",
    selectedSlotStatusText: "暂无可约",
    canSubmitBooking: false
  },

  onLoad(query) {
    const id = query && query.id ? query.id : "";
    this.setData({ id });
    this.loadAvailability();
  },

  onPullDownRefresh() {
    this.loadAvailability().finally(() => wx.stopPullDownRefresh());
  },

  loadAvailability() {
    const id = this.data.id;
    if (!id) {
      this.setData({ error: "缺少场馆 ID" });
      return Promise.resolve();
    }

    this.setData({ loading: true, error: "" });

    return get(`/api/sports-app/venues/${id}/availability?date=${this.data.date}`, { showLoading: false })
      .then((data) => {
        const slots = Array.isArray(data.slots) ? data.slots.map(mapSlot) : [];
        const firstAvailable = slots.findIndex((slot) => !slot.occupied);
        const selectedSlotIndex = firstAvailable >= 0 ? firstAvailable : 0;
        const state = bookingState(this.data.date, slots, selectedSlotIndex);

        this.setData({
          loading: false,
          venue: mapVenue(data.venue || {}),
          slots,
          selectedSlotIndex,
          ...state,
          error: slots.length ? "" : "该场馆暂未开放可预约时段。"
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "场馆时段加载失败"
        });
      });
  },

  changeDate(event) {
    this.setData({ date: event.detail.value });
    this.loadAvailability();
  },

  selectSlot(event) {
    const selectedSlotIndex = Number(event.currentTarget.dataset.index || 0);
    this.setData({
      selectedSlotIndex,
      ...bookingState(this.data.date, this.data.slots, selectedSlotIndex)
    });
  },

  bookSelectedSlot() {
    const id = this.data.id;
    const slot = this.data.slots[this.data.selectedSlotIndex];
    if (!id || !slot || slot.occupied || this.data.bookingSlotId) return;

    this.setData({ bookingSlotId: slot.id });

    post(`/api/sports-app/venues/${id}/book`, {
      booking_date: this.data.date,
      booking_start_time: slot.start,
      booking_end_time: slot.end
    }, { loadingTitle: "锁定场地" })
      .then((result) => {
        wx.showToast({
          title: result.order_id ? "已生成待支付订单" : "订场成功",
          icon: "success"
        });

        setTimeout(() => {
          wx.navigateTo({ url: result.order_id ? `/pages/orders/orders?orderId=${result.order_id}` : "/pages/orders/orders" });
        }, 600);
      })
      .catch((error) => {
        wx.showToast({
          title: error.message || "订场失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ bookingSlotId: "" });
      });
  }
});
