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
  "通过标准",
]);

requireIncludes("docs/ui-merge-checklist.md", [
  "ui-polish",
  "feature-miniprogram-flow",
  "git diff --stat",
  "docs/ui-design-system.md",
  "不能删的关键绑定",
  "npm run check",
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
]);

requireIncludes("docs/project-roadmap.md", [
  "docs/miniprogram-self-test.md",
  "docs/ui-merge-checklist.md",
  "docs/ui-design-system.md",
]);

if (errors.length > 0) {
  console.error("Collaboration docs check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Collaboration docs check passed.");
