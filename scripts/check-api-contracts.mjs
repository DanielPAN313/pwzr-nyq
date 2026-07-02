import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function requireIncludes(source, label, snippets) {
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      errors.push(`${label} is missing API contract: ${snippet}`);
    }
  }
}

const backend = read("scripts/serve-local-mirror.mjs");
const frontendFiles = [
  "miniprogram/utils/config.js",
  "miniprogram/pages/home/home.js",
  "miniprogram/pages/venues/venues.js",
  "miniprogram/pages/venue-detail/venue-detail.js",
  "miniprogram/pages/games/games.js",
  "miniprogram/pages/create-game/create-game.js",
  "miniprogram/pages/game-detail/game-detail.js",
  "miniprogram/pages/orders/orders.js",
  "miniprogram/pages/messages/messages.js",
  "miniprogram/pages/me/me.js",
  "miniprogram/pages/credit/credit.js",
  "miniprogram/pages/my-games/my-games.js",
  "miniprogram/pages/venue-admin/venue-admin.js"
];
const frontend = frontendFiles.map((file) => read(file)).join("\n");

requireIncludes(backend, "scripts/serve-local-mirror.mjs", [
  "pathName === '/api/sports-app/auth/wechat-login' && req.method === 'POST'",
  "pathName === '/api/sports-app/bootstrap' && req.method === 'GET'",
  "pathName === '/api/sports-app/venues' && req.method === 'GET'",
  "pathName === '/api/sports-app/venues' && req.method === 'POST'",
  "pathName.match(/^\\/api\\/sports-app\\/venues\\/(\\d+)\\/availability$/)",
  "pathName.match(/^\\/api\\/sports-app\\/venues\\/(\\d+)\\/book$/)",
  "pathName.match(/^\\/api\\/sports-app\\/venues\\/(\\d+)$/)",
  "pathName === '/api/sports-app/games' && req.method === 'GET'",
  "pathName === '/api/sports-app/games' && req.method === 'POST'",
  "pathName.match(/^\\/api\\/sports-app\\/games\\/(\\d+)\\/join$/)",
  "pathName.match(/^\\/api\\/sports-app\\/games\\/(\\d+)$/)",
  "pathName.match(/^\\/api\\/sports-app\\/games\\/(\\d+)\\/reviews$/)",
  "pathName === '/api/sports-app/me' && req.method === 'GET'",
  "pathName === '/api/sports-app/orders' && req.method === 'GET'",
  "pathName.match(/^\\/api\\/sports-app\\/orders\\/(\\d+)\\/prepay$/)",
  "pathName.match(/^\\/api\\/sports-app\\/orders\\/(\\d+)\\/pay\\/confirm$/)",
  "pathName.match(/^\\/api\\/sports-app\\/orders\\/(\\d+)\\/cancel$/)",
  "pathName.match(/^\\/api\\/sports-app\\/orders\\/(\\d+)\\/checkin$/)",
  "pathName === '/api/sports-app/notifications' && req.method === 'GET'",
  "pathName.match(/^\\/api\\/sports-app\\/notifications\\/(\\d+)\\/read$/)",
  "pathName === '/api/sports-app/venue-admin' && req.method === 'GET'",
  "pathName === '/api/sports-app/venue-admin/checkin-code' && req.method === 'POST'",
  "pathName.match(/^\\/api\\/sports-app\\/venue-admin\\/orders\\/(\\d+)\\/checkin$/)",
  "pathName.match(/^\\/api\\/sports-app\\/venue-admin\\/venues\\/(\\d+)$/)",
  "pathName === '/api/sports-app/payment/wechat/notify' && req.method === 'POST'"
]);

requireIncludes(frontend, "miniprogram frontend", [
  "/api/sports-app/auth/wechat-login",
  "/api/sports-app/bootstrap",
  "/api/sports-app/venues",
  "/availability?date=",
  "/book",
  "/api/sports-app/games",
  "/join",
  "/reviews",
  "/api/sports-app/me",
  "/api/sports-app/orders",
  "/prepay",
  "/pay/confirm",
  "/cancel",
  "/checkin",
  "/api/sports-app/notifications",
  "/read",
  "/api/sports-app/venue-admin",
  "/api/sports-app/venue-admin/checkin-code",
  "/api/sports-app/venue-admin/orders/",
  "/api/sports-app/venue-admin/venues/"
]);

if (errors.length > 0) {
  console.error("API contract check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("API contract check passed.");
