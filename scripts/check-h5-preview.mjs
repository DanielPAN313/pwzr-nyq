import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const siteRoot = path.join(root, "site");
const errors = [];

function read(file) {
  return fs.readFileSync(path.join(siteRoot, file), "utf8");
}

function readRoot(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function parseJson(file) {
  try {
    return JSON.parse(readRoot(file));
  } catch (error) {
    errors.push(`${file} is not valid JSON: ${error.message}`);
    return null;
  }
}

function requireIncludes(file, snippets) {
  const source = read(file);
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      errors.push(`${file} is missing required preview contract: ${snippet}`);
    }
  }
}

requireIncludes("index.html", [
  '<body class="mobile-share">',
  "/miniapp-bridge.js",
  "/mobile-preview-lock.css",
  "/sports-app.js",
]);

requireIncludes("mobile-preview-lock.css", [
  "Final lock",
  "width: 390px !important",
  "min-width: 390px !important",
  "width: 370px !important",
  "grid-template-columns: 52px minmax(0, 1fr) !important",
  ".wx-bridge-toast",
]);

requireIncludes("sports-app.js", [
  "ROUTABLE_USER_VIEWS",
  "ROUTE_PATH_VIEWS",
  "readPreviewRoute",
  "syncPreviewRoute",
  "window.addEventListener('popstate'",
]);

requireIncludes("miniapp-bridge.js", [
  "window.wx",
  "__isH5MiniProgramBridge",
  "request: function",
  "switchTab: function",
  "getLaunchOptionsSync",
  "getEnterOptionsSync",
  "window.getCurrentPages",
  "getSystemInfoSync",
]);

const appJson = parseJson("miniprogram/app.json");
if (appJson) {
  const miniPages = Array.isArray(appJson.pages) ? appJson.pages : [];
  const tabPages = Array.isArray(appJson.tabBar?.list)
    ? appJson.tabBar.list.map((item) => item.pagePath).filter(Boolean)
    : [];
  const bridgeSource = read("miniapp-bridge.js");
  const sportsSource = read("sports-app.js");

  for (const pagePath of miniPages) {
    if (!bridgeSource.includes(`'${pagePath}'`) && !bridgeSource.includes(`"${pagePath}"`)) {
      errors.push(`miniapp-bridge.js route map is missing miniprogram page: ${pagePath}`);
    }
    if (!sportsSource.includes(`'${pagePath}'`) && !sportsSource.includes(`"${pagePath}"`)) {
      errors.push(`sports-app.js ROUTE_PATH_VIEWS is missing miniprogram page: ${pagePath}`);
    }
  }

  for (const pagePath of tabPages) {
    if (!bridgeSource.includes(`'${pagePath}'`) && !bridgeSource.includes(`"${pagePath}"`)) {
      errors.push(`miniapp-bridge.js TAB_PAGES is missing tabBar page: ${pagePath}`);
    }
  }
}

if (errors.length > 0) {
  console.error("H5 Mini Program preview check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("H5 Mini Program preview check passed.");
