const { getStoredUser } = require("../../../utils/auth");

const LOGIN_PAGE = "/pages/login/login";

function hasVenueAdminRole(user) {
  const role = user && (user.role || user.profile?.role || user.venueRole || user.user?.role);
  return role === "venue_admin";
}

function backToPlayerHome() {
  wx.reLaunch({ url: LOGIN_PAGE });
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
