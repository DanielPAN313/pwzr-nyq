import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appJsonPath = path.join(root, "miniprogram", "app.json");
const selfTestPath = path.join(root, "docs", "miniprogram-self-test.md");
const errors = [];

const pageChecks = {
  "pages/splash/splash": ["启动页", "自动进入首页"],
  "pages/auth/auth": ["账号页", "创建账号"],
  "pages/home/home": ["首页", "快捷入口"],
  "pages/venues/venues": ["订场页", "搜索场馆"],
  "pages/venue-detail/venue-detail": ["场馆详情页", "生成待支付订单"],
  "pages/games/games": ["球局页", "搜索球局"],
  "pages/create-game/create-game": ["发起球局页", "发布预览"],
  "pages/game-detail/game-detail": ["球局详情页", "报名进度条"],
  "pages/messages/messages": ["消息页", "未读/已读分组"],
  "pages/me/me": ["我的页", "入口分组"],
  "pages/orders/orders": ["订单页", "模拟支付"],
  "pages/venue-admin/venue-admin": ["场馆管理页", "核销码"],
  "pages/credit/credit": ["信用分页", "信用规则"],
  "pages/my-games/my-games": ["我的球局页", "下一步动作"],
  "pages/legal/legal": ["合规说明页", "上线前需要替换正式文本"],
};

function read(file) {
  return fs.readFileSync(file, "utf8");
}

const appJson = JSON.parse(read(appJsonPath));
const selfTest = read(selfTestPath);
const registeredPages = appJson.pages || [];

for (const page of registeredPages) {
  const snippets = pageChecks[page];
  if (!snippets) {
    errors.push(`docs/miniprogram-self-test.md has no coverage rule for registered page: ${page}`);
    continue;
  }

  for (const snippet of snippets) {
    if (!selfTest.includes(snippet)) {
      errors.push(`docs/miniprogram-self-test.md is missing self-test detail for ${page}: ${snippet}`);
    }
  }
}

for (const page of Object.keys(pageChecks)) {
  if (!registeredPages.includes(page)) {
    errors.push(`Self-test coverage rule references an unregistered page: ${page}`);
  }
}

for (const snippet of [
  "体验版/审核前附加检查",
  "npm run check:deploy",
  "npm run check:release-config",
  "release-wechat-config",
  "miniprogram/utils/config.js",
  "miniprogram/app.js",
  "setting.urlCheck",
  "useMockAuth",
  "当前本地开发分支运行 `npm run check:release-config` 会失败，这是正常的",
]) {
  if (!selfTest.includes(snippet)) {
    errors.push(`docs/miniprogram-self-test.md is missing release self-test detail: ${snippet}`);
  }
}

if (errors.length > 0) {
  console.error("Mini Program self-test coverage check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Mini Program self-test coverage check passed.");
