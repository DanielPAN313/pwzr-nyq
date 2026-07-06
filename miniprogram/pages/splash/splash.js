Page({
  onLoad() {
    this.timer = setTimeout(() => {
      wx.redirectTo({
        url: "/pages/register/register"
      });
    }, 1900);
  },

  onUnload() {
    if (this.timer) clearTimeout(this.timer);
  }
});
