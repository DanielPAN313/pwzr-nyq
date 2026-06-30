import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "site", "miniapp-bridge.js"), "utf8");
const storage = new Map();
const timers = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeContext(url = "http://localhost:4174/pages/games/games?scene=1001&from=smoke&scan=NYQ-SMOKE") {
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
    console,
  };
  window.window = window;
  window.globalThis = window;
  return vm.createContext(window);
}

const context = makeContext();
vm.runInContext(source, context, { filename: "site/miniapp-bridge.js" });

assert(context.wx?.__isH5MiniProgramBridge === true, "wx bridge did not initialize");
assert(typeof context.App === "function", "App shim missing");
assert(typeof context.Page === "function", "Page shim missing");
assert(typeof context.Component === "function", "Component shim missing");
assert(typeof context.getApp === "function", "getApp shim missing");

let launched = false;
let pageHidden = false;
let pagePulled = false;
const app = context.App({
  globalData: { apiBaseUrl: "http://localhost:4174" },
  onLaunch(options) {
    launched = options.path === "pages/games/games" && options.query.from === "smoke";
  },
});
assert(launched, "App onLaunch did not receive launch options");
assert(context.getApp().globalData.apiBaseUrl === app.globalData.apiBaseUrl, "getApp did not return app instance");

const page = context.Page({
  data: { count: 0 },
  onLoad(query) {
    this.loadedFrom = query.from;
  },
  onHide() {
    pageHidden = true;
  },
  onPullDownRefresh() {
    pagePulled = true;
  },
});
page.setData({ count: 2 });
assert(page.loadedFrom === "smoke", "Page onLoad did not receive query");
assert(page.data.count === 2, "Page setData did not merge data");
let pullDownOk = false;
context.wx.startPullDownRefresh({
  success(result) {
    pullDownOk = result.errMsg === "startPullDownRefresh:ok";
  },
});
assert(pullDownOk && pagePulled, "wx.startPullDownRefresh did not trigger Page onPullDownRefresh");
let stopPullOk = false;
context.wx.stopPullDownRefresh({
  success(result) {
    stopPullOk = result.errMsg === "stopPullDownRefresh:ok";
  },
});
assert(stopPullOk, "wx.stopPullDownRefresh mock did not succeed");

let requestSuccess = false;
let requestHeaders = false;
const requestTask = context.wx.request({
  url: "/api/smoke",
  success(result) {
    requestSuccess = result.statusCode === 200 && result.data.preview === true;
  },
});
assert(typeof requestTask.abort === "function", "wx.request should return RequestTask.abort");
assert(typeof requestTask.onHeadersReceived === "function", "wx.request should return RequestTask.onHeadersReceived");
assert(typeof requestTask.offHeadersReceived === "function", "wx.request should return RequestTask.offHeadersReceived");
requestTask.onHeadersReceived((result) => {
  requestHeaders = result.statusCode === 200;
});
await new Promise((resolve) => setTimeout(resolve, 0));
assert(requestSuccess, "wx.request mock did not call success");
assert(requestHeaders, "wx.request RequestTask did not emit headers");

let switched = false;
context.wx.switchTab({
  url: "pages/me/me",
  success(result) {
    switched = result.errMsg === "switchTab:ok";
  },
});
assert(switched, "wx.switchTab success was not called");
assert(context.window.location.search.includes("page=me"), "wx.switchTab did not update preview route");
assert(pageHidden, "wx.switchTab did not trigger Page onHide");

