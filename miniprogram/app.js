const { DEFAULT_CONFIG } = require("./utils/config");

App({
  globalData: {
    config: DEFAULT_CONFIG,
    apiBaseUrl: DEFAULT_CONFIG.apiBaseUrl,
    user: null,
    token: ""
  }
});
