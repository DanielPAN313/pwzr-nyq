const { buildUrl, getConfig } = require("./config");
const { ensureDevLogin, getStoredUser, getToken } = require("./auth");

function normalizeError(error, fallbackMessage) {
  if (error instanceof Error) return error;

  if (error && error.errMsg) {
    return new Error(error.errMsg);
  }

  return new Error(fallbackMessage || "请求失败");
}

function responseError(res) {
  const data = res.data || {};
  const message = data.error || data.message || `请求失败：${res.statusCode}`;
  const error = new Error(message);
  error.statusCode = res.statusCode;
  error.response = res;
  return error;
}

function request(path, options = {}) {
  const config = getConfig();
  const showLoading = options.showLoading !== false;
  const needAuth = options.auth !== false;
  const loadingTitle = options.loadingTitle || "加载中";
  let loadingVisible = false;

  function finishLoading() {
    if (!loadingVisible) return;
    loadingVisible = false;
    wx.hideLoading();
  }

  if (showLoading) {
    wx.showLoading({ title: loadingTitle, mask: true });
    loadingVisible = true;
  }

  const authReady = needAuth ? ensureDevLogin() : Promise.resolve(null);

  return authReady.then(() => new Promise((resolve, reject) => {
    const token = getToken();
    const user = getStoredUser();
    const header = {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(user && user.id ? { "X-User-Id": String(user.id) } : {}),
      ...(user && user.username ? { "X-Username": user.username } : {}),
      ...(options.header || {})
    };

    wx.request({
      url: buildUrl(path),
      method: options.method || "GET",
      data: options.data || {},
      header,
      timeout: options.timeout || config.requestTimeout,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }

        reject(responseError(res));
      },
      fail(error) {
        reject(normalizeError(error));
      },
      complete() {
        finishLoading();
      }
    });
  })).catch((error) => {
    finishLoading();
    throw normalizeError(error);
  });
}

function get(path, options) {
  return request(path, { ...(options || {}), method: "GET" });
}

function post(path, data, options) {
  return request(path, { ...(options || {}), method: "POST", data });
}

module.exports = {
  get,
  post,
  request
};
