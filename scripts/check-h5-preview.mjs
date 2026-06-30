import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const siteRoot = path.join(root, "site");
const errors = [];

function read(file) {
  return fs.readFileSync(path.join(siteRoot, file), "utf8");
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

if (errors.length > 0) {
  console.error("H5 Mini Program preview check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("H5 Mini Program preview check passed.");
