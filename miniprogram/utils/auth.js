const { getConfig } = require("./config");

const MOCK_USER = {
  id: 1,
  username: "demo_player",
  nickName: "宁约球体验用户",
  avatarUrl: "",
  creditScore: 100,
  role: "player"
};

const PLAYER_HOME = "/pages/home/home";
const VENUE_HOME = "/pages/venue/home/index";

function getStoredUser() {
  const { storageKeys } = getConfig();
  return wx.getStorageSync(storageKeys.user) || null;
}

function getToken() {
  const { storageKeys } = getConfig();
  return wx.getStorageSync(storageKeys.token) || "";
}

function setSession(session) {
  const { storageKeys } = getConfig();
  const rawUser = session.user || MOCK_USER;
  const user = {
    ...rawUser,
    role: rawUser.role || session.role || "player"
  };
  const token = session.token || `dev-token-${user.username || "demo"}`;

  wx.setStorageSync(storageKeys.user, user);
  wx.setStorageSync(storageKeys.token, token);
  wx.setStorageSync(storageKeys.identity, user.role);

  const app = getApp();
  app.globalData.user = user;
  app.globalData.token = token;

  return { user, token };
}

function getStoredIdentity() {
  const { storageKeys } = getConfig();
  const user = getStoredUser();
  return wx.getStorageSync(storageKeys.identity) || (user && user.role) || "";
}

function hasSelectedIdentity() {
  return ["player", "venue_admin"].includes(getStoredIdentity());
}

function getLandingPath(role = getStoredIdentity()) {
  return role === "venue_admin" ? VENUE_HOME : PLAYER_HOME;
}

function ensureDevLogin() {
  const { useMockAuth } = getConfig();
  const existingUser = getStoredUser();
  const existingToken = getToken();

  if (existingUser && existingToken) {
    const app = getApp();
    app.globalData.user = existingUser;
    app.globalData.token = existingToken;
    return Promise.resolve({ user: existingUser, token: existingToken });
  }

  if (!useMockAuth) {
    return Promise.reject(new Error("请先登录"));
  }

  return Promise.resolve(setSession({
    user: MOCK_USER,
    token: `dev-token-${MOCK_USER.username}`
  }));
}

function logout() {
  const { storageKeys } = getConfig();
  wx.removeStorageSync(storageKeys.user);
  wx.removeStorageSync(storageKeys.token);
  wx.removeStorageSync(storageKeys.identity);
  wx.removeStorageSync(storageKeys.venueVerification);

  const app = getApp();
  app.globalData.user = null;
  app.globalData.token = "";
}

module.exports = {
  MOCK_USER,
  PLAYER_HOME,
  VENUE_HOME,
  ensureDevLogin,
  getLandingPath,
  getStoredIdentity,
  getStoredUser,
  getToken,
  hasSelectedIdentity,
  logout,
  setSession
};