let tabBarHidden = false;
context.wx.hideTabBar({
  animation: true,
  success(result) {
    tabBarHidden = result.errMsg === "hideTabBar:ok" && result.animation === true;
  },
});
assert(tabBarHidden, "wx.hideTabBar mock did not succeed");
let tabBarShown = false;
context.wx.showTabBar({
  success(result) {
    tabBarShown = result.errMsg === "showTabBar:ok";
  },
});
assert(tabBarShown, "wx.showTabBar mock did not succeed");
let tabBadgeOk = false;
context.wx.setTabBarBadge({
  index: 3,
  text: "2",
  success(result) {
    tabBadgeOk = result.errMsg === "setTabBarBadge:ok";
  },
});
assert(tabBadgeOk, "wx.setTabBarBadge mock did not succeed");
let tabDotOk = false;
context.wx.showTabBarRedDot({
  index: 3,
  success(result) {
    tabDotOk = result.errMsg === "showTabBarRedDot:ok";
  },
});
assert(tabDotOk, "wx.showTabBarRedDot mock did not succeed");
let removeBadgeOk = false;
context.wx.removeTabBarBadge({
  index: 3,
  success(result) {
    removeBadgeOk = result.errMsg === "removeTabBarBadge:ok";
  },
});
assert(removeBadgeOk, "wx.removeTabBarBadge mock did not succeed");
let hideDotOk = false;
context.wx.hideTabBarRedDot({
  index: 3,
  success(result) {
    hideDotOk = result.errMsg === "hideTabBarRedDot:ok";
  },
});
assert(hideDotOk, "wx.hideTabBarRedDot mock did not succeed");
let tabItemOk = false;
context.wx.setTabBarItem({
  index: 2,
  text: "Games",
  success(result) {
    tabItemOk = result.errMsg === "setTabBarItem:ok";
  },
});
assert(tabItemOk, "wx.setTabBarItem mock did not succeed");
let tabStyleOk = false;
context.wx.setTabBarStyle({
  backgroundColor: "#ffffff",
  success(result) {
    tabStyleOk = result.errMsg === "setTabBarStyle:ok";
  },
});
assert(tabStyleOk, "wx.setTabBarStyle mock did not succeed");

let scanned = "";
context.wx.scanCode({
  success(result) {
    scanned = result.result;
  },
});
assert(scanned === "NYQ-SMOKE", "wx.scanCode did not read mock scan result");

let relaunched = false;
context.wx.reLaunch({
  url: "pages/games/games?from=relaunch",
  success(result) {
    relaunched = result.errMsg === "reLaunch:ok";
  },
});
assert(relaunched, "wx.reLaunch success was not called");
assert(context.window.location.search.includes("from=relaunch"), "wx.reLaunch did not update preview route");

let redirectedPageUnloaded = false;
context.Page({
  onUnload() {
    redirectedPageUnloaded = true;
  },
});
let redirected = false;
context.wx.redirectTo({
  url: "pages/orders/orders?from=redirect",
  success(result) {
    redirected = result.errMsg === "redirectTo:ok";
  },
});
assert(redirected, "wx.redirectTo success was not called");
assert(redirectedPageUnloaded, "wx.redirectTo did not trigger Page onUnload");

let paid = false;
context.wx.requestPayment({
  success(result) {
    paid = result.preview === true && result.provider === "wxpay";
  },
});
assert(paid, "wx.requestPayment mock did not resolve");

let loadingOk = false;
context.wx.showLoading({
  title: "smoke",
  success(result) {
    loadingOk = result.errMsg === "showLoading:ok";
  },
});
assert(loadingOk, "wx.showLoading mock did not succeed");
let sheetIndex = null;
context.wx.showActionSheet({
  itemList: ["A", "B"],
  success(result) {
    sheetIndex = result.tapIndex;
  },
});
assert(sheetIndex === 0, "wx.showActionSheet should pick first item in preview");
let subscribeAccepted = false;
context.wx.requestSubscribeMessage({
  tmplIds: ["tmpl-demo"],
  success(result) {
    subscribeAccepted = result["tmpl-demo"] === "accept";
  },
});
assert(subscribeAccepted, "wx.requestSubscribeMessage did not accept template");
let shareMenuOk = false;
context.wx.showShareMenu({
  withShareTicket: true,
  menus: ["shareAppMessage"],
  success(result) {
    shareMenuOk = result.errMsg === "showShareMenu:ok" && result.withShareTicket === true;
  },
});
assert(shareMenuOk, "wx.showShareMenu mock did not succeed");
let shareInfoTicket = "";
context.wx.getShareInfo({
  shareTicket: "ticket-demo",
  success(result) {
    shareInfoTicket = result.shareTicket;
  },
});
assert(shareInfoTicket === "ticket-demo", "wx.getShareInfo ticket mismatch");
let updateShareOk = false;
context.wx.updateShareMenu({
  isPrivateMessage: true,
  success(result) {
    updateShareOk = result.errMsg === "updateShareMenu:ok" && result.isPrivateMessage === true;
  },
});
assert(updateShareOk, "wx.updateShareMenu mock did not succeed");
let hideShareOk = false;
context.wx.hideShareMenu({
  success(result) {
    hideShareOk = result.errMsg === "hideShareMenu:ok";
  },
});
assert(hideShareOk, "wx.hideShareMenu mock did not succeed");
let navTitleOk = false;
context.wx.setNavigationBarTitle({
  title: "Smoke",
  success(result) {
    navTitleOk = result.errMsg === "setNavigationBarTitle:ok";
  },
});
assert(navTitleOk && context.document.title === "Smoke", "wx.setNavigationBarTitle did not update document title");

