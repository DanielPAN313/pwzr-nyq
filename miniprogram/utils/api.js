const { buildUrl, getConfig } = require("./config");
const { ensureLogin, getStoredUser, getToken } = require("./auth");

const statusMessages = {
  400: "请求参数有误，请检查填写内容。",
  401: "登录状态已失效，请重新进入小程序。",
  403: "当前账号暂无权限执行这个操作。",
  404: "没有找到对应数据，可能已被删除或未同步。",
  409: "当前状态已变化，请刷新后再试。",
  500: "服务器暂时异常，请稍后重试。",
  502: "服务网关异常，请稍后重试。",
  503: "服务正在维护，请稍后重试。",
  504: "服务器响应超时，请稍后重试。"
};

function attachMeta(error, meta) {
  Object.assign(error, meta || {});
  return error;
}

function networkMessage(errMsg) {
  const text = String(errMsg || "").toLowerCase();

  if (text.includes("timeout")) return "网络超时，请检查后端服务或稍后重试。";
  if (text.includes("abort")) return "请求已取消。";
  if (text.includes("url not in domain list")) return "接口域名未加入微信合法域名，请检查小程序后台配置。";
  if (text.includes("fail")) return "网络连接失败，请确认本地后端或服务器正在运行。";

  return "请求失败，请稍后重试。";
}

function normalizeError(error, fallbackMessage, meta) {
  if (error instanceof Error) return attachMeta(error, meta);

  if (error && error.errMsg) {
    return attachMeta(new Error(networkMessage(error.errMsg)), {
      ...(meta || {}),
      rawMessage: error.errMsg
    });
  }

  return attachMeta(new Error(fallbackMessage || "请求失败，请稍后重试。"), meta);
}

function responseError(res) {
  const data = res.data || {};
  const statusCode = Number(res.statusCode || 0);
  const message = data.error || data.message || statusMessages[statusCode] || `请求失败：${statusCode}`;
  const error = new Error(message);
  error.statusCode = statusCode;
  error.response = res;
  error.retryable = statusCode >= 500 || statusCode === 408 || statusCode === 429;
  return error;
}

function shouldRetry(error, attempt, maxRetries, method) {
  if (attempt >= maxRetries) return false;
  if (!["GET", "HEAD"].includes(method)) return false;

  return Boolean(error.retryable || error.networkError);
}

function request(path, options = {}) {
  const config = getConfig();
  const showLoading = options.showLoading !== false;
  const needAuth = options.auth !== false;
  const loadingTitle = options.loadingTitle || "加载中";
  const method = options.method || "GET";
  const maxRetries = Number(options.retry == null ? config.requestRetryCount : options.retry) || 0;
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

  const authReady = needAuth ? ensureLogin() : Promise.resolve(null);

  function sendRequest(attempt) {
    const token = getToken();
    const user = getStoredUser();
    const header = {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(user && user.id ? { "X-User-Id": String(user.id) } : {}),
      ...(user && user.username ? { "X-Username": user.username } : {}),
      ...(options.header || {})
    };

    return new Promise((resolve, reject) => {
      wx.request({
        url: buildUrl(path),
        method,
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
          reject(normalizeError(error, "请求失败，请稍后重试。", { networkError: true }));
        }
      });
    }).catch((error) => {
      if (shouldRetry(error, attempt, maxRetries, method)) {
        return sendRequest(attempt + 1);
      }

      throw error;
    });
  }

  return authReady
    .then(() => sendRequest(0))
    .catch((error) => {
      throw normalizeError(error);
    })
    .finally(finishLoading);
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
