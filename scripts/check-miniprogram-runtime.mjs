import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const miniRoot = path.join(root, "miniprogram");
const bridgeSource = fs.readFileSync(path.join(root, "site", "miniapp-bridge.js"), "utf8");
const appJson = JSON.parse(fs.readFileSync(path.join(miniRoot, "app.json"), "utf8"));
const storage = new Map();
const timers = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeContext(url = "http://localhost:4174/pages/home/home") {
  const location = new URL(url);
  const eventListeners = new Map();
  const history = {
    entries: [],
    pushState(state, _title, nextUrl) {
      this.entries.push({ type: "push", state, nextUrl });
      location.href = new URL(nextUrl, location.href).href;
    },
    replaceState(state, _title, nextUrl) {
      this.entries.push({ type: "replace", state, nextUrl });
      location.href = new URL(nextUrl, location.href).href;
    },
    back() {
      this.entries.push({ type: "back" });
    },
  };
  const document = {
    title: "",
    body: {
      appendChild(node) {
        node.parentNode = this;
      },
      removeChild(node) {
        node.parentNode = null;
      },
    },
    createElement() {
      return {
        className: "",
        textContent: "",
        classList: { add() {} },
        parentNode: null,
      };
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  const window = {
    location,
    history,
    document,
    innerWidth: 390,
    innerHeight: 844,
    pageXOffset: 0,
    pageYOffset: 0,
    localStorage: {
      get length() {
        return storage.size;
      },
      key(index) {
        return Array.from(storage.keys())[index] || null;
      },
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
    navigator: {
      onLine: true,
      vibrate() {
        return true;
      },
      clipboard: {
        async writeText(value) {
          storage.set("clipboard", String(value));
        },
        async readText() {
          return storage.get("clipboard") || "";
        },
      },
    },
    screen: { height: 844 },
    prompt() {
      return "NYQ-PROMPT";
    },
    confirm() {
      return true;
    },
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    addEventListener(type, callback) {
      if (!eventListeners.has(type)) eventListeners.set(type, []);
      eventListeners.get(type).push(callback);
    },
    removeEventListener(type, callback) {
      const callbacks = eventListeners.get(type) || [];
      eventListeners.set(type, callbacks.filter((item) => item !== callback));
    },
    dispatchEvent(event) {
      this.lastEvent = event;
      for (const callback of eventListeners.get(event.type) || []) callback(event);
    },
    scrollTo(options) {
      this.pageXOffset = Number(options?.left || 0);
      this.pageYOffset = Number(options?.top || 0);
      this.lastScrollTo = options;
    },
    async fetch() {
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ ok: true, preview: true });
        },
      };
    },
    PopStateEvent: class PopStateEvent {
      constructor(type, init) {
        this.type = type;
        this.state = init?.state;
      }
    },
    URL,
    URLSearchParams,
    Object,
    Array,
    String,
    Number,
    Date,
    JSON,
    Promise,
    console,
  };
  window.window = window;
  window.globalThis = window;
  return vm.createContext(window);
}

const context = makeContext();
vm.runInContext(bridgeSource, context, { filename: "site/miniapp-bridge.js" });

const registeredPages = [];
const registeredPageByPath = new Map();
const originalPage = context.Page;
context.Page = function pageWithRegistry(definition) {
  const page = originalPage(definition);
  registeredPages.push(page);
  if (page.route) registeredPageByPath.set(page.route, page);
  return page;
};

const moduleCache = new Map();

function resolveModule(request, parentFile) {
  if (request.startsWith(".")) {
    const base = path.resolve(path.dirname(parentFile), request);
    const withJs = base.endsWith(".js") ? base : `${base}.js`;
    return withJs;
  }
  throw new Error(`Unsupported miniprogram module request "${request}" from ${path.relative(root, parentFile)}`);
}

function loadModule(file) {
  const fullPath = path.resolve(file);
  if (moduleCache.has(fullPath)) return moduleCache.get(fullPath).exports;

  const source = fs.readFileSync(fullPath, "utf8");
  const module = { exports: {} };
  moduleCache.set(fullPath, module);

  const localRequire = (request) => loadModule(resolveModule(request, fullPath));
  const wrapped = `(function(require, module, exports, App, Page, Component, getApp, wx) {\n${source}\n})`;
  const script = new vm.Script(wrapped, { filename: path.relative(root, fullPath) });
  const fn = script.runInContext(context);
  fn(localRequire, module, module.exports, context.App, context.Page, context.Component, context.getApp, context.wx);
  return module.exports;
}

