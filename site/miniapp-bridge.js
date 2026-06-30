(function () {
  if (window.wx) return;

  var TAB_PAGES = {
    'pages/home/home': 'home',
    'pages/venues/venues': 'venues',
    'pages/games/games': 'games',
    'pages/messages/messages': 'messages',
    'pages/me/me': 'me',
  };

  var ROUTE_PAGES = Object.assign({}, TAB_PAGES, {
    'pages/orders/orders': 'orders',
    'pages/credit/credit': 'credit',
    'pages/my-games/my-games': 'my-games',
    'pages/create/create': 'create',
    'pages/teams/teams': 'teams',
    'pages/ai/ai': 'ai',
    'pages/data/data': 'data',
    'pages/favorites/favorites': 'favorites',
    'pages/demo/demo': 'demo',
  });

  var VIEW_PAGES = Object.keys(ROUTE_PAGES).reduce(function (acc, path) {
    acc[ROUTE_PAGES[path]] = path;
    return acc;
  }, {});

  var pageStack = [];
  var networkStatusCallbacks = [];
  var tabBarState = {
    visible: true,
    style: {},
    items: Object.keys(TAB_PAGES).map(function (pagePath) {
      return {
        pagePath: pagePath,
        text: TAB_PAGES[pagePath],
        badge: '',
        redDot: false,
      };
    }),
  };

  function ok(callback, payload) {
    if (typeof callback === 'function') callback(payload);
  }

  function fail(callback, error) {
    if (typeof callback === 'function') callback(error);
  }

  function complete(callback, payload) {
    if (typeof callback === 'function') callback(payload);
  }

  function callLifecycle(page, name, arg) {
    if (page && typeof page[name] === 'function') page[name](arg);
  }

  function currentPageInstance() {
    for (var index = pageStack.length - 1; index >= 0; index -= 1) {
      if (pageStack[index] && pageStack[index].__previewType === 'page') return pageStack[index];
    }
    return null;
  }

  function unloadPageInstances(pages) {
    (pages || []).forEach(function (page) {
      callLifecycle(page, 'onUnload');
    });
  }

  function normalizePage(url) {
    var clean = String(url || '').split('?')[0].replace(/^\/+/, '');
    return ROUTE_PAGES[clean] || ROUTE_PAGES[clean.replace(/\.html$/, '')] || clean || 'home';
  }

  function viewToPath(view) {
    return VIEW_PAGES[normalizePage(view)] || 'pages/home/home';
  }

  function queryObject(url) {
    var raw = String(url || '');
    var query = raw.indexOf('?') >= 0 ? raw.slice(raw.indexOf('?') + 1) : '';
    var params = new URLSearchParams(query);
    var out = {};
    params.forEach(function (value, key) {
      out[key] = value;
    });
    return out;
  }

  function currentView() {
    var url = new URL(window.location.href);
    var pathname = url.pathname.replace(/^\/+/, '');
    return normalizePage(url.searchParams.get('page') || url.searchParams.get('path') || pathname || 'home');
  }

  function currentPath() {
    var url = new URL(window.location.href);
    var path = String(url.searchParams.get('path') || '').replace(/^\/+/, '');
    var pathname = url.pathname.replace(/^\/+/, '');
    if (ROUTE_PAGES[path]) return path;
    if (ROUTE_PAGES[pathname]) return pathname;
    return viewToPath(url.searchParams.get('page') || currentView());
  }

  function syncPageStack(target, query, replace) {
    var path = viewToPath(target);
    var page = {
      route: path,
      options: query || {},
      __previewView: normalizePage(target),
    };
    if (replace && pageStack.length) {
      pageStack[pageStack.length - 1] = page;
    } else {
      pageStack.push(page);
      if (pageStack.length > 10) pageStack.shift();
    }
  }

  function routeTo(page, replace, action) {
    var previous = currentPageInstance();
    if (action === 'navigateTo' || action === 'switchTab') callLifecycle(previous, 'onHide');
    if (action === 'redirectTo') callLifecycle(previous, 'onUnload');
    if (action === 'reLaunch') unloadPageInstances(pageStack);

    var target = normalizePage(page);
    var query = queryObject(page);
    var url = new URL(window.location.href);
    url.searchParams.set('page', target);
    url.searchParams.set('path', viewToPath(target));
    Object.keys(query).forEach(function (key) {
      url.searchParams.set(key, query[key]);
    });
    url.hash = '';
    syncPageStack(target, query, replace);
    window.history[replace ? 'replaceState' : 'pushState']({ page: target }, '', url.pathname + url.search);
    window.dispatchEvent(new PopStateEvent('popstate', { state: { page: target } }));
  }

  function launchOptions() {
    var url = new URL(window.location.href);
    var path = currentPath();
    var query = {};
    url.searchParams.forEach(function (value, key) {
      if (key !== 'page' && key !== 'path') query[key] = value;
    });
    return {
      path: path,
      query: query,
      scene: Number(query.scene || 1001),
      shareTicket: query.shareTicket || '',
      referrerInfo: {},
    };
  }

  syncPageStack(currentView(), launchOptions().query, true);

  function storageKey(key) {
    return 'wx_bridge_' + key;
  }

  function readStorageData(key) {
    var raw = window.localStorage.getItem(storageKey(key));
    if (raw == null) return '';
    try {
      return JSON.parse(raw);
    } catch (error) {
      return raw;
    }
  }

  function hasStorageData(key) {
    return window.localStorage.getItem(storageKey(key)) != null;
  }

  function storageInfo() {
    var keys = [];
    var currentSize = 0;
    for (var index = 0; index < window.localStorage.length; index += 1) {
      var key = window.localStorage.key(index);
      if (!key || key.indexOf('wx_bridge_') !== 0) continue;
      keys.push(key.replace(/^wx_bridge_/, ''));
      currentSize += String(window.localStorage.getItem(key) || '').length;
    }
    return {
      keys: keys,
      currentSize: Math.ceil(currentSize / 1024),
      limitSize: 10240,
    };
  }

  function clearBridgeStorage() {
    storageInfo().keys.forEach(function (key) {
      window.localStorage.removeItem(storageKey(key));
    });
  }

  function tabBarItem(index) {
    return tabBarState.items[Math.max(0, Math.min(Number(index) || 0, tabBarState.items.length - 1))];
  }

  function toast(title) {
    var node = document.createElement('div');
    node.className = 'wx-bridge-toast';
    node.textContent = title || '';
    document.body.appendChild(node);
    window.setTimeout(function () {
      node.classList.add('is-leaving');
      window.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 180);
    }, 1600);
  }

  function setPreviewTitle(title) {
    if (window.document) window.document.title = title || 'NYQ Mini Program Preview';
  }

  function bridgeResult(name, extra) {
    return Object.assign({ errMsg: name + ':ok' }, extra || {});
  }

  function readMockScanResult() {
    var url = new URL(window.location.href);
    return url.searchParams.get('scan')
      || window.localStorage.getItem(storageKey('mock_scan_result'))
      || window.prompt('H5 预览扫码模拟，请输入扫码结果', 'NYQ-CHECKIN-DEMO');
  }

  function cloneData(value) {
    if (value == null || typeof value !== 'object') return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return Array.isArray(value) ? value.slice() : Object.assign({}, value);
    }
  }

  function makeMiniProgramInstance(definition, type) {
    var source = definition || {};
    var instance = Object.assign({}, source);
    instance.__previewType = type;
    instance.data = cloneData(source.data || {});
    instance.setData = function (next, callback) {
      instance.data = Object.assign({}, instance.data || {}, next || {});
      if (typeof callback === 'function') callback.call(instance);
    };
    return instance;
  }

  function previewWindowInfo() {
    var height = window.innerHeight || 844;
    return {
      pixelRatio: 2,
      screenWidth: 390,
      screenHeight: window.screen && window.screen.height || height,
      windowWidth: 390,
      windowHeight: height,
      statusBarHeight: 24,
      safeArea: { top: 0, left: 0, right: 390, bottom: height, width: 390, height: height },
      screenTop: 0,
    };
  }

  function previewDeviceInfo() {
    return {
      brand: 'browser',
      model: 'MiniProgram Preview',
      system: 'H5 Preview',
      platform: 'h5-preview',
      deviceOrientation: 'portrait',
    };
  }

  function previewAppBaseInfo() {
    return {
      SDKVersion: 'h5-preview',
      enableDebug: true,
      host: { appId: 'touristappid' },
      language: 'zh_CN',
      version: '0.0.0-h5-preview',
      theme: 'light',
    };
  }

  function previewUserInfo() {
    return {
      nickName: 'NYQ Preview User',
      avatarUrl: 'https://dummyimage.com/128x128/0b6b3e/ffffff&text=NYQ',
      gender: 0,
      country: 'China',
      province: 'Jiangsu',
      city: 'Nanjing',
      language: 'zh_CN',
    };
  }

  function userProfileResult(apiName) {
    var userInfo = previewUserInfo();
    return {
      errMsg: apiName + ':ok',
      userInfo: userInfo,
      rawData: JSON.stringify(userInfo),
      signature: 'h5-preview-signature',
      encryptedData: 'h5-preview-encrypted-data',
      iv: 'h5-preview-iv',
    };
  }

  function previewTempFile(kind) {
    var type = kind || 'image';
    var ext = type === 'video' ? 'mp4' : 'jpg';
    return {
      tempFilePath: 'h5-preview://temp/' + type + '-demo.' + ext,
      size: type === 'video' ? 2048000 : 128000,
      fileType: type,
      duration: type === 'video' ? 12 : 0,
      width: 1080,
      height: 1080,
    };
  }

  function previewLocation() {
    return {
      latitude: 31.9539,
      longitude: 118.8586,
      speed: -1,
      accuracy: 30,
      altitude: 0,
      verticalAccuracy: 0,
      horizontalAccuracy: 30,
      name: '南京高校样板区',
      address: '南京市江宁区',
    };
  }

  function previewNetworkState() {
    var online = !navigator || navigator.onLine !== false;
    return {
      isConnected: online,
      networkType: online ? 'wifi' : 'none',
    };
  }

  function notifyNetworkStatusChange() {
    var result = previewNetworkState();
    networkStatusCallbacks.slice().forEach(function (callback) {
      if (typeof callback === 'function') callback(result);
    });
  }

  function viewportRect() {
    var width = window.innerWidth || 390;
    var height = window.innerHeight || 844;
    return {
      id: '',
      dataset: {},
      left: 0,
      right: width,
      top: 0,
      bottom: height,
      width: width,
      height: height,
    };
  }

  function elementRect(selector) {
    if (!selector || !document.querySelector) return viewportRect();
    var element = document.querySelector(selector);
    if (!element || !element.getBoundingClientRect) return viewportRect();
    var rect = element.getBoundingClientRect();
    return {
      id: element.id || '',
      dataset: Object.assign({}, element.dataset || {}),
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }

  function selectorResult(selector, all, viewport) {
    if (viewport) return viewportRect();
    if (!all) return elementRect(selector);
    if (!document.querySelectorAll) return [];
    return Array.prototype.slice.call(document.querySelectorAll(selector)).map(function (element) {
      if (!element || !element.getBoundingClientRect) return viewportRect();
      var rect = element.getBoundingClientRect();
      return {
        id: element.id || '',
        dataset: Object.assign({}, element.dataset || {}),
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    });
  }

  function makeSelectorQuery() {
    var tasks = [];
    var api = {
      in: function () {
        return api;
      },
      select: function (selector) {
        return makeSelectorNode(selector, false, false);
      },
      selectAll: function (selector) {
        return makeSelectorNode(selector, true, false);
      },
      selectViewport: function () {
        return makeSelectorNode('', false, true);
      },
      exec: function (callback) {
        var results = tasks.map(function (task) {
          return task();
        });
        if (typeof callback === 'function') callback(results);
      },
    };

    function makeSelectorNode(selector, all, viewport) {
      return {
        boundingClientRect: function (callback) {
          tasks.push(function () {
            var result = selectorResult(selector, all, viewport);
            if (typeof callback === 'function') callback(result);
            return result;
          });
          return api;
        },
        scrollOffset: function (callback) {
          tasks.push(function () {
            var result = {
              id: '',
              dataset: {},
              scrollLeft: window.pageXOffset || 0,
              scrollTop: window.pageYOffset || 0,
            };
            if (typeof callback === 'function') callback(result);
            return result;
          });
          return api;
        },
        fields: function (fields, callback) {
          tasks.push(function () {
            var rect = selectorResult(selector, all, viewport);
            var result = Object.assign({}, Array.isArray(rect) ? { nodes: rect } : rect, {
              scrollLeft: window.pageXOffset || 0,
              scrollTop: window.pageYOffset || 0,
            });
            if (typeof callback === 'function') callback(result);
            return result;
          });
          return api;
        },
      };
    }

    return api;
  }

  if (window.addEventListener) {
    window.addEventListener('online', notifyNetworkStatusChange);
    window.addEventListener('offline', notifyNetworkStatusChange);
  }

  window.wx = {
    __isH5MiniProgramBridge: true,

    request: function (options) {
      var opts = options || {};
      var method = opts.method || 'GET';
      var headers = Object.assign({}, opts.header || opts.headers || {});
      var body = opts.data == null || method === 'GET'
        ? undefined
        : (typeof opts.data === 'string' ? opts.data : JSON.stringify(opts.data));
      if (body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

      fetch(opts.url, { method: method, headers: headers, body: body })
        .then(function (response) {
          return response.text().then(function (raw) {
            var data = raw;
            try {
              data = raw ? JSON.parse(raw) : null;
            } catch (error) {}
            return {
              data: data,
              statusCode: response.status,
              header: {},
              errMsg: response.ok ? 'request:ok' : 'request:fail',
            };
          });
        })
        .then(function (result) {
          if (result.statusCode >= 200 && result.statusCode < 300) ok(opts.success, result);
          else fail(opts.fail, result);
          complete(opts.complete, result);
        })
        .catch(function (error) {
          var result = { errMsg: error && error.message ? error.message : 'request:fail' };
          fail(opts.fail, result);
          complete(opts.complete, result);
        });
    },

    showToast: function (options) {
      var opts = typeof options === 'string' ? { title: options } : (options || {});
      toast(opts.title || '');
      ok(opts.success, { errMsg: 'showToast:ok' });
      complete(opts.complete, { errMsg: 'showToast:ok' });
    },

    hideToast: function (options) {
      var result = bridgeResult('hideToast');
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    showLoading: function (options) {
      var opts = options || {};
      toast(opts.title || '加载中');
      ok(opts.success, bridgeResult('showLoading'));
      complete(opts.complete, bridgeResult('showLoading'));
    },

    hideLoading: function (options) {
      var result = bridgeResult('hideLoading');
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    showModal: function (options) {
      var opts = options || {};
      var confirmed = window.confirm((opts.title ? opts.title + '\n' : '') + (opts.content || ''));
      var result = { confirm: confirmed, cancel: !confirmed, errMsg: 'showModal:ok' };
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    showActionSheet: function (options) {
      var opts = options || {};
      var list = Array.isArray(opts.itemList) ? opts.itemList : [];
      var result = { tapIndex: list.length ? 0 : -1, errMsg: 'showActionSheet:ok' };
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    requestSubscribeMessage: function (options) {
      var opts = options || {};
      var tmplIds = Array.isArray(opts.tmplIds) ? opts.tmplIds : [];
      var result = tmplIds.reduce(function (acc, id) {
        acc[id] = 'accept';
        return acc;
      }, { errMsg: 'requestSubscribeMessage:ok' });
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    showShareMenu: function (options) {
      var opts = options || {};
      var result = bridgeResult('showShareMenu', {
        withShareTicket: !!opts.withShareTicket,
        menus: Array.isArray(opts.menus) ? opts.menus : [],
      });
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    hideShareMenu: function (options) {
      var opts = options || {};
      var result = bridgeResult('hideShareMenu');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    updateShareMenu: function (options) {
      var opts = options || {};
      var result = bridgeResult('updateShareMenu', {
        withShareTicket: !!opts.withShareTicket,
        isPrivateMessage: !!opts.isPrivateMessage,
      });
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    getShareInfo: function (options) {
      var opts = options || {};
      var result = bridgeResult('getShareInfo', {
        shareTicket: opts.shareTicket || launchOptions().shareTicket || 'h5-preview-share-ticket',
        encryptedData: 'h5-preview-share-encrypted-data',
        iv: 'h5-preview-share-iv',
        cloudID: 'h5-preview-share-cloud-id',
      });
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    setNavigationBarTitle: function (options) {
      var opts = options || {};
      setPreviewTitle(opts.title);
      var result = bridgeResult('setNavigationBarTitle');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    setNavigationBarColor: function (options) {
      var result = bridgeResult('setNavigationBarColor', {
        frontColor: options && options.frontColor,
        backgroundColor: options && options.backgroundColor,
      });
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    requestPayment: function (options) {
      var opts = options || {};
      var result = bridgeResult('requestPayment', {
        provider: 'wxpay',
        preview: true,
        timeStamp: opts.timeStamp || String(Date.now()),
        nonceStr: opts.nonceStr || 'h5-preview-nonce',
      });
      toast('H5 预览支付成功');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    scanCode: function (options) {
      var opts = options || {};
      var scanResult = readMockScanResult();
      if (!scanResult) {
        var cancelResult = { errMsg: 'scanCode:fail cancel' };
        fail(opts.fail, cancelResult);
        complete(opts.complete, cancelResult);
        return;
      }
      var result = bridgeResult('scanCode', {
        result: scanResult,
        scanType: 'QR_CODE',
        charSet: 'utf-8',
        path: String(scanResult).startsWith('pages/') ? scanResult : '',
      });
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    navigateTo: function (options) {
      routeTo(options && options.url, false, 'navigateTo');
      ok(options && options.success, { errMsg: 'navigateTo:ok' });
      complete(options && options.complete, { errMsg: 'navigateTo:ok' });
    },

    redirectTo: function (options) {
      routeTo(options && options.url, true, 'redirectTo');
      ok(options && options.success, { errMsg: 'redirectTo:ok' });
      complete(options && options.complete, { errMsg: 'redirectTo:ok' });
    },

    switchTab: function (options) {
      routeTo(options && options.url, true, 'switchTab');
      ok(options && options.success, { errMsg: 'switchTab:ok' });
      complete(options && options.complete, { errMsg: 'switchTab:ok' });
    },

    reLaunch: function (options) {
      routeTo(options && options.url, true, 'reLaunch');
      pageStack = pageStack.slice(-1);
      ok(options && options.success, { errMsg: 'reLaunch:ok' });
      complete(options && options.complete, { errMsg: 'reLaunch:ok' });
    },

    navigateBack: function (options) {
      var opts = options || {};
      var delta = Math.max(1, Number(opts.delta || 1));
      var removed = pageStack.splice(Math.max(0, pageStack.length - delta), delta);
      unloadPageInstances(removed);
      callLifecycle(currentPageInstance(), 'onShow');
      window.history.back();
      ok(opts.success, { errMsg: 'navigateBack:ok' });
      complete(opts.complete, { errMsg: 'navigateBack:ok' });
    },

    showTabBar: function (options) {
      tabBarState.visible = true;
      var result = bridgeResult('showTabBar', { animation: !!(options && options.animation) });
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    hideTabBar: function (options) {
      tabBarState.visible = false;
      var result = bridgeResult('hideTabBar', { animation: !!(options && options.animation) });
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    setTabBarBadge: function (options) {
      var opts = options || {};
      tabBarItem(opts.index).badge = String(opts.text == null ? '' : opts.text);
      var result = bridgeResult('setTabBarBadge');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    removeTabBarBadge: function (options) {
      var opts = options || {};
      tabBarItem(opts.index).badge = '';
      var result = bridgeResult('removeTabBarBadge');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    showTabBarRedDot: function (options) {
      var opts = options || {};
      tabBarItem(opts.index).redDot = true;
      var result = bridgeResult('showTabBarRedDot');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    hideTabBarRedDot: function (options) {
      var opts = options || {};
      tabBarItem(opts.index).redDot = false;
      var result = bridgeResult('hideTabBarRedDot');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    setTabBarItem: function (options) {
      var opts = options || {};
      Object.assign(tabBarItem(opts.index), {
        text: opts.text,
        iconPath: opts.iconPath,
        selectedIconPath: opts.selectedIconPath,
      });
      var result = bridgeResult('setTabBarItem');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    setTabBarStyle: function (options) {
      var opts = options || {};
      tabBarState.style = Object.assign({}, tabBarState.style, {
        color: opts.color,
        selectedColor: opts.selectedColor,
        backgroundColor: opts.backgroundColor,
        borderStyle: opts.borderStyle,
      });
      var result = bridgeResult('setTabBarStyle');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    getLaunchOptionsSync: function () {
      return launchOptions();
    },

    getEnterOptionsSync: function () {
      return launchOptions();
    },

    setStorageSync: function (key, data) {
      window.localStorage.setItem(storageKey(key), JSON.stringify(data));
    },

    getStorageSync: function (key) {
      return readStorageData(key);
    },

    removeStorageSync: function (key) {
      window.localStorage.removeItem(storageKey(key));
    },

    clearStorageSync: function () {
      clearBridgeStorage();
    },

    getStorageInfoSync: function () {
      return storageInfo();
    },

    setStorage: function (options) {
      var opts = options || {};
      window.wx.setStorageSync(opts.key, opts.data);
      var result = bridgeResult('setStorage');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    getStorage: function (options) {
      var opts = options || {};
      if (!hasStorageData(opts.key)) {
        var error = { errMsg: 'getStorage:fail data not found' };
        fail(opts.fail, error);
        complete(opts.complete, error);
        return;
      }
      var data = window.wx.getStorageSync(opts.key);
      var result = bridgeResult('getStorage', { data: data });
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    removeStorage: function (options) {
      var opts = options || {};
      window.wx.removeStorageSync(opts.key);
      var result = bridgeResult('removeStorage');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    clearStorage: function (options) {
      var opts = options || {};
      window.wx.clearStorageSync();
      var result = bridgeResult('clearStorage');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    getStorageInfo: function (options) {
      var opts = options || {};
      var result = bridgeResult('getStorageInfo', storageInfo());
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    getSystemInfoSync: function () {
      return Object.assign({
        platform: 'h5-preview',
        brand: 'browser',
        model: 'MiniProgram Preview',
      }, previewWindowInfo(), previewDeviceInfo(), previewAppBaseInfo());
    },

    getWindowInfo: function () {
      return previewWindowInfo();
    },

    getDeviceInfo: function () {
      return previewDeviceInfo();
    },

    getAppBaseInfo: function () {
      return previewAppBaseInfo();
    },

    getNetworkType: function (options) {
      var opts = options || {};
      var result = bridgeResult('getNetworkType', {
        networkType: previewNetworkState().networkType,
      });
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    onNetworkStatusChange: function (callback) {
      if (typeof callback === 'function' && networkStatusCallbacks.indexOf(callback) < 0) {
        networkStatusCallbacks.push(callback);
      }
    },

    offNetworkStatusChange: function (callback) {
      if (!callback) {
        networkStatusCallbacks = [];
        return;
      }
      networkStatusCallbacks = networkStatusCallbacks.filter(function (item) {
        return item !== callback;
      });
    },

    getMenuButtonBoundingClientRect: function () {
      return {
        width: 87,
        height: 32,
        top: 8,
        right: 378,
        bottom: 40,
        left: 291,
      };
    },

    canIUse: function () {
      return true;
    },

    nextTick: function (callback) {
      window.setTimeout(function () {
        if (typeof callback === 'function') callback();
      }, 0);
    },

    startPullDownRefresh: function (options) {
      var opts = options || {};
      callLifecycle(currentPageInstance(), 'onPullDownRefresh');
      var result = bridgeResult('startPullDownRefresh');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    stopPullDownRefresh: function (options) {
      var opts = options || {};
      var result = bridgeResult('stopPullDownRefresh');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    pageScrollTo: function (options) {
      var opts = options || {};
      if (window.scrollTo) {
        window.scrollTo({
          top: Number(opts.scrollTop || 0),
          left: 0,
          behavior: opts.duration === 0 ? 'auto' : 'smooth',
        });
      }
      var result = bridgeResult('pageScrollTo');
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    createSelectorQuery: function () {
      return makeSelectorQuery();
    },

    getAccountInfoSync: function () {
      return {
        miniProgram: {
          appId: 'touristappid',
          envVersion: 'develop',
          version: '0.0.0-h5-preview',
        },
        plugin: {},
      };
    },

    setClipboardData: function (options) {
      var opts = options || {};
      var text = String(opts.data == null ? '' : opts.data);
      var done = function () {
        var result = bridgeResult('setClipboardData');
        ok(opts.success, result);
        complete(opts.complete, result);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function (error) {
          var result = { errMsg: error && error.message ? error.message : 'setClipboardData:fail' };
          fail(opts.fail, result);
          complete(opts.complete, result);
        });
        return;
      }
      window.localStorage.setItem(storageKey('clipboard'), text);
      done();
    },

    getClipboardData: function (options) {
      var opts = options || {};
      var done = function (text) {
        var result = bridgeResult('getClipboardData', { data: text || '' });
        ok(opts.success, result);
        complete(opts.complete, result);
      };
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(done).catch(function () {
          done(window.localStorage.getItem(storageKey('clipboard')) || '');
        });
        return;
      }
      done(window.localStorage.getItem(storageKey('clipboard')) || '');
    },

    chooseImage: function (options) {
      var opts = options || {};
      var count = Math.max(1, Math.min(Number(opts.count || 1), 9));
      var files = Array.from({ length: count }, function () { return previewTempFile('image'); });
      var result = bridgeResult('chooseImage', {
        tempFilePaths: files.map(function (file) { return file.tempFilePath; }),
        tempFiles: files,
      });
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    chooseMedia: function (options) {
      var opts = options || {};
      var mediaType = Array.isArray(opts.mediaType) && opts.mediaType.indexOf('video') >= 0 ? 'video' : 'image';
      var count = Math.max(1, Math.min(Number(opts.count || 1), 9));
      var files = Array.from({ length: count }, function () { return previewTempFile(mediaType); });
      var result = bridgeResult('chooseMedia', { tempFiles: files, type: mediaType });
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    uploadFile: function (options) {
      var opts = options || {};
      var result = bridgeResult('uploadFile', {
        statusCode: 200,
        data: JSON.stringify({
          ok: true,
          preview: true,
          filePath: opts.filePath || '',
          name: opts.name || 'file',
        }),
      });
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    downloadFile: function (options) {
      var opts = options || {};
      var result = bridgeResult('downloadFile', {
        statusCode: 200,
        tempFilePath: opts.url || 'h5-preview://temp/download-demo.bin',
      });
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    previewImage: function (options) {
      var result = bridgeResult('previewImage', {
        current: options && options.current,
        urls: options && options.urls || [],
      });
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    saveImageToPhotosAlbum: function (options) {
      var result = bridgeResult('saveImageToPhotosAlbum', {
        filePath: options && options.filePath || '',
      });
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    getLocation: function (options) {
      var result = bridgeResult('getLocation', previewLocation());
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    chooseLocation: function (options) {
      var result = bridgeResult('chooseLocation', previewLocation());
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    openLocation: function (options) {
      var opts = options || {};
      var result = bridgeResult('openLocation', {
        latitude: opts.latitude || previewLocation().latitude,
        longitude: opts.longitude || previewLocation().longitude,
        name: opts.name || previewLocation().name,
        address: opts.address || previewLocation().address,
      });
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    vibrateShort: function (options) {
      if (navigator.vibrate) navigator.vibrate(15);
      ok(options && options.success, bridgeResult('vibrateShort'));
      complete(options && options.complete, bridgeResult('vibrateShort'));
    },

    vibrateLong: function (options) {
      if (navigator.vibrate) navigator.vibrate(400);
      ok(options && options.success, bridgeResult('vibrateLong'));
      complete(options && options.complete, bridgeResult('vibrateLong'));
    },

    login: function (options) {
      var result = { code: 'h5-preview-login-code', errMsg: 'login:ok' };
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    checkSession: function (options) {
      var result = bridgeResult('checkSession');
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    getUserProfile: function (options) {
      var result = userProfileResult('getUserProfile');
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    getUserInfo: function (options) {
      var result = userProfileResult('getUserInfo');
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    authorize: function (options) {
      var result = bridgeResult('authorize', { scope: options && options.scope || '' });
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    getSetting: function (options) {
      var result = bridgeResult('getSetting', {
        authSetting: {
          'scope.userInfo': true,
          'scope.userLocation': true,
          'scope.writePhotosAlbum': true,
        },
      });
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },

    openSetting: function (options) {
      var result = bridgeResult('openSetting', {
        authSetting: {
          'scope.userInfo': true,
          'scope.userLocation': true,
          'scope.writePhotosAlbum': true,
        },
      });
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },
  };

  window.getCurrentPages = function () {
    return pageStack.slice();
  };

  window.wx.env = {
    USER_DATA_PATH: 'h5-preview://user-data',
  };

  var previewApp = null;
  window.App = function (definition) {
    previewApp = makeMiniProgramInstance(definition, 'app');
    previewApp.globalData = Object.assign({}, definition && definition.globalData || {});
    if (typeof previewApp.onLaunch === 'function') previewApp.onLaunch(launchOptions());
    if (typeof previewApp.onShow === 'function') previewApp.onShow(launchOptions());
    return previewApp;
  };

  window.getApp = function () {
    if (!previewApp) {
      previewApp = { globalData: {}, __previewType: 'app' };
    }
    return previewApp;
  };

  window.Page = function (definition) {
    var page = makeMiniProgramInstance(definition, 'page');
    page.route = currentPath();
    page.options = launchOptions().query;
    if (pageStack.length && pageStack[pageStack.length - 1].__previewType !== 'page') {
      pageStack[pageStack.length - 1] = page;
    } else {
      pageStack.push(page);
    }
    if (pageStack.length > 10) pageStack.shift();
    if (typeof page.onLoad === 'function') page.onLoad(page.options);
    if (typeof page.onShow === 'function') page.onShow();
    if (typeof page.onReady === 'function') window.setTimeout(function () { page.onReady(); }, 0);
    return page;
  };

  window.Component = function (definition) {
    var component = makeMiniProgramInstance(definition, 'component');
    component.properties = Object.assign({}, definition && definition.properties || {});
    component.methods = Object.assign({}, definition && definition.methods || {});
    if (typeof component.created === 'function') component.created();
    if (typeof component.attached === 'function') component.attached();
    if (typeof component.ready === 'function') window.setTimeout(function () { component.ready(); }, 0);
    return component;
  };
})();
