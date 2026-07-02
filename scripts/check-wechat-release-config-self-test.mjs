import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "check-wechat-release-config.mjs");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nyq-release-config-"));

function write(file, source) {
  const fullPath = path.join(tempRoot, file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, source, "utf8");
}

function projectConfig(appid, urlCheck) {
  return JSON.stringify({
    description: "宁约球微信小程序",
    miniprogramRoot: "miniprogram/",
    compileType: "miniprogram",
    appid,
    projectname: "nyq-miniprogram",
    setting: {
      urlCheck,
      es6: true,
      enhance: true,
      postcss: true,
      minified: true
    }
  }, null, 2);
}

function devConfig() {
  return `const DEFAULT_CONFIG = {
  env: "development",
  apiBaseUrl: "http://localhost:4174",
  requestTimeout: 10000,
  requestRetryCount: 1,
  useMockAuth: true,
  wechatLoginPath: "/api/sports-app/auth/wechat-login"
};

module.exports = { DEFAULT_CONFIG };
`;
}

function appConfig(source) {
  return `const { DEFAULT_CONFIG } = require("./utils/config");

App({
  globalData: {
    config: ${source},
    apiBaseUrl: DEFAULT_CONFIG.apiBaseUrl,
    user: null,
    token: ""
  }
});
`;
}

function runCheck(cwd) {
  return execFileSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

try {
  write("project.config.json", projectConfig("wx1234567890abcdef", true));
  write("miniprogram/project.config.json", projectConfig("wx1234567890abcdef", true));
  write("miniprogram/utils/config.js", devConfig());
  write("miniprogram/app.js", appConfig(`{
      ...DEFAULT_CONFIG,
      env: "production",
      apiBaseUrl: "https://api.nyq.example.com",
      useMockAuth: false
    }`));

  const passOutput = runCheck(tempRoot);
  if (!passOutput.includes("WeChat release config check passed.")) {
    throw new Error("Expected valid release config fixture to pass.");
  }

  write("project.config.json", projectConfig("touristappid", false));
  write("miniprogram/project.config.json", projectConfig("touristappid", false));
  write("miniprogram/app.js", appConfig("DEFAULT_CONFIG"));

  let failedAsExpected = false;
  try {
    runCheck(tempRoot);
  } catch (error) {
    failedAsExpected = true;
    const output = `${error.stdout || ""}\n${error.stderr || ""}`;
    for (const snippet of [
      "real WeChat Mini Program AppID",
      "setting.urlCheck=false",
      "miniprogram/app.js"
    ]) {
      if (!output.includes(snippet)) {
        throw new Error(`Invalid release config fixture did not report: ${snippet}`);
      }
    }
  }

  if (!failedAsExpected) {
    throw new Error("Expected invalid release config fixture to fail.");
  }

  console.log("WeChat release config self-test passed.");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