loadModule(path.join(miniRoot, "app.js"));
assert(context.getApp().globalData.apiBaseUrl, "miniprogram app.js did not initialize globalData.apiBaseUrl");
assert(Array.isArray(appJson.tabBar?.list) && appJson.tabBar.list[2]?.pagePath === "pages/games/games", "games should occupy the middle tab bar slot.");
context.wx.setStorageSync("nyq_user", { id: 9, username: "venue_admin", role: "venue_admin" });

for (const pagePath of appJson.pages) {
  context.location.href = `http://localhost:4174/${pagePath}`;
  if (pagePath.startsWith("pages/venue/")) {
    context.wx.setStorageSync("nyq_user", { id: 9, username: "venue_admin", role: "venue_admin" });
  }
  const before = registeredPages.length;
  loadModule(path.join(miniRoot, `${pagePath}.js`));
  assert(registeredPages.length === before + 1, `${pagePath}.js did not call Page()`);
  const page = registeredPages[registeredPages.length - 1];
  assert(page.route === pagePath, `${pagePath}.js registered with route ${page.route}`);
  registeredPageByPath.set(pagePath, page);
}

for (const file of fs.readdirSync(path.join(miniRoot, "utils"))) {
  if (file.endsWith(".js")) loadModule(path.join(miniRoot, "utils", file));
}

assert(registeredPages.length === 29, "Mini Program should register the 29-page product flow including the P5 payment callback.");
for (const pagePath of [
  "pages/venue-detail/venue-detail",
  "pages/create-game/create-game",
  "pages/game-detail/game-detail",
  "pages/rankings/rankings",
  "pages/teams/teams",
  "pages/team-detail/team-detail",
  "pages/team-create/team-create",
  "pages/team-games/team-games",
  "pages/player-profile/edit/index",
  "pages/player-profile/reviews/index",
  "pages/venue-admin/venue-admin",
  "pages/venue/home/index",
  "pages/venue/scan/index",
  "pages/venue/create-game/index",
  "pages/venue/team-balance/index",
  "pages/venue/settings/index",
  "pages/payment/callback",
  "pages/credit/credit",
  "pages/my-games/my-games",
  "pages/legal/legal",
]) {
  assert(registeredPageByPath.has(pagePath), `${pagePath} should be restored and registered.`);
}

const homePage = registeredPageByPath.get("pages/home/home");
assert(homePage, "pages/home/home page instance was not registered.");
assert(typeof homePage.switchTab === "function", "pages/home/home should expose switchTab method.");
assert(typeof homePage.openHomeGame === "function", "pages/home/home should expose openHomeGame method.");
assert(typeof homePage.onHeroSwiperChange === "function", "pages/home/home should expose onHeroSwiperChange method.");
assert(typeof homePage.openHeroCard === "function", "pages/home/home should expose openHeroCard method.");
assert(homePage.data.heroIndex === 0, "home swiper hero should default to the booking page.");
assert(homePage.data.bookingHero?.venueName === "卡子门足球场", "home booking swiper should feature Kazi Men football venue.");
assert(homePage.data.gameHero?.slotsText?.includes("缺"), "home game swiper should expose recruiting shortage copy.");
assert(Array.isArray(homePage.data.attendancePreview) && homePage.data.attendancePreview.length >= 3, "home should expose an attendance preview.");
assert(typeof homePage.openAttendanceRanking === "function", "home should expose attendance ranking entry.");
homePage.onHeroSwiperChange.call(homePage, { detail: { current: 1 } });
assert(homePage.data.heroIndex === 1, "home swiper change should update heroIndex.");
homePage.switchTab.call(homePage, {
  currentTarget: {
    dataset: {
      target: "/pages/games/games",
    },
  },
});
assert(context.location.search.includes("page=games"), "home.switchTab did not route to games page.");
assert(context.location.search.includes("path=pages%2Fgames%2Fgames") || context.location.search.includes("path=pages/games/games"), "home.switchTab did not preserve games path.");

function inputEvent(value) {
  return {
    detail: { value },
    currentTarget: { dataset: {} },
  };
}

const venuesPage = registeredPageByPath.get("pages/venues/venues");
assert(venuesPage, "pages/venues/venues page instance was not registered.");
assert(typeof venuesPage.onSearchInput === "function", "pages/venues/venues should expose onSearchInput method.");
assert(typeof venuesPage.clearSearch === "function", "pages/venues/venues should expose clearSearch method.");
assert(typeof venuesPage.openVenueDetail === "function", "pages/venues/venues should expose openVenueDetail method.");
venuesPage.onSearchInput.call(venuesPage, inputEvent("足球"));
assert(venuesPage.data.keyword === "足球", "venues search did not persist the keyword.");
assert(venuesPage.data.venues.length >= 1, "venues search should find the fallback football venue.");
assert(venuesPage.data.venues.every((venue) => `${venue.name} ${venue.area} ${venue.sportsText}`.includes("足球")), "venues search returned a non-matching venue.");
venuesPage.clearSearch.call(venuesPage);
assert(venuesPage.data.keyword === "", "venues clearSearch did not reset the keyword.");
assert(venuesPage.data.venues.length === venuesPage.data.allVenues.length, "venues clearSearch did not restore the full venue list.");

