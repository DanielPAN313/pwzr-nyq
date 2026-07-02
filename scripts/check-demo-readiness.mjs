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

function readJson(file) {
  try {
    return JSON.parse(read(file));
  } catch (error) {
    errors.push(`${file} is not valid JSON: ${error.message}`);
    return null;
  }
}

function expectedPrPageLabel(pagePath) {
  const explicitLabels = {
    "pages/splash/splash": "启动页",
    "pages/home/home": "首页",
    "pages/orders/orders": "订单页",
  };
  if (explicitLabels[pagePath]) return explicitLabels[pagePath];

  const pageJson = readJson(`miniprogram/${pagePath}.json`);
  const title = pageJson?.navigationBarTitleText;
  if (!title) return pagePath;

  const suffixByPath = {
    "pages/venues/venues": "页",
    "pages/games/games": "页",
    "pages/orders/orders": "页",
    "pages/messages/messages": "页",
    "pages/me/me": "页",
    "pages/credit/credit": "页",
    "pages/legal/legal": "页",
  };

  return `${title}${suffixByPath[pagePath] || ""}`;
}

function requirePrTemplatePageCoverage() {
  const appJson = readJson("miniprogram/app.json");
  const template = read(".github/pull_request_template.md");
  const pages = Array.isArray(appJson?.pages) ? appJson.pages : [];
  for (const pagePath of pages) {
    const label = expectedPrPageLabel(pagePath);
    if (!template.includes(label)) {
      errors.push(`.github/pull_request_template.md should include page checklist label for ${pagePath}: ${label}`);
    }
  }
}

[
  "miniprogram/app.json",
  "miniprogram/app.js",
  "scripts/serve-local-mirror.mjs",
  "db/schema.sql",
  "docs/project-roadmap.md",
  "docs/current-handoff.md",
  "docs/macbook-repro.md",
  "docs/collaboration-plan.md",
  "docs/miniprogram-self-test.md",
  "docs/ui-merge-checklist.md",
  "docs/ui-design-system.md",
  "docs/server-deploy.md",
  ".env.example",
  ".env.server.example",
  "project.config.json",
  "miniprogram/project.config.json",
  ".github/workflows/check.yml",
  ".github/pull_request_template.md",
  "scripts/check-repository-hygiene.mjs",
  "scripts/check-api-contracts.mjs",
  "scripts/check-db-contracts.mjs",
  "scripts/check-seed-data-contracts.mjs",
  "scripts/check-miniprogram-routes.mjs",
  "scripts/check-wxml-event-bindings.mjs",
  "scripts/check-ui-structure.mjs",
  "scripts/check-self-test-coverage.mjs",
  "scripts/check-wechat-release-config.mjs",
].forEach(requirePath);

requireIncludes("README.md", [
  "微信小程序",
  "miniprogram/",
  "touristappid",
  "ui-polish",
  "GitHub 的 `Actions` 页面",
  "npm run check:ui-branch-scope",
  "docs/project-roadmap.md",
  "docs/current-handoff.md",
  "docs/miniprogram-self-test.md",
  "docs/ui-merge-checklist.md",
  "docs/ui-design-system.md",
  "WXML 事件绑定和 `data-*` 参数",
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
  "\"check:api-contracts\"",
  "\"check:db-contracts\"",
  "\"check:seed-data\"",
  "\"check:miniprogram-routes\"",
  "\"check:wxml-events\"",
  "\"check:ui-structure\"",
  "\"check:self-test-coverage\"",
  "\"check:ui-branch-scope\"",
  "\"check:release-config\"",
  "\"check\"",
  "check:demo-readiness",
  "check:repository-hygiene",
  "check:api-contracts",
  "check:db-contracts",
  "check:seed-data",
  "check:miniprogram-routes",
  "check:wxml-events",
  "check:ui-structure",
  "check:self-test-coverage",
  "check:ui-branch-scope",
  "check:release-config",
]);

requireIncludes(".github/workflows/check.yml", [
  "ubuntu-latest",
  "macos-latest",
  "feature-miniprogram-flow",
  "ui-polish",
  "npm run check",
]);

requireIncludes(".github/pull_request_template.md", [
  "npm run check",
  "npm run check:release-config",
  "release-wechat-config",
  "docs/ui-merge-checklist.md",
  "docs/ui-design-system.md",
  "docs/miniprogram-self-test.md",
  "微信开发者工具",
]);
requirePrTemplatePageCoverage();

requireIncludes("docs/project-roadmap.md", [
  "当前项目主线是微信小程序",
  "feature-miniprogram-flow",
  "ui-polish",
  "touristappid",
  "npm run check:release-config",
  "docs/miniprogram-self-test.md",
  "docs/ui-merge-checklist.md",
  "docs/ui-design-system.md",
  "WXML 事件绑定和 `data-*` 参数检查",
]);

requireIncludes("docs/current-handoff.md", [
  "feature-miniprogram-flow",
  "ui-polish",
  "touristappid",
  "npm run check",
  "npm run check:release-config",
  "微信开发者工具",
  "当前自动检查",
  "docs/ui-design-system.md",
  "WXML 事件绑定和 `data-*` 参数检查",
  "下一步建议",
]);

requireIncludes("docs/miniprogram-self-test.md", [
  "体验版/审核前附加检查",
  "npm run check:release-config",
  "当前本地开发分支运行 `npm run check:release-config` 会失败，这是正常的",
]);

requireIncludes("docs/ui-design-system.md", [
  "miniprogram/",
  "年轻、运动、绿色、可信",
  "loading、error、empty",
  "不要卡片套卡片",
  "UI 基础结构",
  "npm run check",
]);

if (errors.length > 0) {
  console.error("Demo readiness check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Demo readiness check passed.");
