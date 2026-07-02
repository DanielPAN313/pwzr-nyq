import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const miniRoot = path.join(root, "miniprogram");
const appJsonPath = path.join(miniRoot, "app.json");
const errors = [];

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function walk(directory, out = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
    } else if (entry.isFile() && /\.(js|wxml)$/.test(entry.name)) {
      out.push(fullPath);
    }
  }
  return out;
}

function normalizeRoute(route) {
  const clean = route.trim().replace(/^\/+/, "");
  const [withoutQuery] = clean.split("?");
  return withoutQuery;
}

function collectRouteStrings(source) {
  const routes = [];
  const routePattern = /(["'`])(\/?pages\/[^"'`\s<>{}]+(?:\?[^"'`<>{}]*)?)\1/g;
  let match;

  while ((match = routePattern.exec(source))) {
    routes.push(match[2]);
  }

  return routes;
}

function collectStaticSwitchTabRoutes(source) {
  const routes = [];
  const switchTabPattern = /wx\.switchTab\s*\(\s*\{[\s\S]*?url\s*:\s*(["'`])(\/?pages\/[^"'`\s<>{}]+)\1[\s\S]*?\}\s*\)/g;
  let match;

  while ((match = switchTabPattern.exec(source))) {
    routes.push(match[2]);
  }

  return routes;
}

const appJson = JSON.parse(read(appJsonPath));
const registeredPages = new Set(appJson.pages || []);
const tabPages = new Set((appJson.tabBar?.list || []).map((item) => item.pagePath).filter(Boolean));

for (const file of walk(miniRoot)) {
  const source = read(file);

  for (const route of collectRouteStrings(source)) {
    const pagePath = normalizeRoute(route);
    if (!registeredPages.has(pagePath)) {
      errors.push(`${relative(file)} references unregistered Mini Program page: ${route}`);
    }
  }

  for (const route of collectStaticSwitchTabRoutes(source)) {
    const pagePath = normalizeRoute(route);
    if (registeredPages.has(pagePath) && !tabPages.has(pagePath)) {
      errors.push(`${relative(file)} uses wx.switchTab for non-tab page: ${route}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Mini Program route check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Mini Program route check passed.");
