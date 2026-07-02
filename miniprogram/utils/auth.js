const { buildUrl, getConfig } = require("./config");

const MOCK_USER = {
  id: 1,
  username: "demo_player",
  nickName: "宁约球体验用户",
  avatarUrl: "",
  creditScore: 100
};

let loginPromise = null;

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
  const user = session.user || MOCK_USER;
  const token = session.token || `dev-token-${user.username || "demo"}`;

  wx.setStorageSync(storageKeys.user, user);
  wx.setStorageSync(storageKeys.token, token);

  const app = getApp();
  app.globalData.user = user;
  app.globalData.token = token;

  return { user, token };
}

function loginWithMockUser() {
  return Promise.resolve(setSession({
    user: MOCK_USER,
    token: `dev-token-${MOCK_USER.username}`
  }));
}

function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (result && result.code) {
          resolve(result.code);
          return;
        }

        reject(new Error("wx.login did not return code"));
      },
      fail(error) {
        reject(new Error((error && error.errMsg) || "wx.login failed"));
      }
    });
  });
}

function requestWechatSession(code) {
  const { requestTimeout, wechatLoginPath } = getConfig();

  return new Promise((resolve, reject) => {
    wx.request({
      url: buildUrl(wechatLoginPath),
      method: "POST",
      data: { code },
      header: {
        "content-type": "application/json"
      },
      timeout: requestTimeout,
      success(res) {
        const data = res.data || {};

        if (res.statusCode >= 200 && res.statusCode < 300 && data.user) {
          resolve(setSession({
            user: data.user,
            token: data.token || data.user.token
          }));
          return;
        }

        reject(new Error(data.error || data.message || `wechat login failed: ${res.statusCode}`));
      },
      fail(error) {
        reject(new Error((error && error.errMsg) || "wechat login request failed"));
      }
    });
  });
}

function loginWithWechat() {
  return wxLogin().then((code) => requestWechatSession(code));
}

function ensureLogin() {
  const { useMockAuth } = getConfig();
  const existingUser = getStoredUser();
  const existingToken = getToken();

  if (existingUser && existingToken) {
    const app = getApp();
    app.globalData.user = existingUser;
    app.globalData.token = existingToken;
    return Promise.resolve({ user: existingUser, token: existingToken });
  }

  if (useMockAuth) {
    return loginWithMockUser();
  }

  if (!loginPromise) {
    loginPromise = loginWithWechat().finally(() => {
      loginPromise = null;
    });
  }

  return loginPromise;
}

function ensureDevLogin() {
  return ensureLogin();
}

function logout() {
  const { storageKeys } = getConfig();
  wx.removeStorageSync(storageKeys.user);
  wx.removeStorageSync(storageKeys.token);

  const app = getApp();
  app.globalData.user = null;
  app.globalData.token = "";
}

module.exports = {
  MOCK_USER,
  ensureLogin,
  ensureDevLogin,
  getStoredUser,
  getToken,
  logout,
  setSession
};