context.wx.setStorageSync("sync-demo", { ok: true });
assert(context.wx.getStorageSync("sync-demo").ok === true, "wx.getStorageSync did not read sync value");
let asyncStorageOk = false;
context.wx.setStorage({
  key: "async-demo",
  data: { count: 3 },
  success(result) {
    asyncStorageOk = result.errMsg === "setStorage:ok";
  },
});
assert(asyncStorageOk, "wx.setStorage mock did not succeed");
let asyncStorageValue = 0;
context.wx.getStorage({
  key: "async-demo",
  success(result) {
    asyncStorageValue = result.data.count;
  },
});
assert(asyncStorageValue === 3, "wx.getStorage did not read async value");
let storageKeys = [];
context.wx.getStorageInfo({
  success(result) {
    storageKeys = result.keys;
  },
});
assert(storageKeys.includes("sync-demo") && storageKeys.includes("async-demo"), "wx.getStorageInfo keys mismatch");
let removedStorage = false;
context.wx.removeStorage({
  key: "async-demo",
  success(result) {
    removedStorage = result.errMsg === "removeStorage:ok";
  },
});
assert(removedStorage && context.wx.getStorageSync("async-demo") === "", "wx.removeStorage did not remove value");
context.wx.clearStorage();
assert(context.wx.getStorageInfoSync().keys.length === 0, "wx.clearStorage did not clear bridge storage");

