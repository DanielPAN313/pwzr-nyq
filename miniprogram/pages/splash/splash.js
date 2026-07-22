const { getLandingPath, getStoredIdentity, hasSelectedIdentity } = require("../../utils/auth");

Page({
  onLoad() {
    this.timer = setTimeout(() => {
      if (!hasSelectedIdentity()) {
        wx.reLaunch({ url: "/pages/login/login" });
        return;
      }

      const role = getStoredIdentity();
      const url = getLandingPath(role);
      if (role === "venue_admin") {
        wx.reLaunch({ url });
        return;
      }
      wx.switchTab({ url });
    }, 1900);
  },

  onUnload() {
    if (this.timer) clearTimeout(this.timer);
  }
});
