Page({
  onLoad() {
    this.timer = setTimeout(() => {
      wx.switchTab({
        url: "/pages/home/home"
      });
    }, 1900);
  },

  onUnload() {
    if (this.timer) clearTimeout(this.timer);
  }
});
