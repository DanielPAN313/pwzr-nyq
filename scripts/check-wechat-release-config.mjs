import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(file) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing ${file}.`);
    return "";
  }

  return fs.readFileSync(fullPath, "utf8");
}

function readJson(file) {
  const source = read(file);
  if (!source) return {};

  try {
    return JSON.parse(source);
  } catch (error) {
    errors.push(`${file} is not valid JSON: ${error.message}`);
    return {};
  }
}

function quotedValuesFor(source, key) {
  const pattern = new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`, "g");
  const values = [];
  let match;

  while ((match = pattern.exec(source))) values.push(match[1]);
  return values;
}

function booleanValuesFor(source, key) {
  const pattern = new RegExp(`${key}\\s*:\\s*(true|false)`, "g");
  const values = [];
  let match;

  while ((match = pattern.exec(source))) values.push(match[1] === "true");
  return values;
}

function hasProductionApiBaseUrl(sources) {
  const values = sources.flatMap((source) => quotedValuesFor(source, "apiBaseUrl"));
  return values.some((value) => (
    /^https:\/\//i.test(value)
    && !/localhost|127\.0\.0\.1|0\.0\.0\.0|your-domain\.com/i.test(value)
  ));
}

function hasProductionEnv(sources) {
  return sources.flatMap((source) => quotedValuesFor(source, "env")).some((value) => value === "production");
}

function hasRealWechatLogin(sources) {
  return sources.flatMap((source) => booleanValuesFor(source, "useMockAuth")).some((value) => value === false);
}

function validateAppId(file) {
  const config = readJson(file);
  const appid = String(config.appid || "").trim();

  if (!appid || appid === "touristappid") {
    errors.push(`${file} must use the real WeChat Mini Program AppID before release.`);
  }

  if (config.setting && config.setting.urlCheck === false) {
    errors.push(`${file} should not keep setting.urlCheck=false for experience/release builds.`);
  }
}

validateAppId("project.config.json");
validateAppId("miniprogram/project.config.json");

const configSource = read("miniprogram/utils/config.js");
const appSource = read("miniprogram/app.js");
const releaseSources = [configSource, appSource];

if (!hasProductionEnv(releaseSources)) {
  errors.push("Release config must set env: \"production\" in miniprogram/utils/config.js or miniprogram/app.js.");
}

if (!hasProductionApiBaseUrl(releaseSources)) {
  errors.push("Release config must set apiBaseUrl to a real HTTPS domain, not localhost or api.your-domain.com.");
}

if (!hasRealWechatLogin(releaseSources)) {
  errors.push("Release config must set useMockAuth: false so wx.login is used.");
}

if (errors.length > 0) {
  console.error("WeChat release config check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("WeChat release config check passed.");
