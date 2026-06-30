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

  function ok(callback, payload) {
    if (typeof callback === 'function') callback(payload);
  }

  function fail(callback, error) {
    if (typeof callback === 'function') callback(error);
  }

  function complete(callback, payload) {
    if (typeof callback === 'function') callback(payload);
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
    return normalizePage(url.searchParams.get('page') || url.searchParams.get('path') || 'home');
  }

  function currentPath() {
    var url = new URL(window.location.href);
    var path = String(url.searchParams.get('path') || '').replace(/^\/+/, '');
    return ROUTE_PAGES[path] ? path : viewToPath(url.searchParams.get('page') || currentView());
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

  function routeTo(page, replace) {
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

    showModal: function (options) {
      var opts = options || {};
      var confirmed = window.confirm((opts.title ? opts.title + '\n' : '') + (opts.content || ''));
      var result = { confirm: confirmed, cancel: !confirmed, errMsg: 'showModal:ok' };
      ok(opts.success, result);
      complete(opts.complete, result);
    },

    navigateTo: function (options) {
      routeTo(options && options.url, false);
      ok(options && options.success, { errMsg: 'navigateTo:ok' });
      complete(options && options.complete, { errMsg: 'navigateTo:ok' });
    },

    redirectTo: function (options) {
      routeTo(options && options.url, true);
      ok(options && options.success, { errMsg: 'redirectTo:ok' });
      complete(options && options.complete, { errMsg: 'redirectTo:ok' });
    },

    switchTab: function (options) {
      routeTo(options && options.url, true);
      ok(options && options.success, { errMsg: 'switchTab:ok' });
      complete(options && options.complete, { errMsg: 'switchTab:ok' });
    },

    navigateBack: function () {
      if (pageStack.length > 1) pageStack.pop();
      window.history.back();
    },

    getLaunchOptionsSync: function () {
      return launchOptions();
    },

    getEnterOptionsSync: function () {
      return launchOptions();
    },

    getStorageSync: function (key) {
      try {
        return JSON.parse(window.localStorage.getItem(storageKey(key)) || 'null');
      } catch (error) {
        return '';
      }
    },

    setStorageSync: function (key, data) {
      window.localStorage.setItem(storageKey(key), JSON.stringify(data));
    },

    removeStorageSync: function (key) {
      window.localStorage.removeItem(storageKey(key));
    },

    getSystemInfoSync: function () {
      return {
        platform: 'h5-preview',
        brand: 'browser',
        model: 'MiniProgram Preview',
        windowWidth: 390,
        screenWidth: 390,
        windowHeight: window.innerHeight,
        screenHeight: window.screen && window.screen.height || window.innerHeight,
        safeArea: { top: 0, left: 0, right: 390, bottom: window.innerHeight, width: 390, height: window.innerHeight },
      };
    },

    login: function (options) {
      var result = { code: 'h5-preview-login-code', errMsg: 'login:ok' };
      ok(options && options.success, result);
      complete(options && options.complete, result);
    },
  };

  window.getCurrentPages = function () {
    return pageStack.slice();
  };
})();