const gamesPage = registeredPageByPath.get("pages/games/games");
assert(gamesPage, "pages/games/games page instance was not registered.");
assert(typeof gamesPage.onSearchInput === "function", "pages/games/games should expose onSearchInput method.");
assert(typeof gamesPage.clearSearch === "function", "pages/games/games should expose clearSearch method.");
assert(typeof gamesPage.openGame === "function", "pages/games/games should expose openGame method.");
assert(typeof gamesPage.openGameDetail === "function", "pages/games/games should expose openGameDetail method.");
assert(typeof gamesPage.createGame === "function", "pages/games/games should expose createGame method.");
assert(typeof gamesPage.goTeams === "function", "pages/games/games should expose goTeams method.");
assert(typeof gamesPage.goMyGames === "function", "pages/games/games should expose goMyGames method.");
assert(typeof gamesPage.goRankings === "function", "pages/games/games should expose goRankings method.");
assert(typeof gamesPage.onShareAppMessage === "function", "pages/games/games should expose onShareAppMessage method.");
assert(typeof gamesPage.copyInvitePath === "function", "pages/games/games should expose copyInvitePath method.");
gamesPage.onSearchInput.call(gamesPage, inputEvent("足球"));
assert(gamesPage.data.keyword === "足球", "games search did not persist the keyword.");
assert(gamesPage.data.games.length >= 1, "games search should find the fallback football match.");
assert(gamesPage.data.games.every((game) => `${game.title} ${game.venueName} ${game.status} ${game.fee}`.includes("足球")), "games search returned a non-matching match.");
gamesPage.clearSearch.call(gamesPage);
assert(gamesPage.data.keyword === "", "games clearSearch did not reset the keyword.");
assert(gamesPage.data.games.length === gamesPage.data.allGames.length, "games clearSearch did not restore the full game list.");

const share = loadModule(path.join(miniRoot, "utils", "share.js"));
assert(Object.keys(share.SHARE_TEMPLATES).length === 3, "share module should expose three invitation templates.");
assert(share.SHARE_TEMPLATES.casual === "今晚 8 点卡子门足球场缺 3 人，AA 50 元/人，一起来踢？", "casual share copy should match the PRD template.");
assert(share.SHARE_TEMPLATES.event === "卡子门周末赛事局，7v7 对抗，已有 10 人报名，速来组队！", "event share copy should match the PRD template.");
assert(share.SHARE_TEMPLATES.default === "我在宁约球组了个局，一起来踢场球？", "default share copy should match the PRD template.");
const eventShare = share.buildSharePayload({ id: 88, matchType: "event" }, 19);
assert(eventShare.title === share.SHARE_TEMPLATES.event, "event games should select the event invitation copy.");
assert(eventShare.path.includes("id=88") && eventShare.path.includes("inviter=19"), "share path should carry game id and inviter.");

const teamsPage = registeredPageByPath.get("pages/teams/teams");
assert(teamsPage, "pages/teams/teams page instance was not registered.");
for (const method of ["loadTeams", "joinTeam", "openHubEntry", "openTeam", "createGame"]) {
  assert(typeof teamsPage[method] === "function", `pages/teams/teams should expose ${method} method.`);
}
assert(Array.isArray(teamsPage.data.teams) && teamsPage.data.teams.length >= 1, "teams page should expose fallback teams.");
assert(Array.isArray(teamsPage.data.hubEntries) && teamsPage.data.hubEntries.length === 3, "teams page should expose join/create/casual entries.");
assert(teamsPage.data.teams.every((team) => team.badgeText && team.homeVenue && team.captainName && Array.isArray(team.tags)), "team cards should expose P2.5 profile fields.");

const teamDetailPage = registeredPageByPath.get("pages/team-detail/team-detail");
assert(teamDetailPage, "pages/team-detail/team-detail page instance was not registered.");
for (const method of ["loadDetail", "joinTeam", "openGames", "openCreateGame", "toggleMemberManagement", "handleApplicant"]) {
  assert(typeof teamDetailPage[method] === "function", `team detail should expose ${method} method.`);
}

