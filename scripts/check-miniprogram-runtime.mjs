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
const originalPage = context.Page;
context.Page = function pageWithRegistry(definition) {
  const page = originalPage(definition);
  registeredPages.push(page);
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

for (const pagePath of appJson.pages) {
  context.location.href = `http://localhost:4174/${pagePath}`;
  const before = registeredPages.length;
  loadModule(path.join(miniRoot, `${pagePath}.js`));
  assert(registeredPages.length === before + 1, `${pagePath}.js did not call Page()`);
  const page = registeredPages[registeredPages.length - 1];
  assert(page.route === pagePath, `${pagePath}.js registered with route ${page.route}`);
}

for (const file of fs.readdirSync(path.join(miniRoot, "utils"))) {
  if (file.endsWith(".js")) loadModule(path.join(miniRoot, "utils", file));
}

for (const timer of timers.splice(0)) timer();

console.log(`Mini Program runtime check passed: loaded app.js and ${registeredPages.length} pages.`);
