import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appJson = JSON.parse(fs.readFileSync(path.join(root, "miniprogram", "app.json"), "utf8"));
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
      errors.push(`${file} is missing collaboration detail: ${snippet}`);
    }
  }
}

requireIncludes("docs/miniprogram-self-test.md", [
  "npm run check",
  "微信开发者工具",
  "touristappid",
  "订场流程",
  "球局流程",
  "订单流程",
  "消息流程",
  "场馆端",
  "下拉刷新",
  "通过标准",
]);

requireIncludes("docs/ui-merge-checklist.md", [
  "ui-polish",
  "feature-miniprogram-flow",
  "git diff --stat",
  "npm run check:ui-branch-scope",
  "docs/ui-design-system.md",
  "不能删的关键绑定",
  "不要直接整支合并",
  "Safe UI candidates",
  "从最新 `feature-miniprogram-flow` 重建或更新分支",
  "git checkout -b ui-polish-refresh",
  "npm run check:ui-branch-scope -- origin/feature-miniprogram-flow origin/ui-polish-refresh",
  "只挑安全的 `.wxml`、`.wxss`、`app.wxss`",
  "npm run check",
  "GitHub 的 `Actions` 页面",
  "macOS",
  "`ui-polish` 或 `ui-polish-refresh` 分支的 `Check` 工作流通过",
  "Files outside safe UI scope require manual review",
  "docs/miniprogram-self-test.md",
  "git merge origin/ui-polish",
]);

requireIncludes("docs/ui-design-system.md", [
  "miniprogram/",
  "年轻、运动、绿色、可信",
  "不要卡片套卡片",
  "底部 tab 页面",
  "loading、error、empty",
  "UI 基础结构",
  "npm run check",
]);

requireIncludes("docs/collaboration-plan.md", [
  "docs/miniprogram-self-test.md",
  "docs/ui-merge-checklist.md",
  "docs/ui-design-system.md",
  "secrets/",
  "*.pem",
]);

requireIncludes(".github/pull_request_template.md", [
  "UI branch scope check",
  "npm run check:ui-branch-scope -- origin/feature-miniprogram-flow HEAD",
  "ui-polish-refresh",
  "docs/ui-merge-checklist.md",
]);

requireIncludes("docs/project-roadmap.md", [
  "docs/miniprogram-self-test.md",
  "docs/ui-merge-checklist.md",
  "docs/ui-design-system.md",
  "http://localhost:4174/?page=splash",
  "./secrets:/run/secrets:ro",
  "release-wechat-config",
]);

function requireCurrentPageCount(file) {
  const source = read(file);
  const pageCount = Array.isArray(appJson.pages) ? appJson.pages.length : 0;
  const expected = `loaded app.js, ${pageCount} pages, and home.switchTab.`;
  if (!source.includes(expected)) {
    errors.push(`${file} should document current runtime page count: ${expected}`);
  }
}

requireCurrentPageCount("docs/macbook-repro.md");
requireIncludes("docs/macbook-repro.md", [
  "GitHub 仓库的 `Actions` 页面",
  "miniprogram/utils/config.js",
  "http://localhost:4174/?page=splash",
  "`ui-polish` 和 `ui-polish-refresh` 分支会自动跑 Ubuntu 和 macOS",
  "git checkout -b ui-polish-refresh",
  "npm run check:ui-branch-scope -- origin/feature-miniprogram-flow HEAD",
]);

requireIncludes("README.md", [
  "miniprogram/utils/config.js",
  "http://localhost:4174/?page=splash",
  "商户私钥 `secrets/` 只读挂载",
]);

requireIncludes("docs/无需注册小程序的开发预览说明.md", [
  "release-wechat-config",
  "真实 `wx...` AppID",
  "miniprogram/app.js",
  "useMockAuth: false",
]);

if (errors.length > 0) {
  console.error("Collaboration docs check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Collaboration docs check passed.");
