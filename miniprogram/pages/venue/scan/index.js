const { getStoredUser } = require("../../../utils/auth");

const PLAYER_HOME = "/pages/home/home";

function hasVenueAdminRole(user) {
  const role = user && (user.role || user.profile?.role || user.venueRole || user.user?.role);
  return role === "venue_admin";
}

function backToPlayerHome() {
  wx.switchTab({
    url: PLAYER_HOME,
    fail() {
      wx.reLaunch({ url: PLAYER_HOME });
    }
  });
}

Page({
  data: {},

  onLoad() {
    this.guardVenueAdmin();
  },

  onShow() {
    this.guardVenueAdmin();
  },

  guardVenueAdmin() {
    const user = getStoredUser() || {};
    if (!hasVenueAdminRole(user)) {
      backToPlayerHome();
      return false;
    }

    return true;
  },

  returnVenueHome() {
    wx.navigateBack({
      fail() {
        wx.redirectTo({ url: "/pages/venue/home/index" });
      }
    });
  }
});