const teamCreatePage = registeredPageByPath.get("pages/team-create/team-create");
assert(teamCreatePage, "pages/team-create/team-create page instance was not registered.");
for (const method of ["loadVenues", "chooseBadge", "toggleTrial", "toggleApproval", "submitTeam"]) {
  assert(typeof teamCreatePage[method] === "function", `team create should expose ${method} method.`);
}
assert(Array.isArray(teamCreatePage.data.badgeColors) && teamCreatePage.data.badgeColors.length >= 5, "team create should expose badge presets.");

const teamGamesPage = registeredPageByPath.get("pages/team-games/team-games");
assert(teamGamesPage, "pages/team-games/team-games page instance was not registered.");
for (const method of ["loadGames", "changeFilter", "toggleCreateForm", "submitGame", "signupGame", "toggleGameDetail"]) {
  assert(typeof teamGamesPage[method] === "function", `team games should expose ${method} method.`);
}
assert(teamGamesPage.data.gameTypeOptions.length === 3, "team games should support training, recruiting, and challenge types.");

const teamStats = loadModule(path.join(miniRoot, "utils", "team-stats.js"));
assert(!fs.readFileSync(path.join(miniRoot, "utils", "team-stats.js"), "utf8").includes(".flat("), "team stats should avoid Array.prototype.flat for older Mini Program base libraries.");
const fallbackTeamList = teamStats.getTeams();
assert(fallbackTeamList.length >= 2, "team stats should expose offline fallback teams.");
const fallbackTeamGames = teamStats.getTeamGames(fallbackTeamList[0].id);
const fallbackTeamMembers = teamStats.getTeamMembers(fallbackTeamList[0]);
const fallbackTeamSummary = teamStats.buildTeamStats(fallbackTeamList[0], fallbackTeamMembers, fallbackTeamGames);
assert(fallbackTeamSummary.memberCount >= 1 && fallbackTeamSummary.gameCount >= 1 && fallbackTeamSummary.attendanceRanking.length >= 1, "team stats fallback should support detail metrics.");
const pendingTeam = teamStats.recordLocalJoin(fallbackTeamList[1].id, { id: 99, username: "pending_player" }, true);
assert(pendingTeam.joinPending === true && pendingTeam.joined === false, "team join fallback should preserve pending approval state.");
const testTeamGame = teamStats.saveLocalGame({
  id: "runtime-team-game",
  team_id: fallbackTeamList[0].id,
  type: "recruiting",
  title: "Runtime team game",
  start_time: "2026-08-08 20:00:00",
  capacity: 10,
  signup_count: 2,
  status: "open"
}, "runtime-team-game");
const signedTeamGame = teamStats.signupLocalGame(testTeamGame.id);
assert(signedTeamGame.joined === true && signedTeamGame.signupCount === 3, "team game fallback signup should update joined state and count.");

const playerRating = loadModule(path.join(miniRoot, "utils", "player-rating.js"));
assert(playerRating.ratingDimensions.length === 6, "player rating should expose six football dimensions.");
assert(playerRating.positionOptions.length === 8, "player profile should expose eight selectable positions.");
const runtimeProfile = playerRating.normalizeProfile({
  speed: 50,
  passing: 60,
  defense: 70,
  shooting: 80,
  dribbling: 90,
  stamina: 100,
  positions: ["前锋", "中场"],
});
const newPlayerRating = playerRating.calculateRating(runtimeProfile, []);
assert(newPlayerRating.compositeScore === 75, "new player composite should equal the six-dimension self average.");
const veteranRating = playerRating.calculateRating(runtimeProfile, [{
  starScore: 5,
  time: "2026-07-20 20:00",
  dimensions: { speed: 100, passing: 100, defense: 100, shooting: 100, dribbling: 100, stamina: 100 },
}]);
assert(veteranRating.compositeDimensions[0].value === 80, "veteran score should weight self 40% and recent peer rating 60%.");
context.wx.removeStorageSync(playerRating.PROFILE_EDIT_META_KEY);
context.wx.removeStorageSync(playerRating.PROFILE_STORAGE_KEY);
const firstProfileSave = playerRating.saveLocalProfile(runtimeProfile, Date.UTC(2026, 6, 23, 0, 0, 0));
const initialWindowEdit = playerRating.saveLocalProfile(runtimeProfile, Date.UTC(2026, 6, 23, 1, 0, 0));
const blockedProfileEdit = playerRating.saveLocalProfile(runtimeProfile, Date.UTC(2026, 6, 23, 2, 0, 0));
assert(firstProfileSave.ok && initialWindowEdit.ok, "profile should allow the first save and one edit within 24 hours.");
assert(blockedProfileEdit.ok === false && blockedProfileEdit.policy.mode === "cooldown", "profile should enter the 15-day cooldown after the extra edit.");

