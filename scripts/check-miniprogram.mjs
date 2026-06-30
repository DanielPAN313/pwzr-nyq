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
const sitemapJson = parseJson(path.join(miniRoot, "sitemap.json"));

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

if (sitemapJson) {
  if (!Array.isArray(sitemapJson.rules) || sitemapJson.rules.length === 0) {
    errors.push("miniprogram/sitemap.json must define at least one rule.");
  } else {
    const allowsAllPages = sitemapJson.rules.some((rule) => rule?.action === "allow" && rule?.page === "*");
    if (!allowsAllPages) {
      errors.push('miniprogram/sitemap.json should keep an allow "*" rule during local Mini Program development.');
    }
  }
}

if (appJson) {
  if (!Array.isArray(appJson.pages) || appJson.pages.length === 0) {
    errors.push("miniprogram/app.json must register at least one page.");
  }

  if (!appJson.window || typeof appJson.window !== "object") {
    errors.push("miniprogram/app.json window config is required.");
  } else {
    if (typeof appJson.window.navigationBarTitleText !== "string" || !appJson.window.navigationBarTitleText.trim()) {
      errors.push("miniprogram/app.json window.navigationBarTitleText is required.");
    }
    if (!["black", "white"].includes(appJson.window.navigationBarTextStyle)) {
      errors.push('miniprogram/app.json window.navigationBarTextStyle must be "black" or "white".');
    }
    for (const key of ["navigationBarBackgroundColor", "backgroundColor"]) {
      if (typeof appJson.window[key] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(appJson.window[key])) {
        errors.push(`miniprogram/app.json window.${key} must be a 6-digit hex color.`);
      }
    }
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

  if (appJson.tabBar) {
    const tabList = Array.isArray(appJson.tabBar.list) ? appJson.tabBar.list : [];
    if (tabList.length < 2 || tabList.length > 5) {
      errors.push("miniprogram/app.json tabBar.list must contain 2 to 5 items.");
    }
    for (const key of ["color", "selectedColor", "backgroundColor"]) {
      if (typeof appJson.tabBar[key] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(appJson.tabBar[key])) {
        errors.push(`miniprogram/app.json tabBar.${key} must be a 6-digit hex color.`);
      }
    }
    if (appJson.tabBar.borderStyle && !["black", "white"].includes(appJson.tabBar.borderStyle)) {
      errors.push('miniprogram/app.json tabBar.borderStyle must be "black" or "white".');
    }
    for (const [index, tab] of tabList.entries()) {
      if (!tab.pagePath) {
        errors.push(`miniprogram/app.json tabBar.list[${index}].pagePath is required.`);
      } else if (!registeredPages.has(tab.pagePath)) {
        errors.push(`tabBar pagePath is not registered in pages: ${tab.pagePath}`);
      }
      if (!tab.text) {
        errors.push(`miniprogram/app.json tabBar.list[${index}].text is required.`);
      }
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
