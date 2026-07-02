import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pagesRoot = path.join(root, "miniprogram", "pages");
const errors = [];

const eventAttributePattern =
  /\b(?:bind|catch):?(?:tap|input|change|submit|confirm|blur|focus|longpress)\s*=\s*["']([^"']+)["']/g;
const tagPattern = /<[A-Za-z][^<>]*>/gs;
const dataAttributePattern = /\bdata-([A-Za-z0-9_-]+)\s*=/g;
const datasetAccessPattern = /event\.currentTarget\.dataset\.([A-Za-z_$][\w$]*)/g;
const optionalDatasetKeys = new Map([
  ["miniprogram/pages/home/home.js#openTarget", new Set(["tab"])]
]);

function listFiles(directory, extension) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath, extension));
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(fullPath);
    }
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function collectHandlers(jsSource) {
  const handlers = new Set();
  const methodPatterns = [
    /^\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm,
    /^\s*async\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm,
    /^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?function\s*\(/gm,
    /^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/gm,
  ];

  for (const pattern of methodPatterns) {
    let match;
    while ((match = pattern.exec(jsSource))) {
      handlers.add(match[1]);
    }
  }

  return handlers;
}

function findClosingBrace(source, openingBraceIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = openingBraceIndex; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return index;
  }

  return -1;
}

function collectDatasetRequirements(jsSource) {
  const requirements = new Map();
  const methodPatterns = [
    /^\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm,
    /^\s*async\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm,
    /^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?function\s*\([^)]*\)\s*\{/gm,
    /^\s*([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/gm,
  ];

  for (const pattern of methodPatterns) {
    let methodMatch;
    while ((methodMatch = pattern.exec(jsSource))) {
      const handler = methodMatch[1];
      const openingBraceIndex = jsSource.indexOf("{", methodMatch.index);
      const closingBraceIndex = findClosingBrace(jsSource, openingBraceIndex);
      if (openingBraceIndex === -1 || closingBraceIndex === -1) continue;

      const body = jsSource.slice(openingBraceIndex + 1, closingBraceIndex);
      let datasetMatch;
      while ((datasetMatch = datasetAccessPattern.exec(body))) {
        if (!requirements.has(handler)) requirements.set(handler, new Set());
        requirements.get(handler).add(datasetMatch[1]);
      }
    }
  }

  return requirements;
}

function toKebabCase(name) {
  return name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

function isOptionalDatasetKey(jsFile, handler, key) {
  return optionalDatasetKeys.get(`${relative(jsFile)}#${handler}`)?.has(key) || false;
}

function collectEventBindings(wxmlSource) {
  const bindings = [];
  let tagMatch;
  while ((tagMatch = tagPattern.exec(wxmlSource))) {
    const tag = tagMatch[0];
    const dataAttributes = new Set();

    dataAttributePattern.lastIndex = 0;
    let dataMatch;
    while ((dataMatch = dataAttributePattern.exec(tag))) {
      dataAttributes.add(dataMatch[1]);
    }

    eventAttributePattern.lastIndex = 0;
    let eventMatch;
    while ((eventMatch = eventAttributePattern.exec(tag))) {
      const handler = eventMatch[1].trim();
      if (!handler || handler.startsWith("{{")) continue;
      bindings.push({ handler, dataAttributes, tag });
    }
  }
  return bindings;
}

for (const wxmlFile of listFiles(pagesRoot, ".wxml")) {
  const jsFile = wxmlFile.replace(/\.wxml$/, ".js");
  if (!fs.existsSync(jsFile)) {
    errors.push(`${relative(wxmlFile)} has no matching page JS file`);
    continue;
  }

  const handlers = collectHandlers(read(jsFile));
  const jsSource = read(jsFile);
  const datasetRequirements = collectDatasetRequirements(jsSource);
  const eventBindings = collectEventBindings(read(wxmlFile));

  for (const { handler, dataAttributes } of eventBindings) {
    if (!handlers.has(handler)) {
      errors.push(`${relative(wxmlFile)} binds "${handler}" but ${relative(jsFile)} does not define it`);
      continue;
    }

    const requiredDatasetKeys = datasetRequirements.get(handler) || new Set();
    for (const key of requiredDatasetKeys) {
      if (isOptionalDatasetKey(jsFile, handler, key)) continue;

      const expectedAttribute = toKebabCase(key);
      if (!dataAttributes.has(expectedAttribute)) {
        errors.push(
          `${relative(wxmlFile)} binds "${handler}" but is missing data-${expectedAttribute} required by ${relative(jsFile)}`
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error("WXML event binding check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("WXML event binding check passed.");
