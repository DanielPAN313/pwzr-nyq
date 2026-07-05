const DEFAULT_CONFIG = {
  env: "development",
  apiBaseUrl: "http://localhost:4174",
  requestTimeout: 10000,
  useMockAuth: true,
  storageKeys: {
    token: "nyq_token",
    user: "nyq_user"
  }
};

function readAppConfig() {
  if (typeof getApp !== "function") return {};

  try {
    const app = getApp();
    if (!app || !app.globalData) return {};

    return {
      ...(app.globalData.config || {}),
      apiBaseUrl: app.globalData.apiBaseUrl || (app.globalData.config && app.globalData.config.apiBaseUrl)
    };
  } catch (error) {
    return {};
  }
}

function getConfig() {
  const appConfig = readAppConfig();

  return {
    ...DEFAULT_CONFIG,
    ...appConfig,
    storageKeys: {
      ...DEFAULT_CONFIG.storageKeys,
      ...(appConfig.storageKeys || {})
    }
  };
}

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;

  const { apiBaseUrl } = getConfig();
  const base = String(apiBaseUrl || "").replace(/\/+$/, "");
  const route = String(path || "").replace(/^\/+/, "");

  return `${base}/${route}`;
}

module.exports = {
  DEFAULT_CONFIG,
  getConfig,
  buildUrl
};
