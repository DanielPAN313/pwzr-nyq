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
  "buildMessageSections",
  "unreadCount",
  "messageSections",
  "retryLoadMessages",
  "goHome",
]);

requireIncludes("miniprogram/pages/messages/messages.wxml", [
  "未读 {{unreadCount}} 条",
  "messageSections",
  "message.actionHint",
  "message.targetText",
  "state-panel",
  "retryLoadMessages",
]);

requireIncludes("miniprogram/pages/home/home.js", [
  "buildStatCards",
  "buildTodoItems",
  "recommendedVenues",
  "recommendedGames",
  "openTarget",
]);

requireIncludes("miniprogram/pages/home/home.wxml", [
  "待处理事项",
  "推荐场馆",
  "推荐球局",
  "statCards",
  "todoItems",
]);

requireIncludes("miniprogram/pages/venues/venues.js", [
  "sportFilters",
  "applyFilters",
  "onSearchInput",
  "changeSport",
  "retryLoadVenues",
  "resetFilters",
]);

requireIncludes("miniprogram/pages/venues/venues.wxml", [
  "搜索场馆、区域或运动",
  "bindinput=\"onSearchInput\"",
  "bindtap=\"changeSport\"",
  "state-panel",
  "retryLoadVenues",
  "resetFilters",
]);

requireIncludes("miniprogram/pages/games/games.js", [
  "sportFilters",
  "applyFilters",
  "onSearchInput",
  "changeSport",
  "retryLoadGames",
  "resetFilters",
]);

requireIncludes("miniprogram/pages/games/games.wxml", [
  "搜索球局或场馆",
  "bindinput=\"onSearchInput\"",
  "bindtap=\"changeSport\"",
  "state-panel",
  "retryLoadGames",
  "resetFilters",
]);

requireIncludes("miniprogram/pages/create-game/create-game.js", [
  "buildFormSummary",
  "buildValidationItems",
  "syncSummary",
  "selectedVenueText",
  "validationItems",
  "retryLoadVenues",
  "wx.redirectTo",
  "/pages/game-detail/game-detail?id=",
]);

requireIncludes("miniprogram/pages/create-game/create-game.wxml", [
  "发布预览",
  "summaryCards",
  "validation-list",
  "validationItems",
  "retryLoadVenues",
  "submitHint",
  "disabled=\"{{!canSubmit}}\"",
]);

requireIncludes("miniprogram/pages/me/me.js", [
  "buildStatCards",
  "buildMenuSections",
  "statCards",
  "menuSections",
]);

requireIncludes("miniprogram/pages/me/me.wxml", [
  "stat-grid",
  "menuSections",
  "entry.hint",
  "openMenu",
]);

requireIncludes("miniprogram/pages/my-games/my-games.js", [
  "buildStatCards",
  "filterGames",
  "buildGameSections",
  "buildNextStep",
  "openGameAction",
  "/pages/game-detail/game-detail?id=",
]);

requireIncludes("miniprogram/pages/my-games/my-games.wxml", [
  "stat-grid",
  "tabs",
  "gameSections",
  "nextStepTitle",
  "openGameAction",
]);

requireIncludes("miniprogram/pages/credit/credit.js", [
  "creditRules",
  "recoveryTips",
  "buildEventSections",
  "buildScoreCards",
  "goOrders",
  "goMyGames",
]);

requireIncludes("miniprogram/pages/credit/credit.wxml", [
  "score-track",
  "scoreCards",
  "下一步建议",
  "信用规则",
  "eventSections",
]);

requireIncludes("miniprogram/pages/orders/orders.js", [
  "highlightedOrderId",
  "wx.pageScrollTo",
  "orderStep",
  "stepTitle",
  "stepText",
  "wx.requestPayment",
  "/prepay",
  "/pay/confirm",
  "openReview",
  "/pages/game-detail/game-detail?id=",
  "/api/sports-app/orders/",
  "retryLoadOrders",
  "goVenues",
]);

requireIncludes("miniprogram/pages/orders/orders.wxml", [
  "step-box",
  "item.stepTitle",
  "item.stepText",
  "item.canReview",
  "bindtap=\"openReview\"",
  "data-game-id",
  "state-panel",
  "retryLoadOrders",
]);

requireIncludes("miniprogram/app.wxss", [
  ".state-panel",
  ".state-actions",
  ".state-title",
  ".state-text",
]);

requireIncludes("miniprogram/pages/venue-detail/venue-detail.js", [
  "/api/sports-app/venues/",
  "/availability?date=",
  "/book",
  "/pages/orders/orders?orderId=",
  "retryLoadAvailability",
  "goVenues",
  "openSlotsText",
  "detailCards",
  "bookingState",
  "canSubmitBooking",
]);

requireIncludes("miniprogram/pages/venue-detail/venue-detail.wxml", [
  "slot-summary-title",
  "{{venue.openSlotsText}}",
  "state-panel",
  "retryLoadAvailability",
  "bindtap=\"bookSelectedSlot\"",
  "生成待支付订单",
  "detail-grid",
  "booking-summary",
  "selectedSlotLabel",
]);

requireIncludes("miniprogram/pages/venue-admin/venue-admin.js", [
  "/api/sports-app/venue-admin/checkin-code",
  "/api/sports-app/venue-admin/orders/",
  "/api/sports-app/venues",
  "/api/sports-app/venue-admin/venues/",
  "Boolean(order.can_checkin)",
  "buildAdminSteps",
  "stepText",
  "submitVenueApplication",
  "saveVenueMaintenance",
  "checkinByCode",
  "wx.pageScrollTo",
]);

requireIncludes("miniprogram/pages/venue-admin/venue-admin.wxml", [
  "adminSteps",
  "section-hint",
  "item.stepText",
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
  "retryLoadDetail",
  "goGames",
  "reviewablePlayers",
  "gameStep",
  "progressPercent",
  "missingText",
]);

requireIncludes("miniprogram/pages/game-detail/game-detail.wxml", [
  "赛后互评",
  "bindtap=\"submitPraiseReviews\"",
  "state-panel",
  "retryLoadDetail",
  "detail.reviewOpen",
  "step-panel",
  "progress-track",
  "detail.missingText",
]);

requireIncludes("miniprogram/utils/auth.js", [
  "ensureLogin",
  "wx.login",
  "requestWechatSession",
  "wechatLoginPath",
]);

requireIncludes("scripts/serve-local-mirror.mjs", [
  "/api/sports-app/auth/wechat-login",
  "resolveWechatOpenid",
  "ensureWechatUser",
  "createMockPrepay",
  "markSportsOrderPaid",
  "/api/sports-app/payment/wechat/notify",
  "/api/sports-app/venue-admin/checkin-code",
  "venueAdminUpdateMatch",
  "venueAdminCheckinOrder",
  "manager_user_id",
  "only the venue owner can check in this order",
  "can_checkin: hasOwnedVenues && serialized.can_checkin",
  "gameReviewMatch",
  "review_submitted",
]);

if (errors.length > 0) {
  console.error("Mini Program flow contract check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Mini Program flow contract check passed.");
