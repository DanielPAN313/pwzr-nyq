Page({
  onLoad() {
    this.timer = setTimeout(() => {
      this.enterHome();
    }, 1500);
  },

  onUnload() {
    if (this.timer && typeof clearTimeout === "function") clearTimeout(this.timer);
  },

  enterHome() {
    if (this.timer && typeof clearTimeout === "function") {
      clearTimeout(this.timer);
      this.timer = null;
    }

    wx.switchTab({
      url: "/pages/home/home"
    });
  }
});
