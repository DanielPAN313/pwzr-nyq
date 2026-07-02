import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const miniRoot = path.join(root, "miniprogram");
const errors = [];

const requiredGlobalSelectors = [
  "page",
  ".page",
  ".section",
  ".muted",
  ".primary",
  ".secondary",
  ".small",
  ".state-panel",
  ".state-actions",
  ".state-title",
  ".state-text",
  "button[disabled]",
  "button::after",
];

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function hasClass(source, className) {
  const pattern = new RegExp(`class=["'][^"']*\\b${className}\\b[^"']*["']`);
  return pattern.test(source);
}

const appJson = JSON.parse(read(path.join(miniRoot, "app.json")));
const appWxssPath = path.join(miniRoot, "app.wxss");
const appWxss = read(appWxssPath);

for (const selector of requiredGlobalSelectors) {
  if (!appWxss.includes(selector)) {
    errors.push(`${relative(appWxssPath)} is missing required global UI selector: ${selector}`);
  }
}

if (/letter-spacing\s*:\s*-\d/.test(appWxss)) {
  errors.push(`${relative(appWxssPath)} must not use negative letter-spacing.`);
}

for (const page of appJson.pages || []) {
  const wxmlPath = path.join(miniRoot, `${page}.wxml`);
  const wxml = read(wxmlPath);

  if (!hasClass(wxml, "page")) {
    errors.push(`${relative(wxmlPath)} must keep a top-level .page layout container.`);
  }

  if (!hasClass(wxml, "section")) {
    errors.push(`${relative(wxmlPath)} must keep .section blocks for scan-friendly page structure.`);
  }

  for (const htmlTag of ["div", "span", "section", "article", "main", "button type="]) {
    if (wxml.includes(`<${htmlTag}`)) {
      errors.push(`${relative(wxmlPath)} contains browser-style markup "${htmlTag}"; use Mini Program view/text/button tags.`);
    }
  }
}

if (errors.length > 0) {
  console.error("Mini Program UI structure check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Mini Program UI structure check passed.");