const teamBalance = loadModule(path.join(miniRoot, "utils", "team-balance.js"));
const balancePlayers = [
  { id: 1, name: "P1", score: 92, positions: ["门将"] },
  { id: 2, name: "P2", score: 88, positions: ["门将"] },
  { id: 3, name: "P3", score: 82, positions: ["中后卫"] },
  { id: 4, name: "P4", score: 78, positions: ["边后卫"] },
  { id: 5, name: "P5", score: 73, positions: ["中场"] },
  { id: 6, name: "P6", score: 69, positions: ["前腰"] },
  { id: 7, name: "P7", score: 64, positions: ["前锋"] },
  { id: 8, name: "P8", score: 60, positions: ["前锋"] },
  { id: 9, name: "P9", score: 55, positions: ["边锋"] },
  { id: 10, name: "P10", positions: ["前锋"] },
];
const snakeTeams = teamBalance.snakeDistribute(teamBalance.normalizePlayers(balancePlayers).sort((a, b) => b.score - a.score));
assert(snakeTeams.redTeam[0].id === 1 && snakeTeams.blueTeam[0].id === 2 && snakeTeams.blueTeam[1].id === 3 && snakeTeams.redTeam[1].id === 4, "team balance should use the 1 red, 2 blue, 3 blue, 4 red snake order.");
const balancedResult = teamBalance.balanceTeams(balancePlayers, { format: "5v5" });
assert(Math.abs(balancedResult.redTeam.length - balancedResult.blueTeam.length) <= 1, "team balance roster sizes should differ by at most one.");
assert(balancedResult.differencePercent < 15, "team balance score difference should stay below 15 percent for a balanceable roster.");
assert(balancedResult.redTeam.some((player) => player.primaryRole === "goalkeeper") && balancedResult.blueTeam.some((player) => player.primaryRole === "goalkeeper"), "team balance should split available goalkeepers across both teams.");
assert(teamBalance.normalizePlayer({ id: "new-player" }).score === 50, "team balance should default unrated players to score 50.");

const playerProfileEditPage = registeredPageByPath.get("pages/player-profile/edit/index");
assert(playerProfileEditPage, "player profile edit page should be registered.");
for (const method of ["loadProfile", "onDimensionChange", "togglePosition", "drawRadar", "saveProfile"]) {
  assert(typeof playerProfileEditPage[method] === "function", `player profile edit should expose ${method}.`);
}
assert(playerProfileEditPage.data.dimensions.length === 6, "player profile edit should expose six sliders.");
assert(playerProfileEditPage.data.positionItems.length === 8, "player profile edit should expose eight positions.");

const playerProfileReviewsPage = registeredPageByPath.get("pages/player-profile/reviews/index");
assert(playerProfileReviewsPage, "player profile reviews page should be registered.");
for (const method of ["loadReviews", "syncReviews", "drawRadar"]) {
  assert(typeof playerProfileReviewsPage[method] === "function", `player profile reviews should expose ${method}.`);
}
assert(playerProfileReviewsPage.data.reviews.length >= 1, "player profile reviews should expose fallback review records.");

const gameDetailPage = registeredPageByPath.get("pages/game-detail/game-detail");
assert(gameDetailPage, "pages/game-detail/game-detail page instance was not registered.");
assert(typeof gameDetailPage.submitJoinGame === "function", "pages/game-detail/game-detail should expose submitJoinGame method.");
assert(typeof gameDetailPage.onShareAppMessage === "function" && typeof gameDetailPage.copyInvitePath === "function", "game detail should expose share and copy invitation actions.");
gameDetailPage.onLoad.call(gameDetailPage, {
  id: "invite-preview",
  preview: "1",
  title: encodeURIComponent("首页邀请预览"),
  venue: encodeURIComponent("卡子门足球场"),
  desc: encodeURIComponent("今晚 20:00"),
  fee: encodeURIComponent("AA ¥32"),
});
assert(gameDetailPage.data.detail?.previewOnly === true, "game detail should support home invitation preview mode.");
assert(gameDetailPage.data.detail?.joinText === "去球局页报名", "preview game detail should guide users to signup.");
const detailShare = gameDetailPage.onShareAppMessage.call(gameDetailPage, { target: { dataset: { template: "default" } } });
assert(detailShare.title === share.SHARE_TEMPLATES.default && detailShare.path.includes("inviter="), "game detail should return a valid default share payload.");

