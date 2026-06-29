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

const appJson = parseJson(path.join(miniRoot, "app.json"));
parseJson(path.join(miniRoot, "project.config.json"));
parseJson(path.join(miniRoot, "sitemap.json"));

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
  }

  for (const tab of appJson.tabBar?.list || []) {
    if (!registeredPages.has(tab.pagePath)) {
      errors.push(`tabBar pagePath is not registered in pages: ${tab.pagePath}`);
    }
  }
}

const forbiddenBrowserApis = /\b(window|document|localStorage|sessionStorage|fetch|XMLHttpRequest|navigator)\b/;
for (const file of walk(miniRoot)) {
  if (!/\.(js|wxml|wxss)$/.test(file)) continue;
  const source = readUtf8(file);
  if (source.includes("\uFFFD")) {
    errors.push(`Replacement character found in ${rel(file)}; check UTF-8 encoding.`);
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
