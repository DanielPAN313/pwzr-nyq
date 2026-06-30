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
    localStorage: {
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
});
page.setData({ count: 2 });
assert(page.loadedFrom === "smoke", "Page onLoad did not receive query");
assert(page.data.count === 2, "Page setData did not merge data");

let switched = false;
context.wx.switchTab({
  url: "pages/me/me",
  success(result) {
    switched = result.errMsg === "switchTab:ok";
  },
});
assert(switched, "wx.switchTab success was not called");
assert(context.window.location.search.includes("page=me"), "wx.switchTab did not update preview route");

let scanned = "";
context.wx.scanCode({
  success(result) {
    scanned = result.result;
  },
});
assert(scanned === "NYQ-SMOKE", "wx.scanCode did not read mock scan result");

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
context.wx.uploadFile({
  url: "/api/upload",
  filePath: imagePath,
  name: "file",
  success(result) {
    uploadOk = result.statusCode === 200 && JSON.parse(result.data).preview === true;
  },
});
assert(uploadOk, "wx.uploadFile mock did not return preview result");
let downloadPath = "";
context.wx.downloadFile({
  url: "https://example.com/demo.jpg",
  success(result) {
    downloadPath = result.tempFilePath;
  },
});
assert(downloadPath === "https://example.com/demo.jpg", "wx.downloadFile temp path mismatch");
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

let nextTickCalled = false;
context.wx.nextTick(() => {
  nextTickCalled = true;
});
for (const timer of timers.splice(0)) timer();
assert(nextTickCalled, "wx.nextTick callback was not called");

console.log("H5 Mini Program bridge runtime check passed.");
