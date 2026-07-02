import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function requireIncludes(file, snippets) {
  const source = read(file);
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      errors.push(`${file} is missing flow contract: ${snippet}`);
    }
  }
}

requireIncludes("miniprogram/pages/messages/messages.js", [
  "/pages/orders/orders?orderId=",
  "/pages/game-detail/game-detail?id=",
  "/api/sports-app/notifications/",
]);

requireIncludes("miniprogram/pages/orders/orders.js", [
  "highlightedOrderId",
  "wx.pageScrollTo",
  "openReview",
  "/pages/game-detail/game-detail?id=",
  "/api/sports-app/orders/",
]);

requireIncludes("miniprogram/pages/orders/orders.wxml", [
  "item.canReview",
  "bindtap=\"openReview\"",
  "data-game-id",
]);

requireIncludes("miniprogram/pages/venue-admin/venue-admin.js", [
  "/api/sports-app/venue-admin/checkin-code",
  "/api/sports-app/venue-admin/orders/",
  "/api/sports-app/venues",
  "/api/sports-app/venue-admin/venues/",
  "submitVenueApplication",
  "saveVenueMaintenance",
  "checkinByCode",
  "wx.pageScrollTo",
]);

requireIncludes("miniprogram/pages/venue-admin/venue-admin.wxml", [
  "申请入驻场馆",
  "bindtap=\"submitVenueApplication\"",
  "维护我的场馆",
  "bindtap=\"saveVenueMaintenance\"",
  "核销码核销",
  "bindinput=\"onCodeInput\"",
  "bindtap=\"checkinByCode\"",
]);

requireIncludes("miniprogram/pages/game-detail/game-detail.js", [
  "submitPraiseReviews",
  "/api/sports-app/games/",
  "/reviews",
  "reviewablePlayers",
]);

requireIncludes("miniprogram/pages/game-detail/game-detail.wxml", [
  "赛后互评",
  "bindtap=\"submitPraiseReviews\"",
  "detail.reviewOpen",
]);

requireIncludes("scripts/serve-local-mirror.mjs", [
  "/api/sports-app/venue-admin/checkin-code",
  "venueAdminUpdateMatch",
  "venueAdminCheckinOrder",
  "manager_user_id",
  "gameReviewMatch",
  "review_submitted",
]);

if (errors.length > 0) {
  console.error("Mini Program flow contract check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Mini Program flow contract check passed.");