const ordersPage = registeredPageByPath.get("pages/orders/orders");
assert(ordersPage, "pages/orders/orders page instance was not registered.");
for (const method of ["goVenues", "goGames", "copyCheckinCode", "payOrder", "requestRefund", "cancelOrder", "checkinOrder", "requestMakeup", "openGameReview"]) {
  assert(typeof ordersPage[method] === "function", `pages/orders/orders should expose ${method} method.`);
}
assert(ordersPage.data.orders.every((order) => "canPay" in order && "canCancel" in order && "canCheckin" in order), "orders should expose actionable payment/cancel/checkin flags.");

const orderStatus = loadModule(path.join(miniRoot, "utils", "order-status.js"));
assert(Object.keys(orderStatus.ORDER_STATUS).length === 8, "order status module should expose the eight P5 states.");
assert(orderStatus.normalizeOrderStatus("pending_payment") === "pending_pay", "order status should normalize the legacy pending payment state.");
assert(orderStatus.canTransition("pending_pay", "paid"), "order status should allow pending pay to paid.");
assert(orderStatus.canTransition("pending_verify", "verified"), "order status should allow pending verify to verified.");
const payment = loadModule(path.join(miniRoot, "utils", "payment", "index.js"));
const mockPayment = loadModule(path.join(miniRoot, "utils", "payment", "mock.js"));
const wechatPayment = loadModule(path.join(miniRoot, "utils", "payment", "wechat.js"));
assert(payment.USE_MOCK === true && typeof payment.payOrder === "function", "payment entry should default to the mock adapter.");
assert(typeof mockPayment.mockPay === "function", "mock payment adapter should be loadable.");
assert(typeof wechatPayment.wechatPay === "function", "wechat payment adapter should remain reserved.");
const mockPaymentPromise = mockPayment.mockPay({ id: "runtime-order", amount: 88, venueId: "kazimen", gameId: "runtime-game" }, { delayMs: 0 });
const mockPaymentTimer = timers.pop();
assert(typeof mockPaymentTimer === "function", "mock payment should schedule an asynchronous result.");
mockPaymentTimer();
const mockPaymentResult = await mockPaymentPromise;
assert(mockPaymentResult.success && mockPaymentResult.orderId === "runtime-order" && mockPaymentResult.amount === 88, "mock payment should return the P5 result contract.");
assert("transactionId" in mockPaymentResult && "merchantId" in mockPaymentResult, "mock payment should reserve transaction and merchant fields.");
assert(!fs.readFileSync(path.join(miniRoot, "pages/orders/orders.js"), "utf8").includes("wx.requestPayment"), "pages must not call wx.requestPayment directly.");

const paymentCallbackPage = registeredPageByPath.get("pages/payment/callback");
assert(paymentCallbackPage && typeof paymentCallbackPage.queryOrder === "function", "payment callback page should query the order status.");
assert(typeof paymentCallbackPage.goOrders === "function" && typeof paymentCallbackPage.goHome === "function", "payment callback should expose navigation actions.");

const creditPage = registeredPageByPath.get("pages/credit/credit");
assert(creditPage, "pages/credit/credit page instance was not registered.");
for (const method of ["loadCredit", "goOrders", "goMyGames", "onRatingChange", "applyRatingPreset", "submitSelfRating", "syncRatingState"]) {
  assert(typeof creditPage[method] === "function", `pages/credit/credit should expose ${method} method.`);
}
assert(Array.isArray(creditPage.data.ratingDimensions) && creditPage.data.ratingDimensions.length === 5, "credit page should expose five rating dimensions.");
assert(Array.isArray(creditPage.data.ratingPresets) && creditPage.data.ratingPresets.length === 5, "credit page should expose rating presets.");
assert(Array.isArray(creditPage.data.ratingSummaryCards) && creditPage.data.ratingSummaryCards.length === 3, "credit page should expose summary cards for self-rating.");
creditPage.onRatingChange.call(creditPage, {
  detail: { value: 5 },
  currentTarget: { dataset: { key: "technique" } },
});
assert(creditPage.data.ratingForm.technique === 5, "credit rating slider should update the targeted dimension.");
creditPage.applyRatingPreset.call(creditPage, {
  currentTarget: { dataset: { score: 2 } },
});
assert(creditPage.data.ratingForm.technique === 2 && creditPage.data.ratingForm.attitude === 2, "credit rating preset should apply the same score to all dimensions.");
assert(creditPage.data.ratingDraftAverage === "2.0", "credit rating preset should refresh the preview average.");

