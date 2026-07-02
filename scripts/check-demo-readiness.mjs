import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(file) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    errors.push(`${file} does not exist`);
    return "";
  }

  return fs.readFileSync(fullPath, "utf8");
}

function requireIncludes(file, snippets) {
  const source = read(file);
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      errors.push(`${file} is missing demo readiness detail: ${snippet}`);
    }
  }
}

function requirePath(file) {
  if (!fs.existsSync(path.join(root, file))) {
    errors.push(`Required demo/readiness path is missing: ${file}`);
  }
}

[
  "miniprogram/app.json",
  "miniprogram/app.js",
  "scripts/serve-local-mirror.mjs",
  "db/schema.sql",
  "docs/project-roadmap.md",
  "docs/macbook-repro.md",
  "docs/collaboration-plan.md",
  "docs/miniprogram-self-test.md",
  "docs/ui-merge-checklist.md",
  "docs/server-deploy.md",
  ".env.example",
  ".env.server.example",
  "project.config.json",
  "miniprogram/project.config.json",
  ".github/workflows/check.yml",
  ".github/pull_request_template.md",
  "scripts/check-repository-hygiene.mjs",
].forEach(requirePath);

requireIncludes("README.md", [
  "微信小程序",
  "miniprogram/",
  "touristappid",
  "docs/project-roadmap.md",
  "docs/miniprogram-self-test.md",
  "docs/ui-merge-checklist.md",
  "npm run check",
  "npm run dev",
]);

requireIncludes(".gitignore", [
  ".env",
  ".env.server",
  "node_modules/",
  "*.apk",
  "nyq-*.png",
  "miniprogram/project.private.config.json",
]);

requireIncludes("package.json", [
  "\"check:demo-readiness\"",
  "\"check:repository-hygiene\"",
  "\"check\"",
  "check:demo-readiness",
  "check:repository-hygiene",
]);

requireIncludes(".github/workflows/check.yml", [
  "ubuntu-latest",
  "macos-latest",
  "feature-miniprogram-flow",
  "npm run check",
]);

requireIncludes(".github/pull_request_template.md", [
  "npm run check",
  "docs/ui-merge-checklist.md",
  "docs/miniprogram-self-test.md",
  "微信开发者工具",
  "场馆管理页",
]);

requireIncludes("docs/project-roadmap.md", [
  "当前项目主线是微信小程序",
  "feature-miniprogram-flow",
  "ui-polish",
  "touristappid",
  "docs/miniprogram-self-test.md",
  "docs/ui-merge-checklist.md",
]);

if (errors.length > 0) {
  console.error("Demo readiness check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Demo readiness check passed.");