assert(context.wx.getAccountInfoSync().miniProgram.appId === "touristappid", "wx.getAccountInfoSync appId mismatch");
let loginCode = "";
context.wx.login({
  success(result) {
    loginCode = result.code;
  },
});
assert(loginCode === "h5-preview-login-code", "wx.login did not return preview code");
let sessionOk = false;
context.wx.checkSession({
  success(result) {
    sessionOk = result.errMsg === "checkSession:ok";
  },
});
assert(sessionOk, "wx.checkSession mock did not succeed");
let nickName = "";
context.wx.getUserProfile({
  desc: "smoke",
  success(result) {
    nickName = result.userInfo.nickName;
  },
});
assert(nickName === "NYQ Preview User", "wx.getUserProfile userInfo mismatch");
let settingOk = false;
context.wx.getSetting({
  success(result) {
    settingOk = result.authSetting["scope.userInfo"] === true;
  },
});
assert(settingOk, "wx.getSetting authSetting mismatch");
let imagePath = "";
context.wx.chooseImage({
  count: 1,
  success(result) {
    imagePath = result.tempFilePaths[0];
  },
});
assert(imagePath.startsWith("h5-preview://temp/image-demo"), "wx.chooseImage temp path mismatch");
let mediaType = "";
context.wx.chooseMedia({
  mediaType: ["video"],
  success(result) {
    mediaType = result.type;
  },
});
assert(mediaType === "video", "wx.chooseMedia should return video type");
let uploadOk = false;
let uploadProgress = false;
const uploadTask = context.wx.uploadFile({
  url: "/api/upload",
  filePath: imagePath,
  name: "file",
  success(result) {
    uploadOk = result.statusCode === 200 && JSON.parse(result.data).preview === true;
  },
});
assert(typeof uploadTask.abort === "function", "wx.uploadFile should return UploadTask.abort");
assert(typeof uploadTask.onProgressUpdate === "function", "wx.uploadFile should return UploadTask.onProgressUpdate");
uploadTask.onProgressUpdate((result) => {
  uploadProgress = result.progress === 100;
});
for (const timer of timers.splice(0)) timer();
assert(uploadOk, "wx.uploadFile mock did not return preview result");
assert(uploadProgress, "wx.uploadFile UploadTask did not emit progress");
let downloadPath = "";
let downloadProgress = false;
const downloadTask = context.wx.downloadFile({
  url: "https://example.com/demo.jpg",
  success(result) {
    downloadPath = result.tempFilePath;
  },
});
assert(typeof downloadTask.abort === "function", "wx.downloadFile should return DownloadTask.abort");
assert(typeof downloadTask.onProgressUpdate === "function", "wx.downloadFile should return DownloadTask.onProgressUpdate");
downloadTask.onProgressUpdate((result) => {
  downloadProgress = result.progress === 100;
});
for (const timer of timers.splice(0)) timer();
assert(downloadPath === "https://example.com/demo.jpg", "wx.downloadFile temp path mismatch");
assert(downloadProgress, "wx.downloadFile DownloadTask did not emit progress");
let latitude = 0;
context.wx.getLocation({
  success(result) {
    latitude = result.latitude;
  },
});
assert(latitude > 31 && latitude < 32, "wx.getLocation should return Nanjing preview latitude");
let chosenLocation = "";
context.wx.chooseLocation({
  success(result) {
    chosenLocation = result.name;
  },
});
assert(chosenLocation === "南京高校样板区", "wx.chooseLocation name mismatch");
let openLocationOk = false;
context.wx.openLocation({
  latitude,
  longitude: 118.8586,
  name: "南京高校样板区",
  success(result) {
    openLocationOk = result.errMsg === "openLocation:ok";
  },
});
assert(openLocationOk, "wx.openLocation mock did not succeed");
assert(context.wx.getSystemInfoSync().windowWidth === 390, "wx.getSystemInfoSync should report preview width");
assert(context.wx.getWindowInfo().windowWidth === 390, "wx.getWindowInfo should report preview width");
assert(context.wx.getDeviceInfo().platform === "h5-preview", "wx.getDeviceInfo platform mismatch");
assert(context.wx.getAppBaseInfo().host.appId === "touristappid", "wx.getAppBaseInfo host appId mismatch");
let networkType = "";
context.wx.getNetworkType({
  success(result) {
    networkType = result.networkType;
  },
});
assert(networkType === "wifi", "wx.getNetworkType should report wifi while preview is online");
let networkChanged = "";
const networkHandler = (result) => {
  networkChanged = result.networkType;
};
context.wx.onNetworkStatusChange(networkHandler);
context.navigator.onLine = false;
context.dispatchEvent({ type: "offline" });
assert(networkChanged === "none", "wx.onNetworkStatusChange did not report offline state");
context.wx.offNetworkStatusChange(networkHandler);
context.navigator.onLine = true;
context.dispatchEvent({ type: "online" });
assert(networkChanged === "none", "wx.offNetworkStatusChange did not remove handler");
assert(context.wx.getMenuButtonBoundingClientRect().width > 0, "wx.getMenuButtonBoundingClientRect width missing");
assert(context.wx.canIUse("button.open-type.getUserInfo") === true, "wx.canIUse should return true in preview");
assert(context.wx.env.USER_DATA_PATH === "h5-preview://user-data", "wx.env.USER_DATA_PATH mismatch");
assert(context.getCurrentPages().length > 0, "getCurrentPages should expose preview page stack");

let scrollOk = false;
context.wx.pageScrollTo({
  scrollTop: 120,
  duration: 0,
  success(result) {
    scrollOk = result.errMsg === "pageScrollTo:ok";
  },
});
assert(scrollOk && context.pageYOffset === 120, "wx.pageScrollTo did not update preview scroll position");
let selectorWidth = 0;
let selectorExecLength = 0;
context.wx.createSelectorQuery()
  .selectViewport()
  .boundingClientRect((result) => {
    selectorWidth = result.width;
  })
  .exec((results) => {
    selectorExecLength = results.length;
  });
assert(selectorWidth === 390 && selectorExecLength === 1, "wx.createSelectorQuery viewport result mismatch");

let nextTickCalled = false;
context.wx.nextTick(() => {
  nextTickCalled = true;
});
for (const timer of timers.splice(0)) timer();
assert(nextTickCalled, "wx.nextTick callback was not called");

console.log("H5 Mini Program bridge runtime check passed.");