const mePage = registeredPageByPath.get("pages/me/me");
assert(mePage, "pages/me/me page instance was not registered.");
assert(Array.isArray(mePage.data.profileStats) && mePage.data.profileStats.length === 3, "me page should expose three profile stats.");
assert(typeof mePage.data.profileTag === "string" && mePage.data.profileTag.length > 0, "me page should expose a profile tag.");
assert(Array.isArray(mePage.data.playerDimensions) && mePage.data.playerDimensions.length === 6, "me page should expose the six-dimension profile summary.");
for (const method of ["loadPlayerProfile", "drawPlayerRadar", "editPlayerProfile", "openPlayerReviews"]) {
  assert(typeof mePage[method] === "function", `me page should expose ${method}.`);
}
for (const target of ["/pages/my-games/my-games", "/pages/credit/credit", "/pages/legal/legal"]) {
  assert(mePage.data.items.some((item) => item.target === target), `me menu should expose ${target}.`);
}
assert(!mePage.data.items.some((item) => item.target.includes("venue")), "player me menu should not expose a venue admin entry.");
assert(mePage.data.venueModeEntry?.target === "/pages/venue/home/index", "venue admins should enter the current venue home.");
assert(mePage.data.items.every((item) => typeof item.hint === "string" && item.hint.length > 0), "me menu items should expose descriptive hints.");

const loginPage = registeredPageByPath.get("pages/login/login");
assert(loginPage, "pages/login/login page instance was not registered.");
for (const method of ["selectRole", "updateField", "submitIdentity", "submitPlayerLogin", "submitVenueLogin"]) {
  assert(typeof loginPage[method] === "function", `pages/login/login should expose ${method} method.`);
}
const loginWxml = fs.readFileSync(path.join(miniRoot, "pages/login/login.wxml"), "utf8");
assert(loginWxml.includes("我是球友") && loginWxml.includes("我是场馆管理员"), "login should present player and venue roles.");
assert(!loginWxml.includes("用户名") && !loginWxml.includes("密码"), "login should not retain the username/password entry.");

context.wx.setStorageSync("nyq_user", { id: 10, username: "player", role: "player" });
context.wx.setStorageSync("nyq_identity", "player");
const auth = loadModule(path.join(miniRoot, "utils/auth.js"));
assert(auth.getStoredIdentity() === "player", "player identity should persist in storage.");
assert(auth.getLandingPath() === "/pages/home/home", "player identity should land on player home.");
context.wx.removeStorageSync("nyq_user");
context.wx.removeStorageSync("nyq_token");
context.wx.removeStorageSync("nyq_identity");
loginPage.setData({ selectedRole: "venue_admin", phone: "13800000000", code: "123456", loading: false, error: "" });
loginPage.submitVenueLogin.call(loginPage);
assert(context.wx.getStorageSync("nyq_identity") === "venue_admin", "verified venue identity should persist in storage.");
assert(context.wx.getStorageSync("nyq_user")?.role === "venue_admin", "verified venue user should receive venue_admin role.");
assert(auth.getLandingPath() === "/pages/venue/home/index", "venue admin identity should land on venue home.");

const pageSources = appJson.pages.map((pagePath) => fs.readFileSync(path.join(miniRoot, `${pagePath}.js`), "utf8"));
assert(pageSources.every((source) => !/\b(?:error|err)\.message\b/.test(source)), "page code must not expose raw technical error messages.");

const rankingsPage = registeredPageByPath.get("pages/rankings/rankings");
assert(rankingsPage, "pages/rankings/rankings page instance was not registered.");
for (const method of ["loadRankings", "changeTab", "goGames"]) {
  assert(typeof rankingsPage[method] === "function", `pages/rankings/rankings should expose ${method} method.`);
}
assert(Array.isArray(rankingsPage.data.tabs) && rankingsPage.data.tabs.length === 1 && rankingsPage.data.tabs[0].key === "attendance", "rankings page should expose attendance only.");
assert(Array.isArray(rankingsPage.data.summaryCards) && rankingsPage.data.summaryCards.length === 4, "rankings page should expose four summary cards.");
assert(Array.isArray(rankingsPage.data.rankRows) && rankingsPage.data.rankRows.length >= 3, "rankings page should expose ranking rows.");
assert(rankingsPage.data.activeTab === "attendance" && rankingsPage.data.rankTitle === "出勤榜", "rankings should default to attendance.");

const messagesPage = registeredPageByPath.get("pages/messages/messages");
assert(messagesPage, "pages/messages/messages page instance was not registered.");
for (const method of ["onTouchStart", "onTouchEnd", "removeMessage", "openMessage", "markReadById"]) {
  assert(typeof messagesPage[method] === "function", `messages page should expose ${method} method.`);
}
assert(messagesPage.data.messages.every((item) => item.icon && item.type), "messages should expose typed message rows.");

