import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const miniRoot = path.join(root, "miniprogram");
const errors = [];

function readUtf8(file) {
  return fs.readFileSync(file, "utf8");
}

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function mustExist(file, label = "file") {
  if (!fs.existsSync(file)) {
    errors.push(`Missing ${label}: ${rel(file)}`);
    return false;
  }
  return true;
}

function parseJson(file) {
  if (!mustExist(file, "JSON file")) return null;
  try {
    return JSON.parse(readUtf8(file));
  } catch (error) {
    errors.push(`Invalid JSON in ${rel(file)}: ${error.message}`);
    return null;
  }
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
    } else {
      out.push(fullPath);
    }
  }
  return out;
}

function wxmlEventHandlers(source) {
  const handlers = new Set();
  const eventPattern = /\b(?:bind|catch|mut-bind)[\w:-]*\s*=\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(eventPattern)) {
    const handler = String(match[1] || "").trim();
    if (handler && !handler.startsWith("{{")) handlers.add(handler);
  }
  return handlers;
}

function pageMethodNames(source) {
  const methods = new Set();
  for (const line of source.split(/\r?\n/)) {
    const methodMatch = line.match(/^\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/);
    const propertyMatch = line.match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/);
    const match = methodMatch || propertyMatch;
    if (match) methods.add(match[1]);
  }
  return methods;
}

const appJson = parseJson(path.join(miniRoot, "app.json"));
const rootProjectConfig = parseJson(path.join(root, "project.config.json"));
const miniProjectConfig = parseJson(path.join(miniRoot, "project.config.json"));
parseJson(path.join(miniRoot, "sitemap.json"));

function validateProjectConfig(config, file, expectedRoots) {
  if (!config) return;
  const label = rel(file);
  if (config.compileType !== "miniprogram") {
    errors.push(`${label} compileType must be "miniprogram".`);
  }
  if (config.appid !== "touristappid") {
    errors.push(`${label} appid should stay "touristappid" until a real Mini Program AppID is registered.`);
  }
  if (!expectedRoots.includes(config.miniprogramRoot)) {
    errors.push(`${label} miniprogramRoot must be one of: ${expectedRoots.join(", ")}.`);
  }
  if (config.setting?.urlCheck !== false) {
    errors.push(`${label} setting.urlCheck must be false for local localhost API development before registration.`);
  }
}

validateProjectConfig(rootProjectConfig, path.join(root, "project.config.json"), ["miniprogram/", "miniprogram"]);
validateProjectConfig(miniProjectConfig, path.join(miniRoot, "project.config.json"), ["./", "."]);

if (appJson) {
  if (!Array.isArray(appJson.pages) || appJson.pages.length === 0) {
    errors.push("miniprogram/app.json must register at least one page.");
  }

  const registeredPages = new Set(appJson.pages || []);

  for (const page of registeredPages) {
    for (const ext of ["js", "json", "wxml", "wxss"]) {
      const file = path.join(miniRoot, `${page}.${ext}`);
      mustExist(file, `page ${ext}`);
      if (ext === "json" && fs.existsSync(file)) parseJson(file);
    }

    const jsFile = path.join(miniRoot, `${page}.js`);
    const wxmlFile = path.join(miniRoot, `${page}.wxml`);
    if (fs.existsSync(jsFile) && fs.existsSync(wxmlFile)) {
      const methods = pageMethodNames(readUtf8(jsFile));
      for (const handler of wxmlEventHandlers(readUtf8(wxmlFile))) {
        if (!methods.has(handler)) {
          errors.push(`${rel(wxmlFile)} binds "${handler}" but ${rel(jsFile)} does not expose that Page method.`);
        }
      }
    }
  }

  for (const tab of appJson.tabBar?.list || []) {
    if (!registeredPages.has(tab.pagePath)) {
      errors.push(`tabBar pagePath is not registered in pages: ${tab.pagePath}`);
    }
  }
}

const forbiddenBrowserApis = /\b(window|document|localStorage|sessionStorage|fetch|XMLHttpRequest|navigator)\b/;
const mojibakeFragments = [
  "瀹佺害",
  "棣栭",
  "璁㈠",
  "鐞冨",
  "娑堟伅",
  "鎴戠",
  "璇锋",
  "澶辫触",
  "鍔犺浇",
  "棰勮",
];

for (const file of walk(miniRoot)) {
  if (!/\.(js|json|wxml|wxss)$/.test(file)) continue;
  const source = readUtf8(file);
  if (source.includes("\uFFFD")) {
    errors.push(`Replacement character found in ${rel(file)}; check UTF-8 encoding.`);
  }
  for (const fragment of mojibakeFragments) {
    if (source.includes(fragment)) {
      errors.push(`Possible mojibake text "${fragment}" found in ${rel(file)}; check UTF-8 Chinese text.`);
    }
  }
  if (file.endsWith(".js") && forbiddenBrowserApis.test(source)) {
    errors.push(`Browser-only API found in ${rel(file)}; use WeChat Mini Program wx.* APIs.`);
  }
}

if (errors.length > 0) {
  console.error("Mini Program check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Mini Program check passed.");
