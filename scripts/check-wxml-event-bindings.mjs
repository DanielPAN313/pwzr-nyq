import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pagesRoot = path.join(root, "miniprogram", "pages");
const errors = [];

const eventAttributePattern =
  /\b(?:bind|catch):?(?:tap|input|change|submit|confirm|blur|focus|longpress)\s*=\s*["']([^"']+)["']/g;

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

function collectEventBindings(wxmlSource) {
  const bindings = [];
  let match;
  while ((match = eventAttributePattern.exec(wxmlSource))) {
    const handler = match[1].trim();
    if (!handler || handler.startsWith("{{")) continue;
    bindings.push(handler);
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
  const eventBindings = collectEventBindings(read(wxmlFile));

  for (const handler of eventBindings) {
    if (!handlers.has(handler)) {
      errors.push(`${relative(wxmlFile)} binds "${handler}" but ${relative(jsFile)} does not define it`);
    }
  }
}

if (errors.length > 0) {
  console.error("WXML event binding check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("WXML event binding check passed.");
