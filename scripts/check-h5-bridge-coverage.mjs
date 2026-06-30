import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const miniprogramRoot = path.join(root, "miniprogram");
const bridgeFile = path.join(root, "site", "miniapp-bridge.js");
const errors = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

if (!fs.existsSync(miniprogramRoot)) {
  errors.push("Missing miniprogram/ directory.");
}

if (!fs.existsSync(bridgeFile)) {
  errors.push("Missing site/miniapp-bridge.js.");
}

const usedApis = new Map();

if (errors.length === 0) {
  const apiCallPattern = /\bwx\.([A-Za-z_$][\w$]*)\s*\(/g;

  for (const file of walk(miniprogramRoot)) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(apiCallPattern)) {
      const apiName = match[1];
      if (!usedApis.has(apiName)) usedApis.set(apiName, new Set());
      usedApis.get(apiName).add(relative(file));
    }
  }

  const bridgeSource = fs.readFileSync(bridgeFile, "utf8");
  const missingApis = [];

  for (const [apiName, files] of usedApis.entries()) {
    const methodPattern = new RegExp(`\\b${apiName}\\s*:\\s*function\\b`);
    if (!methodPattern.test(bridgeSource)) {
      missingApis.push({ apiName, files: Array.from(files).sort() });
    }
  }

  for (const item of missingApis.sort((a, b) => a.apiName.localeCompare(b.apiName))) {
    errors.push(`wx.${item.apiName} is used in ${item.files.join(", ")} but is missing from site/miniapp-bridge.js`);
  }
}

if (errors.length > 0) {
  console.error("H5 Mini Program bridge coverage check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const covered = Array.from(usedApis.keys()).sort().map((apiName) => `wx.${apiName}`).join(", ") || "no wx API calls";
console.log(`H5 Mini Program bridge coverage check passed: ${covered}.`);