const gameDetailForCancel = registeredPageByPath.get("pages/game-detail/game-detail");
assert(gameDetailForCancel && typeof gameDetailForCancel.cancelRegistration === "function", "game detail should expose cancel registration.");

const venueHomePage = registeredPageByPath.get("pages/venue/home/index");
assert(venueHomePage, "pages/venue/home/index page instance was not registered.");
for (const method of ["guardVenueAdmin", "returnPlayerMode", "openScanPage", "openMakeupHandling", "openCreateGame", "openTeamBalance", "openSettings", "editGame", "cancelGame", "processRefund", "onOrderSearchInput", "openConfirmSheet", "closeConfirmSheet", "confirmOrder", "rejectOrder"]) {
  assert(typeof venueHomePage[method] === "function", `pages/venue/home/index should expose ${method} method.`);
}
assert(Array.isArray(venueHomePage.data.stats) && venueHomePage.data.stats.length === 3, "venue home should expose three stats.");
assert(Array.isArray(venueHomePage.data.schedules) && venueHomePage.data.schedules.length >= 3, "venue home should expose today's schedule rows.");
context.wx.setStorageSync("nyq_user", { id: 9, role: "venue_admin" });
assert(venueHomePage.guardVenueAdmin.call(venueHomePage) === true, "venue home should allow venue_admin users.");
venueHomePage.openConfirmSheet.call(venueHomePage);
assert(venueHomePage.data.showConfirmSheet === true, "venue home should open the confirm order sheet.");
venueHomePage.confirmOrder.call(venueHomePage, { currentTarget: { dataset: { id: "o1" } } });
assert(venueHomePage.data.pendingOrders.every((order) => order.id !== "o1"), "venue home confirm action should remove the handled pending order.");
context.wx.setStorageSync("nyq_user", { id: 10, role: "player" });
assert(venueHomePage.guardVenueAdmin.call(venueHomePage) === false, "venue home should reject non venue_admin users.");

const venueScanPage = registeredPageByPath.get("pages/venue/scan/index");
assert(venueScanPage, "pages/venue/scan/index page instance was not registered.");
for (const method of ["guardVenueAdmin", "returnVenueHome", "changeMode", "scanCode", "onCodeInput", "lookupCode", "confirmArrival", "searchMakeups", "confirmMakeup"]) {
  assert(typeof venueScanPage[method] === "function", `pages/venue/scan/index should expose ${method} method.`);
}
context.wx.setStorageSync("nyq_user", { id: 9, role: "venue_admin" });
assert(venueScanPage.guardVenueAdmin.call(venueScanPage) === true, "venue scan should allow venue_admin users.");
context.wx.setStorageSync("nyq_user", { id: 10, role: "player" });
assert(venueScanPage.guardVenueAdmin.call(venueScanPage) === false, "venue scan should reject non venue_admin users.");

const venueCreateGamePage = registeredPageByPath.get("pages/venue/create-game/index");
for (const method of ["loadVenues", "loadGame", "changeType", "changeFormat", "submitGame", "saveGame"]) {
  assert(typeof venueCreateGamePage[method] === "function", `venue create game should expose ${method}.`);
}
assert(venueCreateGamePage.data.gameTypes.length === 2, "venue create game should support casual and event types.");

const venueTeamBalancePage = registeredPageByPath.get("pages/venue/team-balance/index");
for (const method of ["loadPlayers", "applyTeams", "rebalance", "selectPlayer", "swapPlayers", "saveAndNotify"]) {
  assert(typeof venueTeamBalancePage[method] === "function", `venue team balance should expose ${method}.`);
}
venueTeamBalancePage.applyTeams.call(venueTeamBalancePage, balancePlayers);
assert(venueTeamBalancePage.data.redTeam.length === 5 && venueTeamBalancePage.data.blueTeam.length === 5, "venue team balance page should display two complete 5v5 teams.");
assert(venueTeamBalancePage.data.differenceText.endsWith("%"), "venue team balance page should display the score difference percentage.");

const venueSettingsPage = registeredPageByPath.get("pages/venue/settings/index");
for (const method of ["loadSettings", "updatePrice", "updateSlots", "toggleClosed", "saveSettings"]) {
  assert(typeof venueSettingsPage[method] === "function", `venue settings should expose ${method}.`);
}

for (const timer of timers.splice(0)) timer();

console.log(`Mini Program runtime check passed: loaded app.js, ${registeredPages.length} pages, restored product pages, P6 sharing, P5 payment, P4 team balance, and venue flows.`);
