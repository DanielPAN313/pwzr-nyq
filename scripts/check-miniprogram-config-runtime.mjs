import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const configPath = path.join(root, "miniprogram", "utils", "config.js");
const source = fs.readFileSync(configPath, "utf8");
const module = { exports: {} };
const context = vm.createContext({
  module,
  exports: module.exports,
  getApp: undefined
});

vm.runInContext(source, context, { filename: configPath });

const { DEFAULT_CONFIG, getConfig, buildUrl } = module.exports;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(DEFAULT_CONFIG.apiBaseUrl === "http://localhost:4174", "DEFAULT_CONFIG should keep localhost for local development.");
assert(getConfig().apiBaseUrl === "http://localhost:4174", "getConfig should use DEFAULT_CONFIG when getApp is unavailable.");
assert(buildUrl("/api/sports-app/bootstrap") === "http://localhost:4174/api/sports-app/bootstrap", "buildUrl should use the default localhost base.");

context.getApp = () => ({
  globalData: {
    apiBaseUrl: "http://localhost:4174",
    config: {
      ...DEFAULT_CONFIG,
      env: "production",
      apiBaseUrl: "https://api.nyq.example.com",
      useMockAuth: false,
      storageKeys: {
        token: "release_token"
      }
    }
  }
});

const releaseConfig = getConfig();
assert(releaseConfig.env === "production", "getConfig should read release env from globalData.config.");
assert(releaseConfig.apiBaseUrl === "https://api.nyq.example.com", "globalData.config.apiBaseUrl should override legacy globalData.apiBaseUrl.");
assert(releaseConfig.useMockAuth === false, "getConfig should read useMockAuth=false from globalData.config.");
assert(releaseConfig.storageKeys.token === "release_token", "getConfig should merge storage key overrides.");
assert(releaseConfig.storageKeys.user === "nyq_user", "getConfig should preserve default storage keys not overridden.");
assert(buildUrl("/api/sports-app/bootstrap") === "https://api.nyq.example.com/api/sports-app/bootstrap", "buildUrl should use release config apiBaseUrl.");

context.getApp = () => ({
  globalData: {
    apiBaseUrl: "https://legacy-api.nyq.example.com"
  }
});

assert(getConfig().apiBaseUrl === "https://legacy-api.nyq.example.com", "legacy globalData.apiBaseUrl should remain a fallback.");

console.log("Mini Program config runtime check passed.");
