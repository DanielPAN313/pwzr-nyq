(function () {
  var state = {
    mode: 'user',
    userView: 'home',
    venueFilter: 'all',
    sportFilter: 'all',
    venueSort: 'smart',
    venueSearch: '',
    data: {
      venues: [],
      games: [],
      me: null,
      metrics: null,
      orders: [],
      myOrders: [],
      credit: [],
      users: [],
      rating: null,
      ratingRows: [],
      teams: [],
      clips: [],
      uploads: [],
      notifications: [],
    },
    reviewDetail: null,
    playerProfile: null,
    gameDetail: null,
    joinConfirm: null,
    venueBooking: null,
    paymentConfirm: null,
    supportOpen: false,
    supportMessages: [],
    searchOpen: false,
    searchIntent: 'recommend',
    settingsOpen: false,
    profileEditOpen: false,
    profileDemo: loadProfileDemo(),
    friendAddOpen: false,
    mobileMoreOpen: false,
    addedFriends: loadAddedFriends(),
    highlightOrderId: null,
    aiDemoAnalyzed: false,
    toast: '',
    navStack: [],
    mobileTabFromIndex: 0,
    mobileTabTimer: null,
  };

  var app = document.getElementById('app');
  var ROUTABLE_USER_VIEWS = [
    'home',
    'venues',
    'games',
    'messages',
    'me',
    'orders',
    'venue-admin',
    'credit',
    'my-games',
    'legal',
    'create',
    'teams',
    'ai',
    'data',
    'favorites',
    'demo',
  ];
  var ROUTE_PATH_VIEWS = {
    'pages/home/home': 'home',
    'pages/venues/venues': 'venues',
    'pages/games/games': 'games',
    'pages/messages/messages': 'messages',
    'pages/me/me': 'me',
    'pages/orders/orders': 'orders',
    'pages/venue-admin/venue-admin': 'venue-admin',
    'pages/venue-detail/venue-detail': 'venues',
    'pages/create-game/create-game': 'create',
    'pages/game-detail/game-detail': 'games',
    'pages/credit/credit': 'credit',
    'pages/my-games/my-games': 'my-games',
    'pages/legal/legal': 'legal',
    'pages/create/create': 'create',
    'pages/teams/teams': 'teams',
    'pages/ai/ai': 'ai',
    'pages/data/data': 'data',
    'pages/favorites/favorites': 'favorites',
    'pages/demo/demo': 'demo',
  };

  function normalizeRouteView(view) {
    var next = String(view || '').split('?')[0].replace(/^\/+/, '').trim().toLowerCase();
    if (ROUTE_PATH_VIEWS[next]) return ROUTE_PATH_VIEWS[next];
    return ROUTABLE_USER_VIEWS.indexOf(next) >= 0 ? next : 'home';
  }

  function readPreviewRoute() {
    try {
      var url = new URL(window.location.href);
      var fromQuery = url.searchParams.get('page') || url.searchParams.get('view') || url.searchParams.get('path');
      var fromPathname = url.pathname.replace(/^\/+/, '');
      var fromHash = String(url.hash || '').replace(/^#\/?/, '');
      return normalizeRouteView(fromQuery || fromPathname || fromHash || 'home');
    } catch (error) {
      return 'home';
    }
  }

  function routeLabel(view) {
    return {
      home: 'Home',
      venues: 'Venues',
      games: 'Games',
      messages: 'Messages',
      me: 'Me',
      orders: 'Orders',
      'venue-admin': 'Venue Admin',
      credit: 'Credit',
      'my-games': 'My Games',
      legal: 'Legal',
      create: 'Create',
      teams: 'Teams',
      ai: 'AI Clips',
      data: 'Data',
      favorites: 'Favorites',
      demo: 'Demo Flow',
    }[view] || 'Home';
  }

  function syncPreviewRoute(options) {
    if (!window.history || !window.history.replaceState) return;
    try {
      var url = new URL(window.location.href);
      var view = normalizeRouteView(state.userView);
      url.searchParams.set('page', view);
      url.searchParams.delete('view');
      url.hash = '';
      var nextUrl = url.pathname + url.search;
      var currentUrl = window.location.pathname + window.location.search + window.location.hash;
      document.title = 'NYQ Mini Program Preview - ' + routeLabel(view);
      if (nextUrl === currentUrl) return;
      var method = options && options.replace ? 'replaceState' : 'pushState';
      window.history[method]({ page: view }, '', nextUrl);
    } catch (error) {}
  }

  state.userView = readPreviewRoute();

  function session() {
    return window.AnotherMeLocalAuth && window.AnotherMeLocalAuth.getSession
      ? window.AnotherMeLocalAuth.getSession()
      : null;
  }

  function authHeaders() {
    var user = session() || {};
    return {
      'Content-Type': 'application/json',
      'X-User-Id': user.id || 1,
      'X-Username': user.username || user.name || 'demo_player',
    };
  }

  var MOBILE_API_ORIGINS = [
    'http://127.0.0.1:4175',
    'http://192.168.1.9:4175',
    'http://10.0.2.2:4175',
  ];

  function apiUrls(path) {
    var isCapacitorLocalhost = window.location.hostname === 'localhost' && !/:\d+$/.test(window.location.host);
    return isCapacitorLocalhost && String(path || '').indexOf('/api/') === 0
      ? MOBILE_API_ORIGINS.map(function (origin) { return origin + path; })
      : [path];
  }

  async function fetchWithFallback(path, options) {
    var urls = apiUrls(path);
    var lastError = null;
    for (var i = 0; i < urls.length; i += 1) {
      var controller = window.AbortController ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, 2500) : null;
      try {
        return await fetch(urls[i], Object.assign({}, options || {}, controller ? { signal: controller.signal } : {}));
      } catch (error) {
        lastError = error;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    throw lastError || new Error('手机端后端服务暂时无法连接');
  }

  async function api(path, options) {
    var response = await fetchWithFallback(path, Object.assign({
      headers: authHeaders(),
    }, options || {}));
    var data = await response.json().catch(function () { return null; });
    if (!data || typeof data !== 'object') {
      throw new Error('接口没有返回有效数据，请确认手机端后端服务已启动');
    }
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || '请求失败');
    }
    return data;
  }

  function track(eventName, payload) {
    api('/api/sports-app/track', {
      method: 'POST',
      body: JSON.stringify(Object.assign({ event_name: eventName }, payload || {})),
    }).catch(function () {});
  }

  function money(value) {
    return '¥' + Number(value || 0).toFixed(0);
  }

  function fmtDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function dayParts(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return { day: '--', month: '--' };
    return {
      day: String(date.getDate()).padStart(2, '0'),
      month: String(date.getMonth() + 1).padStart(2, '0') + '月',
    };
  }

  function h(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char];
    });
  }

  function loadProfileDemo() {
    try {
      return JSON.parse(window.localStorage.getItem('nyq_profile_demo') || '{}') || {};
    } catch {
      return {};
    }
  }

  function saveProfileDemo(next) {
    state.profileDemo = Object.assign({}, state.profileDemo || {}, next || {});
    window.localStorage.setItem('nyq_profile_demo', JSON.stringify(state.profileDemo));
  }

  function profileDemoValue(key, fallback) {
    var value = state.profileDemo && state.profileDemo[key];
    return value == null || value === '' ? fallback : value;
  }

  function loadAddedFriends() {
    try {
      var parsed = JSON.parse(window.localStorage.getItem('nyq_added_friends') || '[]');
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  function saveAddedFriends(next) {
    state.addedFriends = Array.isArray(next) ? next.map(String) : [];
    window.localStorage.setItem('nyq_added_friends', JSON.stringify(state.addedFriends));
  }

  function friendRecommendations() {
    return [
      {
        id: 'rec-li',
        name: '小李',
        city: '江宁大学城',
        sport: '足球 / 7人制',
        level: '进阶',
        note: '周末常开局，守约率高',
      },
      {
        id: 'rec-zhang',
        name: '阿张',
        city: '仙林校区',
        sport: '篮球 / 3v3',
        level: '稳健',
        note: '偏晚间球局，愿意补位',
      },
      {
        id: 'rec-wang',
        name: '王同学',
        city: '鼓楼',
        sport: '足球 / 门将',
        level: '专业',
        note: '可做门将 / 组织约球',
      },
      {
        id: 'rec-zhou',
        name: '周队长',
        city: '南师附中',
        sport: '篮球 / 5v5',
        level: '活跃',
        note: '经常发局，队伍比较稳定',
      },
    ];
  }

  function sportLabel(value) {
    return value === 'football' ? '足球' : value === 'basketball' ? '篮球' : value;
  }

  function statusLabel(status) {
    return {
      approved: '已合作',
      pending: '待审核',
      rejected: '未通过',
      paid: '已支付',
      pending_payment: '待支付',
      pending_checkin: '待核销',
      checked_in: '已核销',
      open: '报名中',
      forming: '待成局',
      locked: '已锁局',
      review_open: '待互评',
      completed: '已完成',
      active: '活跃',
      queued: '排队中',
      submitted: '已提交',
      refunded: '已退款',
      cancelled: '已取消',
    }[status] || status;
  }

  var ratingDimensions = [
    ['technique', '基础技术', '传停带射基本功'],
    ['physical', '身体素质', '速度、体能、对抗能力'],
    ['tactics', '战术意识', '跑位、配合、大局观'],
    ['defense', '防守能力', '抢断、卡位、补位'],
    ['attitude', '场上态度', '团队配合、遵守规则'],
  ];

  var ratingPresets = [
    ['beginner', '入门', 1],
    ['casual', '业余', 2],
    ['advanced', '进阶', 3],
    ['expert', '高手', 4],
    ['master', '大神', 5],
  ];

  function score(value, fallback) {
    var next = Number(value == null ? fallback : value);
    if (Number.isNaN(next)) next = fallback || 3;
    return Math.max(1, Math.min(5, next));
  }

  function oneDecimal(value, fallback) {
    return score(value, fallback).toFixed(1);
  }

  function ratingLabel(scoreValue) {
    var value = Number(scoreValue || 0);
    if (value >= 4.6) return '大神';
    if (value >= 4.0) return '高手';
    if (value >= 3.0) return '进阶';
    if (value >= 2.0) return '业余';
    return '入门';
  }

  function ratingSummary() {
    return state.data.rating || {
      composite_score: 3,
      level_label: '进阶',
      self_score: 3,
      peer_score: null,
      effective_peer_games: 0,
      peer_rating_count: 0,
    };
  }

  function creditScore() {
    return Number((state.data.me || {}).credit_score || 100);
  }

  function publicJoinLocked() {
    return creditScore() < 80;
  }

  function actionLocked() {
    return creditScore() < 60;
  }

  function creditLocked() {
    return actionLocked();
  }
  function orderStatusClass(status) {
    if (status === 'checked_in' || status === 'completed') return '';
    if (status === 'pending_payment' || status === 'pending_checkin' || status === 'open' || status === 'forming') return 'orange';
    if (status === 'cancelled' || status === 'refunded') return 'gray';
    return 'blue';
  }

  function orderNextAction(order) {
    var isGame = Boolean(order.game_id);
    var startText = fmtDate(order.start_time || order.booking_start_time || order.create_time);
    return {
      pending_payment: {
        title: '下一步：完成支付',
        body: '支付成功后，' + (isGame ? '球局才会正式占位并展示在球局名单里。' : '场地才会正式保留。') + '未支付订单可随时取消。',
      },
      paid: {
        title: '下一步：到场核销',
        body: '请在 ' + startText + ' 到场，开场/预订前 30 分钟开放核销码。开赛/预订前 1 小时内不支持自助退款。',
      },
      checked_in: {
        title: isGame ? '下一步：赛后互评' : '订单已完成',
        body: isGame ? '比赛结束后 24 小时内完成互评，信用和实力记录会更新。' : '场地已完成核销，可在订单记录里留存凭证。',
      },
      refunded: {
        title: '订单已退款',
        body: '该订单已关闭，不会占用名额或场地时段。',
      },
      cancelled: {
        title: '订单已取消',
        body: '该订单未生效，不会占用名额或场地时段。',
      },
    }[order.status] || {
      title: '等待处理',
      body: '订单状态已更新，请留意消息中心通知。',
    };
  }
  function orderTimeline(order) {
    if (order.status === 'cancelled' || order.status === 'refunded') {
      return '<div class="order-timeline is-closed"><span class="is-done"><i></i>下单</span><span class="is-done"><i></i>' + statusLabel(order.status) + '</span><span><i></i>释放名额</span><span><i></i>关闭</span></div>';
    }
    var steps = [
      ['pending_payment', '下单'],
      ['paid', '支付'],
      ['checked_in', '核销'],
      [order.game_id ? 'review_open' : 'completed', order.game_id ? '互评' : '完成'],
    ];
    var activeIndex = order.status === 'cancelled' || order.status === 'refunded'
      ? 1
      : order.status === 'checked_in'
        ? 2
        : order.status === 'paid'
          ? 1
          : 0;
    return '<div class="order-timeline">' + steps.map(function (step, index) {
      return '<span class="' + (index <= activeIndex ? 'is-done' : '') + '"><i></i>' + h(step[1]) + '</span>';
    }).join('') + '</div>';
  }

  function exceptionHint(order) {
    if (order.status === 'pending_payment') return '待支付订单不会占位太久，建议尽快支付或取消。';
    if (order.status === 'paid') return '开局/预订前 24 小时内取消扣 5 分，前 1 小时内取消扣 20 分。';
    if (order.status === 'checked_in' && order.game_id) return '互评入口只在比赛结束后 24 小时内开放。';
    return '';
  }

  function guideSeen() {
    return window.localStorage.getItem('nyq_rating_guide_seen') === '1';
  }

  function initials(name) {
    return String(name || '球员').slice(0, 1).toUpperCase();
  }

  function parseTrend(value) {
    try {
      var parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value;
      return Array.isArray(parsed) ? parsed.slice(-10) : [];
    } catch {
      return [];
    }
  }

  function starSlider(name, value, prefix) {
    var inputName = prefix ? prefix + '-' + name : name;
    var current = Math.round(score(value, 3));
    return [
      '<label class="rating-dimension">',
      '  <span><strong>' + h((ratingDimensions.find(function (item) { return item[0] === name; }) || [name, name])[1]) + '</strong><em>' + h((ratingDimensions.find(function (item) { return item[0] === name; }) || [name, name, ''])[2]) + '</em></span>',
      '  <div class="star-slider">',
      '    <input type="range" min="1" max="5" step="1" name="' + h(inputName) + '" value="' + h(current) + '" data-rating-range data-rating-dimension="' + h(name) + '" />',
      '    <div class="stars" aria-hidden="true">' + [1, 2, 3, 4, 5].map(function (item) { return '<span class="' + (item <= current ? 'is-on' : '') + '">★</span>'; }).join('') + '</div>',
      '    <strong data-rating-value="' + h(inputName) + '">' + h(current) + '</strong>',
      '  </div>',
      '</label>',
    ].join('');
  }

  function ratingBadge(summary, userId) {
    var label = summary && summary.level_label ? summary.level_label : ratingLabel(summary && summary.composite_score);
    var value = oneDecimal(summary && summary.composite_score, 3);
    var attrs = userId ? ' data-player-profile="' + h(userId) + '"' : '';
    return '<button class="rating-badge" type="button"' + attrs + '><span>' + h(label) + '</span><strong>' + value + '分</strong></button>';
  }

  function showToast(message) {
    state.toast = message;
    render();
    setTimeout(function () {
      if (state.toast === message) {
        state.toast = '';
        render();
      }
    }, 2600);
  }

  function showInlineToast(message) {
    var existing = app.querySelector('.toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    app.appendChild(toast);
    window.setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 1800);
  }

  async function loadBootstrap() {
    var data = await api('/api/sports-app/bootstrap');
    state.data.venues = data.venues || [];
    state.data.games = data.games || [];
    state.data.me = data.summary || data.me || null;
    state.data.rating = data.rating || null;
    state.data.metrics = data.metrics || null;
    state.data.myOrders = data.orders || [];
    state.data.credit = data.credit || [];
    state.data.teams = data.teams || [];
    state.data.clips = data.clips || [];
    state.data.uploads = data.uploads || [];
    state.data.notifications = data.notifications || [];
  }

  async function loadOrders() {
    state.data.orders = await api('/api/sports-app/orders');
  }

  async function loadUsers() {
    state.data.users = await api('/api/sports-app/admin/users');
  }

  async function loadRatings() {
    state.data.ratingRows = await api('/api/sports-app/admin/ratings');
  }

  async function refreshModeData() {
    await loadBootstrap();
    if (state.mode === 'venue') await loadOrders();
    if (state.mode === 'admin') {
      await loadUsers();
      await loadRatings();
    }
  }

  function topbar() {
    var user = session();
    var username = user ? user.username || user.name : '未登录';
    var canGoBack = canNavigateBack();
    return [
      '<header class="topbar">',
      '  <div class="topbar-left">',
      '    <button type="button" class="topbar-back-icon' + (canGoBack ? '' : ' is-hidden') + '" data-nav-back aria-label="返回上一级"' + (canGoBack ? '' : ' disabled') + '><span></span></button>',
      '    <div class="brand">',
      '      <div class="brand-mark">NYQ</div>',
      '      <div><h1>宁约球</h1><p>南京高校/园区约局 + 场馆预订</p></div>',
      '    </div>',
      '  </div>',
      '  <nav class="appbar-nav" aria-label="应用导航">',
      '    <button type="button" data-user-view="home" class="' + (state.userView === 'home' ? 'is-active' : '') + '">首页</button>',
      '    <button type="button" data-user-view="venues" class="' + (state.userView === 'venues' ? 'is-active' : '') + '">订场</button>',
      '    <button type="button" data-user-view="games" class="' + (state.userView === 'games' ? 'is-active' : '') + '">球局</button>',
      '    <button type="button" data-user-view="teams" class="' + (state.userView === 'teams' ? 'is-active' : '') + '">球队</button>',
      '    <button type="button" data-user-view="messages" class="' + (state.userView === 'messages' ? 'is-active' : '') + '">消息</button>',
      '    <button type="button" data-user-view="me" class="' + (state.userView === 'me' ? 'is-active' : '') + '">我的</button>',
      '  </nav>',
      '  <div class="topbar-actions">',
      '    <button type="button" class="appbar-quick appbar-search" data-focus-search aria-label="搜索场馆和球局"><span></span><em>搜索</em></button>',
      '    <button type="button" class="appbar-create" data-user-view="create">发起组局</button>',
      '    <button type="button" class="session-chip" data-user-view="me" aria-label="进入个人中心">',
      '      <span class="session-avatar">' + h(initials(username)) + '</span>',
      '      <span class="session-copy"><strong>' + h(username) + '</strong><em>player / signed in</em></span>',
      '    </button>',
      '    <button type="button" class="appbar-add-user" data-open-friend-add aria-label="添加球友"><span></span></button>',
      '  </div>',
      '</header>',
    ].join('');
  }

  function returnHomeFab() {
    return '';
  }

  function tabButton(mode, label) {
    return '<button type="button" data-mode="' + mode + '" class="' + (state.mode === mode ? 'is-active' : '') + '">' + label + '</button>';
  }

  function metric(label, value) {
    return '<div class="metric"><span>' + h(label) + '</span><strong>' + h(value) + '</strong></div>';
  }

  function empty3d(text, tone) {
    return [
      '<div class="empty empty-3d empty-3d-' + h(tone || 'field') + '">',
      '  <div class="nyq-empty-3d" aria-hidden="true"><span></span><i></i><em></em></div>',
      '  <p>' + h(text) + '</p>',
      '</div>',
    ].join('');
  }

  function modalTitle(title, closeAttr) {
    return [
      '<div class="panel-title modal-title">',
      '  <h3>' + h(title) + '</h3>',
      '  <div class="modal-title-actions">',
      '    <button class="secondary-btn" type="button" data-return-home>回主页</button>',
      '    <button class="secondary-btn" type="button" ' + closeAttr + '>关闭</button>',
      '  </div>',
      '</div>',
    ].join('');
  }

  function profileBackTitle(title, subtitle) {
    return [
      '<div class="panel-title profile-back-title">',
      '  <div><h3>' + h(title) + '</h3><span>' + h(subtitle || '') + '</span></div>',
      '  <button class="secondary-btn small-btn profile-inline-back" type="button" data-nav-back>‹ 返回</button>',
      '</div>',
    ].join('');
  }

  function clearOverlays() {
    state.reviewDetail = null;
    state.playerProfile = null;
    state.gameDetail = null;
    state.joinConfirm = null;
    state.venueBooking = null;
    state.paymentConfirm = null;
    state.supportOpen = false;
    state.searchOpen = false;
    state.settingsOpen = false;
    state.profileEditOpen = false;
    state.friendAddOpen = false;
    state.mobileMoreOpen = false;
  }

  function currentNavSnapshot() {
    return {
      mode: state.mode,
      userView: state.userView,
      venueFilter: state.venueFilter,
      sportFilter: state.sportFilter,
      venueSearch: state.venueSearch,
    };
  }

  function sameNavSnapshot(a, b) {
    return a && b
      && a.mode === b.mode
      && a.userView === b.userView
      && a.venueFilter === b.venueFilter
      && a.sportFilter === b.sportFilter
      && a.venueSearch === b.venueSearch;
  }

  function hasOpenOverlay() {
    return Boolean(
      state.reviewDetail
      || state.playerProfile
      || state.gameDetail
      || state.joinConfirm
      || state.venueBooking
      || state.paymentConfirm
      || state.supportOpen
      || state.searchOpen
      || state.settingsOpen
      || state.profileEditOpen
      || state.friendAddOpen
      || state.mobileMoreOpen
    );
  }

  function canNavigateBack() {
    return hasOpenOverlay() || state.navStack.length > 0 || state.userView !== 'home';
  }

  function pushNavSnapshot(snapshot) {
    var previous = snapshot || currentNavSnapshot();
    var last = state.navStack[state.navStack.length - 1];
    if (!sameNavSnapshot(last, previous)) state.navStack.push(previous);
    if (state.navStack.length > 20) state.navStack.shift();
  }

  function mobileTabIndex(view) {
    return ['home', 'venues', 'games', 'messages', 'me'].indexOf(view);
  }

  function rememberMobileTabMove(nextView) {
    var fromIndex = mobileTabIndex(state.userView);
    var toIndex = mobileTabIndex(nextView);
    if (toIndex >= 0) state.mobileTabFromIndex = fromIndex >= 0 ? fromIndex : toIndex;
  }

  function previewMobileTabMove(tabbar, targetView) {
    var nextIndex = mobileTabIndex(targetView);
    var fromIndex = mobileTabIndex(state.userView);
    if (!tabbar || nextIndex < 0 || fromIndex < 0 || nextIndex === fromIndex) return false;
    if (state.mobileTabTimer) clearTimeout(state.mobileTabTimer);
    tabbar.classList.remove('is-tab-moving');
    tabbar.style.setProperty('--tab-from-index', String(fromIndex));
    tabbar.style.setProperty('--tab-index', String(fromIndex));
    tabbar.querySelectorAll('button').forEach(function (tabButton) {
      var isTarget = tabButton.getAttribute('data-user-view') === targetView;
      tabButton.classList.toggle('is-active', isTarget);
      tabButton.disabled = true;
    });
    requestAnimationFrame(function () {
      tabbar.classList.add('is-tab-moving');
      tabbar.style.setProperty('--tab-index', String(nextIndex));
    });
    state.mobileTabFromIndex = fromIndex;
    state.mobileTabTimer = setTimeout(function () {
      state.mobileTabTimer = null;
      state.mobileTabFromIndex = nextIndex;
      goToUserView(targetView, { replace: true, skipTabMove: true });
      render();
    }, 420);
    return true;
  }

  function goToUserView(view, options) {
    var nextView = normalizeRouteView(view || 'home');
    var shouldRemember = !(options && options.replace);
    var before = currentNavSnapshot();
    if (shouldRemember && before.userView !== nextView) pushNavSnapshot(before);
    if (!(options && options.skipTabMove)) rememberMobileTabMove(nextView);
    state.mode = 'user';
    state.userView = nextView;
    clearOverlays();
    if (nextView === 'home') {
      state.navStack = [];
      track('home_view');
    }
    if (nextView === 'venues') track('venue_list_view');
    if (nextView === 'games') track('game_list_view');
    syncPreviewRoute({ replace: options && options.replaceUrl });
  }

  function searchTargetView(keyword) {
    var text = String(keyword || '').trim();
    if (state.searchIntent === 'book') return 'venues';
    if (state.searchIntent === 'play') return 'games';
    if (!text) return 'home';
    return /球局|组局|发局|约球|报名|缺人|待加入|开打|队友|比赛/.test(text) ? 'games' : 'venues';
  }

  function searchOverlay() {
    if (!state.searchOpen) return '';
    return [
      '<div class="search-backdrop" data-close-search>',
      '  <section class="search-shell" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      '    <div class="search-shell-head">',
      '      <div><span>Search</span><h3>找场地，也找今晚的局</h3></div>',
      '      <button type="button" data-close-search>关闭</button>',
      '    </div>',
      '    <form class="search-shell-form" data-venue-search-form>',
      '      <span class="mega-search-icon" aria-hidden="true"></span>',
      '      <input class="search-box" name="venue_search" value="' + h(state.venueSearch || '') + '" placeholder="' + h(searchPlaceholder()) + '" autocomplete="off" data-search-autofocus />',
      '      <button class="primary-btn" type="submit">搜索</button>',
      '    </form>',
      '    <div class="search-intent-tabs" role="group" aria-label="搜索类型">',
      searchIntentButton('recommend', '推荐'),
      searchIntentButton('book', '订场'),
      searchIntentButton('play', '组局'),
      '    </div>',
      '    <div class="search-quick-grid">',
      searchQuickCards(),
      '    </div>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function searchIntentButton(intent, label) {
    return '<button type="button" data-search-intent="' + h(intent) + '" class="' + (state.searchIntent === intent ? 'is-active' : '') + '">' + h(label) + '</button>';
  }

  function searchPlaceholder() {
    if (state.searchIntent === 'book') return '搜场馆、区域、时段';
    if (state.searchIntent === 'play') return '搜球局、项目、缺人关键词';
    return '搜足球、篮球、大学城、缺人球局';
  }

  function searchQuickCard(keyword, target, label) {
    return '<button type="button" data-search-keyword="' + h(keyword) + '" data-search-target="' + h(target) + '"><strong>' + h(keyword) + '</strong><span>' + h(label) + '</span></button>';
  }

  function searchQuickCards() {
    var cards = {
      recommend: [
        ['足球', 'games', '今晚足球局'],
        ['篮球', 'games', '缺人篮球局'],
        ['大学城', 'venues', '大学城场馆'],
        ['黄金时段', 'venues', '晚间可订'],
      ],
      book: [
        ['大学城', 'venues', '附近可订'],
        ['黄金时段', 'venues', '晚间可订'],
        ['室内场', 'venues', '天气友好'],
        ['足球场', 'venues', '按项目筛选'],
      ],
      play: [
        ['缺人球局', 'games', '马上加入'],
        ['足球', 'games', '今晚开踢'],
        ['篮球', 'games', '找队友'],
        ['实力匹配', 'games', '更合适的局'],
      ],
    }[state.searchIntent] || [];
    return cards.map(function (item) {
      return searchQuickCard(item[0], item[1], item[2]);
    }).join('');
  }

  function refreshSearchOverlay() {
    var input = app.querySelector('.search-shell input[name="venue_search"]');
    if (input) input.setAttribute('placeholder', searchPlaceholder());
    app.querySelectorAll('[data-search-intent]').forEach(function (button) {
      button.classList.toggle('is-active', button.getAttribute('data-search-intent') === state.searchIntent);
    });
    var quickGrid = app.querySelector('.search-quick-grid');
    if (quickGrid) quickGrid.innerHTML = searchQuickCards();
    bindSearchQuickCards();
  }

  function bindSearchQuickCards() {
    app.querySelectorAll('[data-search-keyword]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.venueSearch = button.getAttribute('data-search-keyword') || '';
        state.searchOpen = false;
        goToUserView(button.getAttribute('data-search-target') || searchTargetView(state.venueSearch));
        track('venue_search_quick', { metadata: { keyword: state.venueSearch } });
        render();
      });
    });
  }

  function navigateBack() {
    if (hasOpenOverlay()) {
      clearOverlays();
      render();
      return;
    }
    var previous = state.navStack.pop();
    if (previous) {
      rememberMobileTabMove(previous.userView || 'home');
      state.mode = previous.mode || 'user';
      state.userView = previous.userView || 'home';
      state.venueFilter = previous.venueFilter || 'all';
      state.sportFilter = previous.sportFilter || 'all';
      state.venueSearch = previous.venueSearch || '';
    } else {
      rememberMobileTabMove('home');
      state.mode = 'user';
      state.userView = 'home';
      state.venueSearch = '';
    }
    clearOverlays();
    syncPreviewRoute({ replace: true });
    render();
  }

  function hero() {
    var metrics = state.data.metrics || {};
    var me = state.data.me || {};
    var rating = ratingSummary();
    var approved = state.data.venues.filter(function (venue) { return venue.status === 'approved'; });
    var hotVenue = approved[0] || {};
    var nextGames = (state.data.games || []).slice(0, 3);
    var featuredVenues = approved.slice(0, 3);
    var games = state.data.games || [];
    var availableGames = games.filter(function (game) {
      return ['forming', 'open'].includes(game.status);
    }).length;
    var hotVenues = approved.length;
    var waitingPlayers = games.reduce(function (sum, game) {
      return sum + Math.max(0, Number(game.capacity || 0) - Number(game.joined_count || 0));
    }, 0);
    return [
      '<section class="miniapp-home">',
      '  <section class="glass-hero">',
      '    <div class="nyq-field-core" aria-hidden="true"><span></span><i></i><em></em></div>',
      '    <div class="glass-hero-copy">',
      '      <span class="glass-kicker">NYQ FIELD OS</span>',
      '      <h2>今晚去哪打</h2>',
      '      <p>先看可订场，再看缺人局。</p>',
      '      <div class="nyq-signal-strip"><span>江宁样板区</span><span>AA 支付</span><span>到场核销</span></div>',
      '      <div class="glass-hero-actions"><button class="primary-btn" type="button" data-jump-view="games">查看球局</button><button class="secondary-btn" type="button" data-jump-view="venues">扫描场馆</button></div>',
      '      <div class="glass-hero-stats">',
      '        <button class="glass-stat" type="button" data-jump-view="games" aria-label="查看今日可约球局"><strong>' + h(availableGames) + '</strong><span>今日可约</span></button>',
      '        <button class="glass-stat" type="button" data-jump-view="venues" aria-label="查看热门场馆"><strong>' + h(hotVenues) + '</strong><span>热门场馆</span></button>',
      '        <button class="glass-stat" type="button" data-jump-view="games" aria-label="查看待加入球局"><strong>' + h(waitingPlayers) + '</strong><span>待加入</span></button>',
      '      </div>',
      '    </div>',
      '    <button class="glass-hero-visual" type="button" data-book-venue="' + h(hotVenue.id || '') + '">',
      '      <img src="' + h(hotVenue.cover_url || 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1600&q=80') + '" alt="' + h(hotVenue.name || '南京合作场馆') + '" />',
      '      <div class="nyq-radar" aria-hidden="true"><span></span><i></i><em></em></div>',
      '      <div class="glass-hero-overlay">',
      '        <span>' + h(hotVenue.name || '南京合作场馆') + '</span>',
      '        <strong>FIELD ' + h(hotVenue.id || '01') + ' / ' + h(availableGames) + ' 场可约</strong>',
      '        <small>' + h(waitingPlayers) + ' 人待加入 · 点击订场</small>',
      '      </div>',
      '    </button>',
      '  </section>',
      homeSportRail(approved, games),
      homeBookingRail(),
      homeActionDock(games, approved),
      '  <section class="section">',
      '    <div class="panel-title"><h3>今日球局(' + h((state.data.games || []).length) + ')</h3><button class="text-link" type="button" data-jump-view="games">更多</button></div>',
      '    <div class="home-game-list">' + nextGames.map(homeGameCard).join('') + '</div>',
      '  </section>',
      '  <section class="section">',
      '    <div class="panel-title"><h3>推荐场馆</h3><button class="text-link" type="button" data-jump-view="venues">更多</button></div>',
      '    <div class="home-venue-list">' + featuredVenues.map(homeVenueCard).join('') + '</div>',
      '  </section>',
      '</section>',
    ].join('');
  }

  function homeQusportBoard(venues, games) {
    var openGames = (games || []).filter(function (game) { return ['forming', 'open'].includes(game.status); });
    var slotCount = (venues || []).reduce(function (sum, venue) {
      return sum + (venue.open_slots || []).length;
    }, 0);
    var minPrice = (venues || []).reduce(function (min, venue) {
      var price = Number(venue.price_per_hour || 0);
      return price > 0 && (min === 0 || price < min) ? price : min;
    }, 0);
    return [
      '<section class="qusport-board" aria-label="订场决策看板">',
      '  <div class="qusport-board-head">',
      '    <span>趣运动式订场路径</span>',
      '    <strong>江宁 · 今天先看可订</strong>',
      '    <em>项目、时段、低价、AA 球局一屏判断</em>',
      '  </div>',
      '  <div class="qusport-metrics">',
      '    <button type="button" data-jump-view="venues"><strong>' + h((venues || []).length) + '</strong><span>合作场馆</span></button>',
      '    <button type="button" data-jump-view="venues"><strong>' + h(slotCount || '多') + '</strong><span>开放时段</span></button>',
      '    <button type="button" data-jump-view="venues" data-quick-venue-sort="price"><strong>' + (minPrice ? money(minPrice) : '低价') + '</strong><span>价格优先</span></button>',
      '    <button type="button" data-jump-view="games"><strong>' + h(openGames.length) + '</strong><span>AA 球局</span></button>',
      '  </div>',
      '  <div class="qusport-services">',
      '    <button type="button" data-jump-view="venues" data-quick-venue-sort="smart"><span>订场</span><strong>先锁时段</strong></button>',
      '    <button type="button" data-jump-view="games"><span>约球</span><strong>缺人优先</strong></button>',
      '    <button type="button" data-jump-view="teams"><span>球队</span><strong>长期活动</strong></button>',
      '    <button type="button" data-jump-view="orders"><span>订单</span><strong>支付核销</strong></button>',
      '  </div>',
      '</section>',
    ].join('');
  }

  function homeSportRail(venues, games) {
    var items = [
      ['all', '全部', '场馆/球局'],
      ['football', '足球', '约球+订场'],
      ['basketball', '篮球', '室内外可订'],
      ['badminton', '羽毛球', '先占位'],
    ];
    return [
      '<section class="home-sport-rail" aria-label="按运动项目快速进入">',
      items.map(function (item) {
        var key = item[0];
        var venueCount = key === 'all'
          ? (venues || []).length
          : (venues || []).filter(function (venue) { return (venue.sports || []).indexOf(key) >= 0; }).length;
        var gameCount = key === 'all'
          ? (games || []).length
          : (games || []).filter(function (game) { return game.sport === key; }).length;
        return '<button type="button" data-jump-view="venues" data-project-filter="' + h(key) + '"><span class="sport-orb sport-' + h(key) + '"></span><strong>' + h(item[1]) + '</strong><small>' + h(item[2]) + '</small><em>' + h(venueCount) + ' 场馆 / ' + h(gameCount) + ' 球局</em></button>';
      }).join(''),
      '</section>',
    ].join('');
  }

  function homeBookingRail() {
    var options = [
      ['smart', '今天订场', '看今晚可订'],
      ['smart', '明天订场', '提前占时段'],
      ['weekend', '周末可订', '适合组局'],
      ['price', '特价优先', '先看低价'],
    ];
    return [
      '<section class="home-booking-rail" aria-label="快捷订场">',
      '  <div><strong>快速订场</strong><span>先选日期，再看场馆</span></div>',
      '  <div class="home-booking-actions">',
      options.map(function (item) {
        return '<button type="button" data-jump-view="venues" data-quick-venue-sort="' + h(item[0]) + '"><strong>' + h(item[1]) + '</strong><span>' + h(item[2]) + '</span></button>';
      }).join(''),
      '  </div>',
      '</section>',
    ].join('');
  }

  function megaItem(view, title, meta, action) {
    return '<button class="mega-item" type="button" data-jump-view="' + h(view) + '"><span class="mega-dot"></span><strong>' + h(title) + '</strong><em>' + h(meta) + '</em><small>' + h(action) + '</small></button>';
  }

  function serviceTile(icon, label, note, view) {
    return '<button class="service-tile" type="button" data-jump-view="' + h(view) + '"><span class="service-icon service-icon-' + h(icon) + '" aria-hidden="true"></span><strong>' + h(label) + '</strong><small>' + h(note) + '</small></button>';
  }

  function missingPlayers(game) {
    return Math.max(0, Number((game || {}).capacity || 0) - Number((game || {}).joined_count || 0));
  }

  function homeTodoOrders() {
    return (state.data.myOrders || []).filter(function (order) {
      return ['pending_payment', 'paid', 'checked_in'].includes(order.status);
    }).slice(0, 2);
  }

  function homeTodoCard(order) {
    var next = orderNextAction(order);
    return '<button type="button" class="home-todo-card" data-user-view="orders"><span class="tag ' + orderStatusClass(order.status) + '">' + statusLabel(order.status) + '</span><strong>' + h(order.title || '场地预订') + '</strong><em>' + h(next.title) + '</em></button>';
  }

  function homeActionDock(games, venues) {
    var orders = homeTodoOrders();
    var nextGame = (games || []).find(function (game) { return !game.is_joined && ['forming', 'open'].includes(game.status); }) || (games || [])[0] || {};
    var nextVenue = (venues || [])[0] || {};
    return [
      '<section class="home-action-dock home-action-dock-compact">',
      '  <button type="button" class="home-search-card" data-focus-search><span>搜索</span><strong>搜场馆、球局、校区</strong></button>',
      '  <div class="home-action-grid compact-action-grid">',
      '    <button type="button" data-jump-view="venues"><span>可订</span><strong>' + h((venues || []).length) + ' 场</strong><em>' + h(nextVenue.name || '选时段') + '</em></button>',
      '    <button type="button" data-jump-view="games"><span>缺人</span><strong>' + h(missingPlayers(nextGame)) + ' 人</strong><em>' + h(nextGame.title || '附近球局') + '</em></button>',
      '    <button type="button" data-jump-view="create"><span>发起</span><strong>组局</strong><em>AA + 核销</em></button>',
      '  </div>',
      orders.length ? '  <div class="home-todo-strip">' + orders.map(homeTodoCard).join('') + '</div>' : '',
      '</section>',
    ].join('');
  }

  function homeGameCard(game) {
    var players = game.players || [];
    return [
      '<button class="home-game-card" type="button" data-game-detail="' + h(game.id) + '">',
      '  <div class="home-game-time"><strong>' + h(dayParts(game.start_time).day) + '</strong><span>' + h(dayParts(game.start_time).month) + '</span></div>',
      '  <div class="home-game-main">',
      '    <h4>' + h(game.title || '附近球局') + '</h4>',
      '    <p>' + h(game.venue_name || '合作场馆') + ' / ' + h(fmtDate(game.start_time)) + '</p>',
      '    <div class="home-game-meta"><span>已报名 ' + h(game.joined_count || 0) + '/' + h(game.capacity || 0) + ' 人</span><span>实力 ' + oneDecimal(game.average_rating, 3) + ' 分</span></div>',
      '    <div class="avatar-row">' + (players.length ? players.slice(0, 4).map(function (player) { return '<span class="avatar-mini">' + h(initials(player.username)) + '</span>'; }).join('') : '<span class="muted">报名后显示球友</span>') + '</div>',
      '  </div>',
      '  <div class="home-game-side">',
      '    <strong>' + money(game.fee_per_person) + '</strong>',
      '    <span>' + (game.is_joined ? '已报名' : '报名') + '</span>',
      '  </div>',
      '</button>',
    ].join('');
  }

  function homeVenueCard(venue) {
    return [
      '<button class="home-venue-card" type="button" data-book-venue="' + h(venue.id) + '">',
      '  <img src="' + h(venue.cover_url || 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80') + '" alt="' + h(venue.name) + '" />',
      '  <div class="home-venue-body">',
      '    <div class="item-head"><h4>' + h(venue.name) + '</h4><span class="tag ' + (venue.status === 'approved' ? '' : 'gray') + '">' + statusLabel(venue.status) + '</span></div>',
      '    <div class="venue-score-row"><strong>' + (4.3 + (Number(venue.id || 1) % 6) / 10).toFixed(1) + '分</strong><span>' + h((venue.open_slots || ['可订时段'])[0]) + '</span></div>',
      '    <p>' + h(venue.area) + ' · ' + h(venue.address) + '</p>',
      '    <div class="split-row"><span class="tag blue">限时折扣</span><strong class="price">' + money(venue.price_per_hour) + '/小时</strong></div>',
      '  </div>',
      '</button>',
    ].join('');
  }

  function userTabs() {
    var tabs = [
      ['home', '首页'],
      ['venues', '找球场'],
      ['games', '看球局'],
      ['create', '发局'],
      ['teams', '球队'],
      ['messages', '消息'],
      ['me', '个人中心'],
    ];
    return '<div class="section view-tabs">' + tabs.map(function (item) {
      return '<button type="button" data-user-view="' + item[0] + '" class="' + (state.userView === item[0] ? 'is-active' : '') + '">' + item[1] + '</button>';
    }).join('') + '</div>';
  }

  function venueCard(venue) {
    var sports = (venue.sports || []).map(sportLabel);
    var sold = Math.max(18, Number(venue.id || 1) * 37);
    var rating = (4.3 + (Number(venue.id || 1) % 6) / 10).toFixed(1);
    var slots = (venue.open_slots || []).slice(0, 3);
    return [
      '<article class="item-card venue-book-card">',
      '  <div class="venue-cover-wrap"><img src="' + h(venue.cover_url || 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80') + '" alt="' + h(venue.name) + '" /><span class="venue-distance">约 ' + (1.2 + (Number(venue.id || 1) % 5) * 0.7).toFixed(1) + 'km</span></div>',
      '  <div class="item-body">',
      '    <div class="item-head"><h4>' + h(venue.name) + '</h4><span class="tag ' + (venue.status === 'approved' ? '' : 'gray') + '">' + statusLabel(venue.status) + '</span></div>',
      '    <div class="venue-score-row"><strong>' + rating + '分</strong><span>近30天预订 ' + sold + ' 次</span></div>',
      '    <div class="item-meta">',
      '      <span>' + h(venue.area) + ' / ' + (venue.indoor ? '室内优先' : '室外场地') + '</span>',
      '      <span>' + h(venue.address) + '</span>',
      '    </div>',
      '    <div class="venue-tags">' + sports.map(function (item) { return '<span>' + h(item) + '</span>'; }).join('') + '<span>' + h((venue.open_slots || ['可订时段'])[0]) + '</span></div>',
      slots.length ? '    <div class="venue-slot-preview">' + slots.map(function (slot) { return '<span>' + h(slot) + '</span>'; }).join('') + '</div>' : '',
      '    <div class="venue-card-cta"><div><strong class="price">' + money(venue.price_per_hour) + '/小时起</strong><span>可订后生成核销码</span></div><button class="primary-btn small-btn" type="button" data-open-venue-book="' + h(venue.id) + '"' + (venue.status === 'approved' ? '' : ' disabled') + '>订场</button></div>',
      '  </div>',
      '</article>',
    ].join('');
  }

  function venueDecisionStrip(venues) {
    var minPrice = venues.reduce(function (min, venue) {
      var price = Number(venue.price_per_hour || 0);
      return price > 0 && (min === 0 || price < min) ? price : min;
    }, 0);
    var indoorCount = venues.filter(function (venue) { return venue.indoor; }).length;
    var weekendCount = venues.filter(function (venue) {
      return (venue.open_slots || []).some(function (slot) { return /周六|周日|周末/.test(slot); });
    }).length;
    return [
      '<div class="venue-decision-strip" aria-label="场馆订场摘要">',
      '  <button type="button" data-venue-sort="smart"><strong>' + h(venues.length) + '</strong><span>可订场馆</span></button>',
      '  <button type="button" data-venue-sort="price"><strong>' + (minPrice ? money(minPrice) : '--') + '</strong><span>低价起订</span></button>',
      '  <button type="button" data-venue-sort="distance"><strong>' + h(indoorCount) + '</strong><span>室内优先</span></button>',
      '  <button type="button" data-venue-sort="weekend"><strong>' + h(weekendCount) + '</strong><span>周末可订</span></button>',
      '</div>',
    ].join('');
  }

  function mapPanel(venues) {
    var approved = venues.filter(function (venue) { return venue.status === 'approved'; }).slice(0, 5);
    var pins = approved.map(function (venue, index) {
      var positions = [[24, 28], [68, 33], [48, 55], [78, 68], [33, 73]];
      var pos = positions[index] || [50, 50];
      return [
        '<div class="pin" style="left:' + pos[0] + '%;top:' + pos[1] + '%">',
        '  <div class="pin-dot"></div>',
        '  <div class="pin-label">' + h(venue.area) + '</div>',
        '</div>',
      ].join('');
    }).join('');
    return [
      '<aside class="panel map-panel">',
      '  <div class="panel-title"><h3>江宁场馆地图</h3><span>合作场馆分布</span></div>',
      '  <div class="map-canvas"><div class="map-route"></div>' + pins + '</div>',
      '</aside>',
    ].join('');
  }

  function venuesView() {
    var keyword = String(state.venueSearch || '').trim().toLowerCase();
    var seenVenueKeys = new Set();
    var venues = state.data.venues.filter(function (venue) {
      if (venue.status !== 'approved') return false;
      var key = [venue.name, venue.address].join('|').toLowerCase();
      if (seenVenueKeys.has(key)) return false;
      seenVenueKeys.add(key);
      var okArea = state.venueFilter === 'all' || venue.area.indexOf(state.venueFilter) >= 0;
      var okSport = state.sportFilter === 'all' || (venue.sports || []).indexOf(state.sportFilter) >= 0;
      var searchable = [
        venue.name,
        venue.address,
        venue.area,
        venue.contact,
        (venue.sports || []).map(sportLabel).join(' '),
        (venue.open_slots || []).join(' ')
      ].join(' ').toLowerCase();
      var okKeyword = !keyword || searchable.indexOf(keyword) >= 0;
      return okArea && okSport && okKeyword;
    }).sort(function (a, b) {
      if (state.venueSort === 'price') return Number(a.price_per_hour || 0) - Number(b.price_per_hour || 0);
      if (state.venueSort === 'distance') return Number(a.id || 0) - Number(b.id || 0);
      if (state.venueSort === 'weekend') {
        var aWeekend = (a.open_slots || []).some(function (slot) { return /周六|周日|周末/.test(slot); }) ? 0 : 1;
        var bWeekend = (b.open_slots || []).some(function (slot) { return /周六|周日|周末/.test(slot); }) ? 0 : 1;
        if (aWeekend !== bWeekend) return aWeekend - bWeekend;
      }
      return Number(b.id || 0) - Number(a.id || 0);
    });
    return [
      '<section class="section venue-shop-layout">',
      '  <div>',
      '    <div class="panel-title venue-shop-title"><h3>附近可订场馆</h3><span>按项目、区域、价格和周末可订筛选</span></div>',
      '    <div class="venue-booking-hint"><strong>订场优先</strong><span>先看可订时段，再决定约球或发起组局</span></div>',
      venueDecisionStrip(venues),
      filterButtons(),
      venueSortStrip(),
      keyword ? '    <div class="filter-result-note">搜索：' + h(state.venueSearch) + '，找到 ' + h(venues.length) + ' 个场馆 <button type="button" data-clear-venue-search>清除</button></div>' : '',
      '    <div class="cards-grid">' + (venues.length ? venues.map(venueCard).join('') : '<div class="empty">没有找到匹配场馆，换个关键词或清除筛选试试。</div>') + '</div>',
      '  </div>',
      mapPanel(state.data.venues),
      '</section>',
      state.venueBooking ? venueBookingPanel(state.venueBooking) : '',
    ].join('');
  }

  function venueBookingPanel(venue) {
    var slots = venue.open_slot_ranges || [];
    var date = venue.booking_date || todayValue();
    var blocked = actionLocked();
    return [
      '<div class="modal-backdrop" data-close-venue-booking>',
      '  <section class="venue-booking-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      modalTitle('选择订场时段', 'data-close-venue-booking'),
      '    <div class="join-summary">',
      '      <strong>' + h(venue.name) + '</strong>',
      '      <span>' + h(venue.area) + ' / ' + money(venue.price_per_hour) + '/小时起</span>',
      '    </div>',
      '    <div class="panel-soft-block"><strong>预订说明</strong><p>先选日期，再选一个可用时段。系统会根据场馆开放时段和已有订单做占用校验，提交后生成核销码。</p></div>',
      blocked ? '    <div class="panel-soft-block warning-block"><strong>信用分受限</strong><p>当前信用分低于 60，暂不能订场。系统会按每周 5 分恢复至 60 分。</p></div>' : '',
      '    <form class="booking-form" data-venue-booking-form>',
      '      <div class="booking-date-strip">' + bookingDateOptions(date) + '</div>',
      '      <label class="field booking-date-field"><span>预订日期</span><input name="booking_date" type="date" value="' + h(date) + '" min="' + h(todayValue()) + '" /></label>',
      '      <div class="panel-title mini"><h3>可订时段</h3><span>根据场馆开放时段和订单占用自动过滤</span></div>',
      '      <div class="slot-grid">' + (slots.length ? slots.map(function (slot) {
        var disabled = slot.occupied || !slot.start || !slot.end;
        var estimate = slot.start && slot.end ? money(venue.price_per_hour) + '/小时' : '待确认';
        return '<button type="button" class="slot-card ' + (disabled ? 'is-disabled' : '') + '" data-slot-pick="' + h(slot.start + '-' + slot.end) + '" data-slot-label="' + h(slot.label) + '" data-slot-start="' + h(slot.start) + '" data-slot-end="' + h(slot.end) + '"' + (disabled ? ' disabled' : '') + '><strong>' + h(slot.label) + '</strong><span>' + (disabled ? '已占用' : '可预订') + '</span><em>' + h(estimate) + '</em></button>';
      }).join('') : '<div class="empty">暂无开放时段</div>') + '</div>',
      '      <label class="field"><span>已选时段</span><input name="booking_range" readonly placeholder="请选择上方时段" /></label>',
      '      <div class="detail-grid">',
      metric('场馆价格', money(venue.price_per_hour) + '/小时'),
      metric('预订日期', date),
      metric('预估费用', '待计算'),
      metric('状态', '待确认'),
      '      </div>',
      '      <button class="primary-btn" type="submit" disabled data-submit-venue-book>' + (blocked ? '信用受限' : '确认并支付') + '</button>',
      '      <input type="hidden" name="booking_start_time" />',
      '      <input type="hidden" name="booking_end_time" />',
      '      <input type="hidden" name="venue_id" value="' + h(venue.id) + '" />',
      '    </form>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function bookingDateOptions(selectedDate) {
    var labels = ['今天', '明天', '后天', '周末'];
    var dates = [0, 1, 2, nextWeekendOffset()].map(function (offset, index) {
      var item = new Date();
      item.setDate(item.getDate() + offset);
      var value = item.getFullYear() + '-' + String(item.getMonth() + 1).padStart(2, '0') + '-' + String(item.getDate()).padStart(2, '0');
      var weekday = '周' + '日一二三四五六'.charAt(item.getDay());
      return '<button type="button" class="' + (value === selectedDate ? 'is-active' : '') + '" data-booking-date-pick="' + h(value) + '"><strong>' + h(labels[index]) + '</strong><span>' + h(weekday + ' ' + String(item.getMonth() + 1) + '/' + item.getDate()) + '</span></button>';
    });
    return dates.join('');
  }

  function nextWeekendOffset() {
    var day = new Date().getDay();
    var offset = (6 - day + 7) % 7;
    return offset === 0 ? 7 : offset;
  }

  function todayValue() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }

  function localDateTimeValue(offsetDays, hour, minute) {
    var next = new Date();
    next.setDate(next.getDate() + (offsetDays || 0));
    next.setHours(hour == null ? 19 : hour, minute == null ? 0 : minute, 0, 0);
    return next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0') + 'T' + String(next.getHours()).padStart(2, '0') + ':' + String(next.getMinutes()).padStart(2, '0');
  }

  function filterButtons() {
    var areas = ['all', '南师附中江宁分校', '江宁大学城', '江宁开发区', '百家湖'];
    var sports = [['all', '全部项目'], ['football', '足球'], ['basketball', '篮球']];
    return [
      '<div class="venue-filter-panel">',
      '  <div class="filter-group"><span>区域</span><div class="filter-row">' + areas.map(function (area) {
        var label = area === 'all' ? '全部区域' : area;
        return '<button class="pill-button ' + (state.venueFilter === area ? 'is-active' : '') + '" type="button" data-area-filter="' + h(area) + '">' + h(label) + '</button>';
      }).join('') + '</div></div>',
      '  <div class="filter-group"><span>项目</span><div class="filter-row">' + sports.map(function (item) {
        return '<button class="pill-button ' + (state.sportFilter === item[0] ? 'is-active' : '') + '" type="button" data-sport-filter="' + item[0] + '">' + item[1] + '</button>';
      }).join('') + '</div></div>',
      '</div>',
    ].join('');
  }

  function venueSortStrip() {
    var sorts = [
      ['smart', '综合排序'],
      ['distance', '离我最近'],
      ['price', '价格优先'],
      ['weekend', '周末可订'],
    ];
    return '<div class="sort-strip">' + sorts.map(function (item) {
      return '<button class="' + (state.venueSort === item[0] ? 'is-active' : '') + '" type="button" data-venue-sort="' + h(item[0]) + '">' + h(item[1]) + '</button>';
    }).join('') + '</div>';
  }

  function gameCard(game) {
    var date = dayParts(game.start_time);
    var percent = game.capacity ? Math.min(100, Math.round(game.joined_count / game.capacity * 100)) : 0;
    var averageRating = game.average_rating == null ? 3 : Number(game.average_rating);
    var myRating = Number(ratingSummary().composite_score || 3);
    var isMatch = Math.abs(averageRating - myRating) <= 0.6;
    var players = game.players || [];
    return [
      '<article class="game-card">',
      '  <div class="date-chip"><strong>' + h(date.day) + '</strong><span>' + h(date.month) + '</span></div>',
      '  <div>',
      '    <div class="item-head"><h4>' + h(game.title) + '</h4><div class="tag-row">' + (isMatch ? '<span class="tag orange">实力匹配</span>' : '') + '<span class="tag ' + orderStatusClass(game.status) + '">' + statusLabel(game.status) + '</span><span class="tag blue">' + sportLabel(game.sport) + '</span></div></div>',
      '    <p>' + h(game.venue_name) + ' / ' + h(game.area) + ' / ' + fmtDate(game.start_time) + '</p>',
      '    <p>' + h(game.notes) + '</p>',
      '    <div class="game-join-meta"><span>缺 ' + h(Math.max(0, Number(game.capacity || 0) - Number(game.joined_count || 0))) + ' 人</span><span>AA ' + money(game.fee_per_person) + '</span><span>' + h(date.month + date.day) + ' 开局</span></div>',
      '    <div class="item-meta"><span>已报名 ' + h(game.joined_count) + '/' + h(game.capacity) + ' 人</span><span>当前球局平均实力 ' + oneDecimal(averageRating, 3) + ' 分</span><div class="progress"><span style="width:' + percent + '%"></span></div></div>',
      '    <div class="player-chips">' + (players.length ? players.slice(0, 8).map(function (player) {
        return '<button type="button" class="player-chip" data-player-profile="' + h(player.user_id) + '"><span class="avatar-mini">' + h(initials(player.username)) + '</span><span>' + h(player.username) + '</span><em>' + h(player.level_label || '进阶') + ' ' + oneDecimal(player.composite_score, 3) + '分</em></button>';
      }).join('') : '<span class="muted">报名后会展示球员实力</span>') + '</div>',
      '  </div>',
      '  <div class="game-card-actions">',
      '    <strong class="price">' + money(game.fee_per_person) + '</strong>',
      '    <button class="secondary-btn" type="button" data-game-detail="' + h(game.id) + '">详情</button>',
      '    <button class="' + (game.is_joined || publicJoinLocked() ? 'secondary-btn' : 'primary-btn') + '" type="button" data-open-join="' + h(game.id) + '"' + (game.is_joined || publicJoinLocked() || !['forming', 'open'].includes(game.status) ? ' disabled' : '') + '>' + (game.is_joined ? '已报名' : publicJoinLocked() ? '信用受限' : '报名支付') + '</button>',
      '    <button class="secondary-btn review-btn" type="button" data-review-game="' + h(game.id) + '">赛后互评</button>',
      '  </div>',
      '</article>',
    ].join('');
  }

  function gamesView() {
    var myRating = Number(ratingSummary().composite_score || 3);
    var keyword = String(state.venueSearch || '').trim().toLowerCase();
    var games = [].concat(state.data.games || []).filter(function (game) {
      var okSport = state.sportFilter === 'all' || game.sport === state.sportFilter;
      var searchable = [
        game.title,
        game.venue_name,
        game.area,
        game.address,
        sportLabel(game.sport),
        game.status
      ].join(' ').toLowerCase();
      var okKeyword = !keyword || searchable.indexOf(keyword) >= 0;
      return okSport && okKeyword;
    }).sort(function (a, b) {
      var aDiff = Math.abs(Number(a.average_rating == null ? 3 : a.average_rating) - myRating);
      var bDiff = Math.abs(Number(b.average_rating == null ? 3 : b.average_rating) - myRating);
      if (aDiff <= 0.6 && bDiff > 0.6) return -1;
      if (bDiff <= 0.6 && aDiff > 0.6) return 1;
      return new Date(a.start_time) - new Date(b.start_time);
    });
    return [
      '<section class="section">',
      state.userView === 'games' ? profileBackTitle('附近球局', '实力匹配优先，先付后打') : '<div class="panel-title"><h3>附近球局</h3><span>实力匹配优先，先付后打</span></div>',
      keyword ? '  <div class="filter-result-note">搜索：' + h(state.venueSearch) + '，找到 ' + h(games.length) + ' 场球局 <button type="button" data-clear-venue-search>清除</button></div>' : '',
      '  <div class="games-list">' + (games.length ? games.map(gameCard).join('') : empty3d('暂无球局', 'games')) + '</div>',
      '</section>',
      state.reviewDetail ? reviewPanel(state.reviewDetail) : '',
      state.playerProfile ? playerProfileModal(state.playerProfile) : '',
      state.gameDetail ? gameDetailPanel(state.gameDetail) : '',
      state.joinConfirm ? joinConfirmPanel(state.joinConfirm) : '',
      state.paymentConfirm ? paymentPanel(state.paymentConfirm) : '',
    ].join('');
  }

  function gameDetailPanel(detail) {
    var game = detail.game || {};
    var players = detail.players || [];
    var avg = players.length
      ? players.reduce(function (sum, player) { return sum + Number(player.composite_score || 3); }, 0) / players.length
      : 3;
    return [
      '<div class="modal-backdrop" data-close-game-detail>',
      '  <section class="game-detail-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      modalTitle(game.title || '球局详情', 'data-close-game-detail'),
      '    <div class="game-detail-hero">',
      '      <div><span class="tag blue">' + sportLabel(game.sport) + '</span><h4>' + h(game.venue_name) + '</h4><p>' + h(game.area) + ' / ' + h(game.address) + '</p></div>',
      '      <div class="order-code"><span>平均实力</span><strong>' + oneDecimal(avg, 3) + '</strong></div>',
      '    </div>',
      '    <div class="detail-grid">',
      metric('开始时间', fmtDate(game.start_time)),
      metric('结束时间', fmtDate(game.end_time)),
      metric('费用/人', money(game.fee_per_person)),
      metric('到场人数', players.filter(function (p) { return Number(p.checked_in) === 1; }).length + '/' + players.length),
      '    </div>',
      '    <div class="panel-soft-block"><strong>报名与公平机制</strong><p>报名后生成核销码；到场核销会增加信用分。赛后 24 小时内可对同场到场球员互评，互评满 3 条后计入综合实力。</p></div>',
      '    <div class="panel-title mini"><h3>已报名球员</h3><span>等级与综合分公开展示</span></div>',
      '    <div class="detail-player-list">' + (players.length ? players.map(function (player) {
        return '<button type="button" class="detail-player" data-player-profile="' + h(player.user_id) + '"><span class="avatar-mini">' + h(initials(player.username)) + '</span><strong>' + h(player.username) + '</strong><em>' + h(player.level_label || '进阶') + ' ' + oneDecimal(player.composite_score, 3) + '分</em><span class="tag ' + (Number(player.checked_in) === 1 ? '' : 'gray') + '">' + (Number(player.checked_in) === 1 ? '已到场' : '未核销') + '</span></button>';
      }).join('') : '<div class="empty">暂无报名球员</div>') + '</div>',
      detail.review_open ? '<button class="primary-btn" type="button" data-review-game="' + h(game.id) + '">进入赛后互评</button>' : '<button class="secondary-btn" type="button" disabled>互评将在到场核销且比赛结束后开放</button>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function joinConfirmPanel(game) {
    var locked = publicJoinLocked();
    return [
      '<div class="modal-backdrop" data-close-join-confirm>',
      '  <section class="join-confirm-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      modalTitle('确认报名', 'data-close-join-confirm'),
      '    <div class="join-summary">',
      '      <strong>' + h(game.title) + '</strong>',
      '      <span>' + h(game.venue_name) + ' / ' + fmtDate(game.start_time) + '</span>',
      '    </div>',
      '    <div class="detail-grid">',
      metric('报名费用', money(game.fee_per_person)),
      metric('当前人数', h(game.joined_count || 0) + '/' + h(game.capacity || 0)),
      metric('平均实力', oneDecimal(game.average_rating, 3) + '分'),
      metric('信用要求', locked ? '受限' : '正常'),
      '    </div>',
      locked ? '    <div class="panel-soft-block warning-block"><strong>信用分不足</strong><p>当前信用分 ' + h(creditScore()) + '，低于 80 分时暂不能参与公开局；低于 60 分时不能发局或订场。</p></div>' : '',
      '    <label class="check-row"><input type="checkbox" checked disabled /> 我确认按时到场，若爽约将影响信用分</label>',
      '    <button class="primary-btn" type="button" data-join-game="' + h(game.id) + '"' + (locked ? ' disabled' : '') + '>确认报名，生成待支付订单</button>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function paymentPanel(order) {
    var next = orderNextAction(order);
    var payLocked = order.game_id ? publicJoinLocked() : actionLocked();
    var payLockText = order.game_id
      ? '当前信用分低于 80，暂不能支付公开局报名订单。'
      : '当前信用分低于 60，暂不能支付订场订单。';
    var canPay = order.status === 'pending_payment' && !payLocked;
    var canCancel = order.status === 'pending_payment' || order.status === 'paid';
    return [
      '<div class="modal-backdrop" data-close-payment>',
      '  <section class="payment-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      modalTitle('支付确认', 'data-close-payment'),
      '    <div class="payment-hero">',
      '      <div><span class="tag orange">' + statusLabel(order.status || 'pending_payment') + '</span><h4>' + h(order.title || '场地预订') + '</h4><p>' + h(order.venue_name || order.venue || '合作场馆') + '</p></div>',
      '      <div class="order-code"><span>应付金额</span><strong>' + money(order.amount) + '</strong></div>',
      '    </div>',
      '    <div class="detail-grid">',
      metric('订单号', '#' + h(order.order_id || order.id)),
      metric('支付方式', '微信支付'),
      metric('订单状态', statusLabel(order.status || 'pending_payment')),
      metric('信用分', creditScore()),
      '    </div>',
      orderTimeline(order),
      '    <div class="panel-soft-block"><strong>' + h(next.title) + '</strong><p>' + h(next.body) + '</p></div>',
      payLocked && order.status === 'pending_payment' ? '    <div class="panel-soft-block warning-block"><strong>信用分受限</strong><p>' + h(payLockText) + '</p></div>' : '',
      '    <div class="payment-actions">',
      canCancel ? '      <button class="secondary-btn" type="button" data-cancel-order="' + h(order.order_id || order.id) + '">' + (order.status === 'paid' ? '申请退款/取消' : '取消订单') + '</button>' : '',
      order.status === 'pending_payment' ? '      <button class="primary-btn" type="button" data-pay-order="' + h(order.order_id || order.id) + '"' + (canPay ? '' : ' disabled') + '>' + (payLocked ? '信用受限' : '模拟微信支付') + '</button>' : '      <button class="primary-btn" type="button" disabled>' + statusLabel(order.status || 'pending_payment') + '</button>',
      '    </div>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function createView() {
    var approved = state.data.venues.filter(function (venue) { return venue.status === 'approved'; });
    var blocked = actionLocked();
    var defaultStart = localDateTimeValue(1, 19, 0);
    var defaultEnd = localDateTimeValue(1, 21, 0);
    return [
      '<section class="section form-panel">',
      '  <h3>创建足球/篮球局</h3>',
      blocked ? '  <div class="panel-soft-block warning-block"><strong>信用分受限</strong><p>当前信用分低于 60，暂不能发起球局。先通过自动恢复、到场核销或队友好评恢复信用。</p></div>' : '',
      '  <form class="form-grid" data-create-game>',
      field('球局标题', '<input name="title" required maxlength="120" value="江宁大学城周末约球" />'),
      field('运动类型', '<select name="sport"><option value="football">足球</option><option value="basketball">篮球</option></select>'),
      field('场馆', '<select name="venue_id">' + approved.map(function (venue) { return '<option value="' + h(venue.id) + '">' + h(venue.name) + '</option>'; }).join('') + '</select>'),
      field('开始时间', '<input name="start_time" type="datetime-local" required value="' + h(defaultStart) + '" />'),
      field('结束时间', '<input name="end_time" type="datetime-local" required value="' + h(defaultEnd) + '" />'),
      field('人数上限', '<input name="capacity" type="number" min="2" max="50" value="10" />'),
      field('AA 费用/人', '<input name="fee_per_person" type="number" min="0" value="30" />'),
      field('备注', '<textarea name="notes" maxlength="500">强度适中，报名后请准时到场。</textarea>'),
      '    <button class="primary-btn" type="submit"' + (blocked ? ' disabled' : '') + '>' + (blocked ? '信用受限' : '发布球局') + '</button>',
      '  </form>',
      '</section>',
    ].join('');
  }

  function field(label, control) {
    return '<label class="field"><span>' + h(label) + '</span>' + control + '</label>';
  }

  function ratingGuide() {
    if (guideSeen()) return '';
    return [
      '<div class="guide-card">',
      '  <div><strong>实力评级新手引导</strong><p>综合分由自评 30% + 有效互评 70% 计算；互评需同场到场球员提交，单场同一球员满 3 条才生效，并会去掉 1 个最高分和 1 个最低分。</p></div>',
      '  <div class="guide-actions"><button class="secondary-btn" type="button" data-return-home>回主页</button><button class="secondary-btn" type="button" data-close-rating-guide>我知道了</button></div>',
      '</div>',
    ].join('');
  }

  function selfRatingPanel() {
    var rating = ratingSummary();
    return [
      '<div class="panel rating-panel">',
      '  <div class="panel-title"><h3>我的实力评级</h3><span>7 天内仅可修改 1 次</span></div>',
      ratingGuide(),
      '  <div class="rating-scoreboard">',
      '    <div><span>综合等级</span>' + ratingBadge(rating) + '</div>',
      '    <div><span>自评分</span><strong>' + oneDecimal(rating.self_score, 3) + '</strong></div>',
      '    <div><span>互评分</span><strong>' + (rating.peer_score == null ? '待积累' : oneDecimal(rating.peer_score, 3)) + '</strong></div>',
      '    <div><span>有效互评场次</span><strong>' + h(rating.effective_peer_games || 0) + '</strong></div>',
      '  </div>',
      '  <form class="rating-form" data-self-rating>',
      '    <div class="preset-row" role="group" aria-label="快捷评级">' + ratingPresets.map(function (item) {
        return '<button class="pill-button" type="button" data-rating-preset="' + item[0] + '" data-preset-score="' + item[2] + '">' + item[1] + '</button>';
      }).join('') + '</div>',
      '    <div class="rating-grid">' + ratingDimensions.map(function (item) {
        return starSlider(item[0], rating[item[0] + '_self'] || 3);
      }).join('') + '</div>',
      '    <button class="primary-btn" type="submit">提交自评</button>',
      '  </form>',
      dimensionCompare(rating),
      trendBars(rating),
      '</div>',
    ].join('');
  }

  function dimensionCompare(rating) {
    return [
      '<div class="dimension-compare">',
      '  <div class="panel-title mini"><h3>分项对比</h3><span>本人可见</span></div>',
      ratingDimensions.map(function (item) {
        var selfValue = oneDecimal(rating[item[0] + '_self'], 3);
        var peerValue = rating[item[0] + '_peer'] == null ? null : oneDecimal(rating[item[0] + '_peer'], 3);
        return '<div class="compare-row"><span>' + h(item[1]) + '</span><strong>自评 ' + selfValue + '</strong><em>互评 ' + (peerValue || '暂无') + '</em></div>';
      }).join(''),
      '</div>',
    ].join('');
  }

  function trendBars(rating) {
    var trend = parseTrend(rating.trend_json);
    if (!trend.length) return '<div class="empty small-empty">近 10 场评分趋势会在有效互评积累后显示。</div>';
    return [
      '<div class="trend-box">',
      '  <div class="panel-title mini"><h3>近 10 场趋势</h3><span>互评有效场次</span></div>',
      '  <div class="trend-bars">' + trend.map(function (item, index) {
        var value = score(item.score, 3);
        return '<div class="trend-bar"><span style="height:' + (value / 5 * 100) + '%"></span><em>' + h(value.toFixed(1)) + '</em><small>' + h(index + 1) + '</small></div>';
      }).join('') + '</div>',
      '</div>',
    ].join('');
  }

  function reviewPanel(detail) {
    var players = (detail.players || []).filter(function (player) {
      return Number(player.user_id) !== Number((session() || {}).id || 1) && Number(player.checked_in) === 1 && (detail.reviewed_target_ids || []).indexOf(Number(player.user_id)) < 0;
    });
    return [
      '<div class="modal-backdrop" data-close-review>',
      '  <section class="review-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      modalTitle('赛后互评', 'data-close-review'),
      '    <p class="muted">' + h(detail.game.title) + ' / ' + fmtDate(detail.game.end_time) + ' 结束后 24 小时内可提交。单个球员本场满 3 条互评后计入综合分。</p>',
      detail.review_open ? '<form data-peer-review><div class="review-list">' + (players.length ? players.map(reviewTargetCard).join('') : '<div class="empty">暂无可评价的同场到场球员，或你已完成本场互评。</div>') + '</div><label class="check-row"><input type="checkbox" name="anonymous" checked /> 匿名提交</label><button class="primary-btn" type="submit"' + (players.length ? '' : ' disabled') + '>提交本场互评</button></form>' : '<div class="empty">互评入口未开放：需本人报名并完成到场核销，且在球局结束后 24 小时内提交。</div>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function reviewTargetCard(player) {
    return [
      '<article class="review-target" data-review-target="' + h(player.user_id) + '">',
      '  <div class="review-target-head">',
      '    <div class="player-line"><span class="avatar-mini">' + h(initials(player.username)) + '</span><strong>' + h(player.username) + '</strong></div>',
      ratingBadge(player, player.user_id),
      '  </div>',
      '  <div class="rating-grid compact">' + ratingDimensions.map(function (item) {
        return starSlider(item[0], 3, 'target-' + player.user_id);
      }).join('') + '</div>',
      '</article>',
    ].join('');
  }

  function playerProfileModal(profile) {
    var rating = profile.rating || {};
    var isSelf = Number(profile.user_id) === Number((session() || {}).id || 1);
    return [
      '<div class="modal-backdrop" data-close-player-profile>',
      '  <section class="player-profile-modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      modalTitle('球员主页', 'data-close-player-profile'),
      '    <div class="profile-head">',
      '      <span class="avatar-large">' + h(initials(profile.username)) + '</span>',
      '      <div><h4>' + h(profile.username) + '</h4>' + ratingBadge(rating) + '</div>',
      '    </div>',
      '    <div class="rating-scoreboard">',
      '      <div><span>累计参赛</span><strong>' + h(profile.played || 0) + '</strong></div>',
      '      <div><span>互评总数</span><strong>' + h(rating.peer_rating_count || 0) + '</strong></div>',
      '      <div><span>有效场次</span><strong>' + h(rating.effective_peer_games || 0) + '</strong></div>',
      '      <div><span>综合分</span><strong>' + oneDecimal(rating.composite_score, 3) + '</strong></div>',
      '    </div>',
      isSelf ? dimensionCompare(rating) + trendBars(rating) : '<p class="muted">对外展示综合等级、综合分、参赛场次与互评总数；分项明细仅本人可见。</p>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function meView() {
    var me = state.data.me || {};
    var orders = state.data.myOrders || [];
    var user = session() || {};
    var rating = ratingSummary();
    var username = profileDemoValue('nickname', user.username || user.name || 'demo_player');
    var city = profileDemoValue('city', '南京');
    var sport = profileDemoValue('sport', '足球 / 篮球');
    var bio = profileDemoValue('bio', 'SnapSport 球友');
    var pendingOrders = orders.filter(function (order) {
      return ['pending_payment', 'paid'].includes(order.status);
    }).length;
    var played = Number(me.played || 0);
    var credit = Number(me.credit_score || 100);
    return [
      '<section class="profile-page">',
      '  <div class="profile-hero-card">',
      '    <div class="profile-identity">',
      '      <span class="profile-avatar">' + h(initials(username)) + '</span>',
      '      <div class="profile-user-main">',
      '        <h2>' + h(username) + '</h2>',
      '        <p>' + h(city) + ' · ' + h(bio) + '</p>',
      '        <div class="profile-tags"><span>信用 ' + h(credit) + '</span><span>' + h(rating.level_label || '进阶') + ' ' + oneDecimal(rating.composite_score, 3) + '分</span></div>',
      '        <div class="profile-tags profile-sport-tags"><span>' + h(sport) + '</span><span>' + h(profileDemoValue('privacy', '公开约球资料')) + '</span></div>',
      '      </div>',
      '      <button class="profile-edit-btn" type="button" data-open-profile-edit>编辑</button>',
      '    </div>',
      '    <div class="profile-level-3d" aria-hidden="true"><span></span><i></i><em></em><b>LV</b></div>',
      '    <div class="profile-stats">',
      '      <button type="button" data-user-view="orders"><strong>' + h(orders.length) + '</strong><span>订单</span></button>',
      '      <button type="button" data-user-view="my-games"><strong>' + h(played) + '</strong><span>参赛</span></button>',
      '      <button type="button" data-user-view="orders"><strong>' + h(pendingOrders) + '</strong><span>待处理</span></button>',
      '    </div>',
      '  </div>',
      '  <div class="profile-wallet-card">',
      '    <button type="button" data-user-view="credit"><span>守约账户</span><strong>' + h(credit) + '</strong><small>信用分</small></button>',
      '    <div><span>到场核销</span><strong>' + h(me.checked_in || 0) + '</strong><small>次</small></div>',
      '    <div><span>爽约记录</span><strong>' + h(me.no_shows || 0) + '</strong><small>次</small></div>',
      '  </div>',
      '  <div class="profile-shortcuts">',
      profileShortcut('create', '发起组局', 'AA 支付', 'create', 'create'),
      profileShortcut('friend', '加好友', '推荐球友', 'friend', null, 'data-open-friend-add'),
      profileShortcut('games', '我的球局', '赛程报名', 'ball', 'my-games'),
      profileShortcut('orders', '我的订单', '支付核销', 'order', 'orders'),
      profileShortcut('fav', '我的球馆', '常用场馆', 'star', 'favorites'),
      '  </div>',
      '  <div class="profile-menu-card">',
      profileMenuItem('ball', '我的球局', '已报名和待处理球局', 'my-games'),
      profileMenuItem('venue', '场馆管理', '订单、核销和收入概览', 'venue-admin'),
      profileMenuItem('team', '球队', '创建或加入固定球队', 'teams'),
      profileMenuItem('shield', '守约账户', '信用分、扣分和恢复记录', 'credit'),
      profileMenuItem('star', '我的球馆', '常用场馆与关注球局', 'favorites'),
      '  </div>',
      '  <div class="profile-menu-card">',
      profileMenuItem('ai', 'AI 高光集锦', '黑客松演示入口', 'ai'),
      profileMenuItem('data', '运动数据档案', '预留数据上传', 'data'),
      profileMenuItem('demo', '完整流程', '演示主线与扩展能力', 'demo'),
      profileMenuItem('shield', '合规说明', '隐私、协议、支付和场馆合作', 'legal'),
      '  </div>',
      '  <div class="profile-menu-card">',
      profileMenuItem('support', '联系客服', '模拟客服窗口', null, 'data-open-support'),
      profileMenuItem('feedback', '投诉反馈', '演示用本地反馈', null, 'data-open-support'),
      profileMenuItem('setting', '设置 / 更多', '黑客松演示配置', null, 'data-open-settings'),
      '  </div>',
      '  <details class="profile-rating-details">',
      '    <summary><span>我的实力评级</span><em>展开自评与互评明细</em></summary>',
      selfRatingPanel(),
      '  </details>',
      '  <button class="profile-logout" type="button" data-local-logout>退出登录</button>',
      '</section>',
      state.supportOpen ? supportWindow() : '',
      state.settingsOpen ? settingsWindow() : '',
      state.profileEditOpen ? profileEditSheet() : '',
      state.reviewDetail ? reviewPanel(state.reviewDetail) : '',
      state.playerProfile ? playerProfileModal(state.playerProfile) : '',
    ].join('');
  }

  function legalView() {
    var sections = [
      ['隐私政策', '开发版只展示完成找场、报名、订场、核销和信用记录所需的信息摘要。正式上线前需要补齐微信用户隐私保护指引。'],
      ['用户协议', '用户需要按时到场、遵守场馆规则，并对报名、订场、支付和互评行为负责。'],
      ['支付说明', '当前开发版使用模拟支付，不会真实扣款。正式交易前需要接入微信支付商户号、证书、API v3 key 和通知验签。'],
      ['场馆合作', '场馆端用于入驻申请、资料维护、订单查看和到场核销；正式运营前需要补齐资质审核、结算和争议处理规则。'],
    ];

    return [
      '<section class="section">',
      '  <div class="panel profile-section">',
      profileBackTitle('合规说明', '开发版摘要'),
      '    <p class="section-lead">这里是开发版合规摘要，正式提交审核前请以 docs/legal/ 的完整文本为准。</p>',
      sections.map(function (item, index) {
        return [
          '    <article class="profile-menu-item">',
          '      <div class="profile-menu-icon">' + h(index + 1) + '</div>',
          '      <div><strong>' + h(item[0]) + '</strong><p>' + h(item[1]) + '</p></div>',
          '    </article>',
        ].join('');
      }).join(''),
      '    <div class="panel-soft-block warning-block"><strong>上线前必须替换为正式文本</strong><p>请补齐运营主体、客服电话、生效日期、隐私字段和真实支付/退款规则。</p></div>',
      '  </div>',
      '</section>',
    ].join('');
  }

  function creditView() {
    var me = state.data.me || {};
    var played = Number(me.played || 0);
    var credit = Number(me.credit_score || 100);
    return [
      '<section class="section">',
      '  <div class="panel profile-credit-panel" id="profile-credit">',
      profileBackTitle('信用记录', '黑客松演示账户'),
      '    <div class="profile-credit-row"><span>当前信用分</span><strong>' + h(credit) + '</strong><em>' + (credit >= 90 ? '守约良好' : credit >= 80 ? '可以报名' : '报名受限') + '</em></div>',
      '    <div class="profile-credit-row"><span>参与场次</span><strong>' + h(played) + '</strong><em>累计到场越多，可信度越高</em></div>',
      '    <div class="profile-credit-row"><span>爽约次数</span><strong>' + h(me.no_shows || 0) + '</strong><em>低于 80 会限制公开局报名，低于 60 会限制发局和订场</em></div>',
      '    <div class="panel-soft-block"><strong>信用规则</strong><p>新用户初始 100 分；开局前 24 小时内取消扣 5 分，前 1 小时内取消或无故缺席扣 20 分；按时到场 +3，发起真实球局 +2，获得队友好评 +1。低于 60 分时每周自动恢复 5 分，最高恢复到 60 分。</p></div>',
      '  </div>',
      '</section>',
    ].join('');
  }

  function myGamesView() {
    var joined = (state.data.games || []).filter(function (game) { return game.is_joined; });
    return [
      '<section class="section">',
      profileBackTitle('我的球局', '只展示我已报名或参与的球局'),
      '  <div class="games-list">' + (joined.length ? joined.map(gameCard).join('') : empty3d('还没有参加球局。可以去“看球局”报名一场附近活动。', 'games')) + '</div>',
      '</section>',
      state.reviewDetail ? reviewPanel(state.reviewDetail) : '',
      state.playerProfile ? playerProfileModal(state.playerProfile) : '',
      state.gameDetail ? gameDetailPanel(state.gameDetail) : '',
      state.joinConfirm ? joinConfirmPanel(state.joinConfirm) : '',
      state.paymentConfirm ? paymentPanel(state.paymentConfirm) : '',
    ].join('');
  }

  function favoritesView() {
    var approved = (state.data.venues || []).filter(function (venue) { return venue.status === 'approved'; });
    return [
      '<section class="section">',
      profileBackTitle('我的球馆', '演示版默认收藏样板区合作场馆'),
      '  <div class="home-venue-list">' + (approved.length ? approved.slice(0, 3).map(homeVenueCard).join('') : empty3d('暂无收藏场馆。', 'venue')) + '</div>',
      '</section>',
      state.venueBooking ? venueBookingPanel(state.venueBooking) : '',
    ].join('');
  }

  function myOrdersView() {
    var orders = state.data.myOrders || [];
    var pendingPayment = orders.filter(function (order) { return order.status === 'pending_payment'; });
    var readyCheckin = orders.filter(function (order) { return order.status === 'paid' && order.can_checkin; });
    var waitingCheckin = orders.filter(function (order) { return order.status === 'paid' && !order.can_checkin; });
    var pendingReview = orders.filter(function (order) { return order.status === 'checked_in'; });
    var historyOrders = orders.filter(function (order) { return !['pending_payment', 'paid', 'checked_in'].includes(order.status); });
    return [
      '<section class="section">',
      '  <div class="panel">',
      profileBackTitle('我的订单', '报名支付与核销'),
      '    <div class="order-todo-summary">',
      '      <article><span>待支付</span><strong>' + h(pendingPayment.length) + '</strong></article>',
      '      <article><span>可核销</span><strong>' + h(readyCheckin.length) + '</strong></article>',
      '      <article><span>待开放</span><strong>' + h(waitingCheckin.length) + '</strong></article>',
      '      <article><span>待互评</span><strong>' + h(pendingReview.length) + '</strong></article>',
      '    </div>',
      myOrderGroup('待支付', '先完成支付，场地/名额才会正式保留', pendingPayment, '当前没有待支付订单。'),
      myOrderGroup('现在可核销', '到场后出示核销码，完成守约记录', readyCheckin, '当前没有可核销订单。'),
      myOrderGroup('核销待开放', '开场/预订前 30 分钟开放核销码', waitingCheckin, '当前没有等待开放核销的订单。'),
      myOrderGroup('待互评 / 已到场', '球局结束后补完互评，更新信用和实力档案', pendingReview, '当前没有待互评订单。'),
      historyOrders.length ? '<details class="order-history"><summary>历史订单 ' + h(historyOrders.length) + ' 条</summary>' + myOrderList(historyOrders) + '</details>' : '',
      '  </div>',
      '</section>',
      state.reviewDetail ? reviewPanel(state.reviewDetail) : '',
    ].join('');
  }

  function myOrderGroup(title, desc, orders, emptyText) {
    return [
      '<section class="order-todo-group">',
      '  <div class="panel-title mini"><h3>' + h(title) + '</h3><span>' + h(desc) + '</span></div>',
      myOrderList(orders, emptyText),
      '</section>',
    ].join('');
  }

  function venueAdminView() {
    var venues = (state.data.venues || []).filter(function (venue) { return venue.status === 'approved'; });
    var orders = state.data.myOrders || [];
    var pending = orders.filter(function (order) { return order.status === 'paid'; });
    var checkedIn = orders.filter(function (order) { return order.status === 'checked_in'; });
    var revenue = orders.reduce(function (sum, order) {
      return ['paid', 'checked_in'].includes(order.status) ? sum + Number(order.amount || 0) : sum;
    }, 0);
    return [
      '<section class="section">',
      '  <div class="panel">',
      profileBackTitle('场馆管理', '本地演示场馆端：订单、核销和收入概览'),
      '    <div class="order-todo-summary">',
      '      <article><span>今日订单</span><strong>' + h(orders.length) + '</strong></article>',
      '      <article><span>待核销</span><strong>' + h(pending.length) + '</strong></article>',
      '      <article><span>已核销</span><strong>' + h(checkedIn.length) + '</strong></article>',
      '      <article><span>收入</span><strong>¥' + h(revenue.toFixed(0)) + '</strong></article>',
      '    </div>',
      '    <div class="panel-soft-block"><strong>管理场馆</strong><p>' + h(venues.map(function (venue) { return venue.name; }).slice(0, 3).join('、') || '暂无可管理场馆') + '</p></div>',
      '  </div>',
      '  <div class="compact-list">' + (orders.length ? orders.map(function (order) {
        return [
          '<article class="compact-order">',
          '  <div>',
          '    <strong>' + h(order.title || '场地预约订单') + '</strong>',
          '    <span>' + h(order.venue_name || '场馆待定') + ' / ' + fmtDate(order.start_time || order.booking_start_time || order.create_time) + '</span>',
          '    <em>用户 ' + h(order.username || '用户') + ' / 核销码 ' + h(order.checkin_code || '------') + '</em>',
          '  </div>',
          '  <span class="tag ' + orderStatusClass(order.status) + '">' + statusLabel(order.status) + '</span>',
          '</article>',
        ].join('');
      }).join('') : empty3d('暂无订单。用户订场或报名后会出现在这里。', 'venue')) + '</div>',
      '</section>',
    ].join('');
  }

  function profileShortcut(key, title, desc, icon, view, customAttr) {
    var attr = customAttr || ('data-user-view="' + h(view || 'me') + '"');
    return '<button type="button" class="profile-shortcut shortcut-' + h(icon) + '" ' + attr + '><span class="profile-shortcut-icon">' + profileIcon(icon) + '</span><strong>' + h(title) + '</strong><small>' + h(desc) + '</small></button>';
  }

  function profileMenuItem(icon, title, desc, view, customAttr) {
    var attr = customAttr || ('data-user-view="' + h(view || 'home') + '"');
    return [
      '<button type="button" class="profile-menu-item menu-' + h(icon) + '" ' + attr + '>',
      '  <span class="profile-menu-icon">' + profileIcon(icon) + '</span>',
      '  <strong>' + h(title) + '<small>' + h(desc) + '</small></strong>',
      '  <em>›</em>',
      '</button>',
    ].join('');
  }

  function profileIcon(name) {
    var attrs = 'viewBox="0 0 24 24" aria-hidden="true" focusable="false"';
    var icons = {
      ball: '<rect x="4" y="5" width="13" height="14" rx="3"></rect><path d="M4 9h13M8 3v4M13 3v4"></path><circle cx="17" cy="16" r="4"></circle><path d="M17 12l2.4 1.8-.9 2.9h-3l-.9-2.9L17 12zM14 16.7l-1.1 1.7M20 16.7l1.1 1.7"></path>',
      order: '<path d="M7 4h10a2 2 0 0 1 2 2v14l-2-1-2 1-2-1-2 1-2-1-2 1V6a2 2 0 0 1 2-2z"></path><path d="M9 8h6M9 12h6M9 16h4"></path>',
      shield: '<path d="M12 3l7 3v5c0 4.4-2.8 7.7-7 10-4.2-2.3-7-5.6-7-10V6l7-3z"></path><path d="M9 12l2 2 4-5"></path>',
      star: '<path d="M12 3.5l2.6 5.2 5.7.8-4.1 4 1 5.7L12 16.5l-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.5z"></path>',
      create: '<circle cx="12" cy="12" r="8"></circle><path d="M12 8v8M8 12h8"></path>',
      search: '<circle cx="10.5" cy="10.5" r="5.5"></circle><path d="M15 15l4 4"></path>',
      friend: '<circle cx="9" cy="9" r="3"></circle><path d="M3.5 19a5.5 5.5 0 0 1 11 0"></path><path d="M17 8v6M14 11h6"></path>',
      team: '<circle cx="8" cy="8" r="3"></circle><circle cx="17" cy="9" r="2.5"></circle><path d="M3.5 19a5.5 5.5 0 0 1 11 0"></path><path d="M14.5 18c.5-2 2-3.2 4-3.2 1.1 0 2 .3 2.8.9"></path>',
      demo: '<path d="M5 5h14v14H5z"></path><path d="M9 9h6M9 13h4"></path><path d="M8 18l3-3 2 2 3-4"></path>',
      ai: '<circle cx="8" cy="16" r="3"></circle><path d="M8 13l1.8 1.3-.7 2.2H6.9l-.7-2.2L8 13z"></path><rect x="11" y="6" width="9" height="12" rx="2"></rect><path d="M14 10l4 2-4 2v-4z"></path>',
      data: '<path d="M4 19V5"></path><path d="M4 19h16"></path><rect x="7" y="12" width="3" height="5" rx="1"></rect><rect x="12" y="8" width="3" height="9" rx="1"></rect><rect x="17" y="10" width="3" height="7" rx="1"></rect><circle cx="8" cy="6" r="2"></circle><path d="M10 7l3 2 4-3"></path>',
      support: '<path d="M6 16a4 4 0 0 1-2-3.5C4 8.4 7.6 5 12 5s8 3.4 8 7.5A4 4 0 0 1 18 16"></path><path d="M6 13v3a2 2 0 0 0 2 2h1"></path><path d="M18 13v3a2 2 0 0 1-2 2h-1"></path><path d="M9 12h.01M15 12h.01M10 16h4"></path>',
      feedback: '<path d="M5 5h14v10H9l-4 4V5z"></path><path d="M9 9h6M9 12h4"></path><path d="M18 18l2 2M20 18l-2 2"></path>',
      setting: '<circle cx="12" cy="12" r="3"></circle><path d="M19 12a7.8 7.8 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8.6 8.6 0 0 0-1.8-1L14.4 3h-4.8l-.3 3.1a8.6 8.6 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.5a7.8 7.8 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a8.6 8.6 0 0 0 1.8 1l.3 3.1h4.8l.3-3.1a8.6 8.6 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5a7.8 7.8 0 0 0 .1-1z"></path>',
    };
    return '<svg ' + attrs + '>' + (icons[name] || icons.star) + '</svg>';
  }

  function supportWindow() {
    var messages = state.supportMessages.length ? state.supportMessages : [
      { from: 'bot', text: '你好，我是 SnapSport 在线客服。这里是黑客松演示窗口，可以快速查看报名、取消、信用分和发局规则。' },
    ];
    var questions = ['怎么报名球局？', '如何取消订单？', '信用分怎么恢复？', '如何发起组局？'];
    return [
      '<div class="support-backdrop" data-close-support>',
      '  <section class="support-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      '    <div class="support-head"><div><span>在线客服 · 演示版</span><strong>SnapSport 助手</strong></div><button type="button" data-close-support>关闭</button></div>',
      '    <div class="support-demo-note">黑客松演示用：当前为本地模拟客服，正式版可接入微信客服或人工工单。</div>',
      '    <div class="support-messages">' + messages.map(function (item) {
        return '<div class="support-msg ' + (item.from === 'user' ? 'is-user' : 'is-bot') + '">' + h(item.text) + '</div>';
      }).join('') + '</div>',
      '    <div class="support-questions">' + questions.map(function (item) {
        return '<button type="button" data-support-question="' + h(item) + '">' + h(item) + '</button>';
      }).join('') + '</div>',
      '    <form class="support-input" data-support-form>',
      '      <input name="message" placeholder="输入问题，演示版会本地回复" autocomplete="off" />',
      '      <button type="submit">发送</button>',
      '    </form>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function supportReply(question) {
    if (question.indexOf('报名') >= 0) return '在首页或“看球局”选择一场球局，点击报名支付即可。演示版会生成待支付订单和核销码。';
    if (question.indexOf('取消') >= 0) return '正式版会在开场前设置可取消时间；当前演示版可用“演示重置”清空待支付/测试订单。';
    if (question.indexOf('信用') >= 0) return '按时到场、组织球局和获得队友好评都会恢复信用分；爽约会扣分，低于 80 分会限制公开局报名，低于 60 分会限制发局和订场。';
    if (question.indexOf('发起') >= 0 || question.indexOf('组局') >= 0) return '点击底部“发局”或首页“立即组局”，填写时间、地点、人数和费用后提交。';
    return '已收到。黑客松演示版先用本地模拟客服，正式版可接入微信客服或人工工单。';
  }

  function settingsWindow() {
    var me = state.data.me || {};
    var orders = state.data.myOrders || [];
    var notifications = notificationList();
    return [
      '<div class="settings-backdrop" data-close-settings>',
      '  <section class="settings-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      '    <div class="settings-head">',
      '      <div><span>Hackathon Settings</span><h3>演示设置</h3><p>用于展示隐私、通知、信用和数据接入能力。</p></div>',
      '      <button type="button" data-close-settings>关闭</button>',
      '    </div>',
      '    <div class="settings-status-grid">',
      settingsStatus('信用分', me.credit_score || 100, '守约账户'),
      settingsStatus('订单', orders.length, '本地数据库'),
      settingsStatus('消息', notifications.length, '通知中心'),
      '    </div>',
      '    <div class="settings-group">',
      '      <h4>演示模式</h4>',
      settingsToggle('黑客松讲解模式', '开启后突出主闭环入口', true),
      settingsToggle('液态玻璃主题', '当前绿色运动视觉系统', true),
      settingsToggle('展示模拟数据', '用于无真实场馆时演示完整流程', true),
      '    </div>',
      '    <div class="settings-group">',
      '      <h4>通知与隐私</h4>',
      settingsToggle('开赛提醒', '开场前推送报名和核销提醒', true),
      settingsToggle('互评提醒', '赛后 24 小时内提示完成互评', true),
      settingsToggle('匿名互评', '默认隐藏评价人身份', true),
      '    </div>',
      '    <div class="settings-group">',
      '      <h4>正式版接入</h4>',
      settingsLink('微信服务通知', '待接入订阅消息与客服工单'),
      settingsLink('真实地图定位', '接入附近场馆距离与路线'),
      settingsLink('隐私与数据导出', '用户可导出报名、信用和评分记录'),
      '    </div>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function settingsStatus(label, value, note) {
    return '<div class="settings-status"><span>' + h(label) + '</span><strong>' + h(value) + '</strong><small>' + h(note) + '</small></div>';
  }

  function settingsToggle(title, desc, checked) {
    return '<button type="button" class="settings-row" data-settings-demo><span><strong>' + h(title) + '</strong><small>' + h(desc) + '</small></span><em class="' + (checked ? 'is-on' : '') + '"></em></button>';
  }

  function settingsLink(title, desc) {
    return '<button type="button" class="settings-row" data-settings-demo><span><strong>' + h(title) + '</strong><small>' + h(desc) + '</small></span><b>›</b></button>';
  }

  function profileEditSheet() {
    var user = session() || {};
    var nickname = profileDemoValue('nickname', user.username || user.name || 'demo_player');
    var city = profileDemoValue('city', '南京');
    var sport = profileDemoValue('sport', '足球 / 篮球');
    var bio = profileDemoValue('bio', 'SnapSport 球友');
    var privacy = profileDemoValue('privacy', '公开约球资料');
    return [
      '<div class="profile-edit-backdrop" data-close-profile-edit>',
      '  <section class="profile-edit-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      '    <div class="profile-edit-head">',
      '      <div><span>Hackathon Profile</span><h3>编辑展示资料</h3><p>用于演示个人主页、约球偏好和隐私展示，不修改真实登录账号。</p></div>',
      '      <button type="button" data-close-profile-edit>关闭</button>',
      '    </div>',
      '    <form class="profile-edit-form" data-profile-edit-form>',
      '      <div class="profile-edit-preview">',
      '        <span class="profile-avatar">' + h(initials(nickname)) + '</span>',
      '        <div><strong data-profile-preview-name>' + h(nickname) + '</strong><small data-profile-preview-meta>' + h(city) + ' · ' + h(bio) + '</small><em>' + h(sport) + '</em></div>',
      '      </div>',
      '      <div class="profile-edit-grid">',
      field('昵称', '<input name="nickname" maxlength="24" value="' + h(nickname) + '" data-profile-preview-input="name" />'),
      field('城市 / 校区', '<input name="city" maxlength="24" value="' + h(city) + '" data-profile-preview-input="city" />'),
      field('主玩项目', '<select name="sport" data-profile-preview-input="sport"><option value="足球 / 篮球"' + (sport === '足球 / 篮球' ? ' selected' : '') + '>足球 / 篮球</option><option value="足球"' + (sport === '足球' ? ' selected' : '') + '>足球</option><option value="篮球"' + (sport === '篮球' ? ' selected' : '') + '>篮球</option><option value="羽毛球 / 跑步"' + (sport === '羽毛球 / 跑步' ? ' selected' : '') + '>羽毛球 / 跑步</option></select>'),
      field('展示权限', '<select name="privacy"><option value="公开约球资料"' + (privacy === '公开约球资料' ? ' selected' : '') + '>公开约球资料</option><option value="仅同场球友可见"' + (privacy === '仅同场球友可见' ? ' selected' : '') + '>仅同场球友可见</option><option value="隐藏评分细节"' + (privacy === '隐藏评分细节' ? ' selected' : '') + '>隐藏评分细节</option></select>'),
      '      </div>',
      field('一句话介绍', '<textarea name="bio" maxlength="80" data-profile-preview-input="bio">' + h(bio) + '</textarea>'),
      '      <div class="profile-edit-chips" aria-label="展示标签">',
      '        <span>黑客松展示</span><span>守约账户</span><span>约局偏好</span><span>隐私开关</span>',
      '      </div>',
      '      <div class="profile-edit-actions">',
      '        <button class="secondary-btn" type="button" data-close-profile-edit>取消</button>',
      '        <button class="primary-btn" type="submit">保存展示资料</button>',
      '      </div>',
      '    </form>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function friendAddSheet() {
    var added = new Set((state.addedFriends || []).map(String));
    return [
      '<div class="friend-add-backdrop" data-close-friend-add>',
      '  <section class="friend-add-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      '    <div class="friend-add-head">',
      '      <div><span>Team Finder</span><h3>添加球友</h3><p>黑客松展示版：根据项目、校区和活跃时间推荐附近球友。</p></div>',
      '      <button type="button" data-close-friend-add>关闭</button>',
      '    </div>',
      '    <div class="friend-add-summary">',
      '      <strong>' + h((state.addedFriends || []).length) + '</strong><span>已添加展示球友</span><em>可用于组局邀请、队伍补位和赛后互评演示</em>',
      '    </div>',
      '    <div class="friend-recommend-list">',
      friendRecommendations().map(function (friend) {
        var isAdded = added.has(String(friend.id));
        return [
          '<article class="friend-card">',
          '  <span class="friend-avatar">' + h(initials(friend.name)) + '</span>',
          '  <div class="friend-main">',
          '    <div><strong>' + h(friend.name) + '</strong><span class="tag blue">' + h(friend.level) + '</span></div>',
          '    <p>' + h(friend.city) + ' · ' + h(friend.sport) + '</p>',
          '    <small>' + h(friend.note) + '</small>',
          '  </div>',
          '  <button type="button" class="' + (isAdded ? 'secondary-btn' : 'primary-btn') + ' small-btn" data-add-friend="' + h(friend.id) + '"' + (isAdded ? ' disabled' : '') + '>' + (isAdded ? '已添加' : '添加') + '</button>',
          '</article>',
        ].join('');
      }).join(''),
      '    </div>',
      '  </section>',
      '</div>',
    ].join('');
  }

  function messagesView() {
    var messages = notificationList();
    return [
      '<section class="section">',
      '  <div class="panel-title"><h3>消息中心</h3><span>报名、核销、互评提醒</span></div>',
      messages.length ? '<div class="message-list">' + messages.map(function (item) {
        var canMarkRead = item.id && item.status === 'unread';
        var statusText = item.status === 'unread' ? '未读' : item.status === 'demo' ? '演示' : '已读';
        var statusClass = item.status === 'unread' ? 'green' : item.status === 'demo' ? 'blue' : 'gray';
        return '<article class="message-card ' + (item.status === 'unread' ? 'is-unread' : '') + '"><div><span class="message-type">' + h(item.type || '系统通知') + '</span><strong>' + h(item.title) + '</strong><p>' + h(item.body) + '</p></div><div class="message-side"><span>' + h(item.time) + '</span>' + (canMarkRead ? '<button class="secondary-btn small-btn" type="button" data-read-notification="' + h(item.id) + '">已读</button>' : '<span class="tag ' + statusClass + '">' + h(statusText) + '</span>') + '</div></article>';
      }).join('') + '</div>' : empty3d('暂无消息', 'message'),
      '</section>',
    ].join('');
  }

  function teamsView() {
    var teams = state.data.teams || [];
    return [
      '<section class="section layout-2">',
      '  <div>',
      '    <div class="panel-title"><h3>球队简版</h3><span>队长、成员、固定训练入口</span></div>',
      '    <div class="cards-grid">' + (teams.length ? teams.map(teamCard).join('') : empty3d('暂无球队，先创建一个样板队。', 'team')) + '</div>',
      '  </div>',
      '  <div class="form-panel">',
      '    <h3>创建球队</h3>',
      '    <form class="form-grid" data-create-team>',
      field('球队名称', '<input name="name" required maxlength="80" value="江宁周末足球队" />'),
      field('运动类型', '<select name="sport"><option value="football">足球</option><option value="basketball">篮球</option></select>'),
      field('活动区域', '<input name="area" value="江宁大学城" />'),
      field('成员上限', '<input name="member_limit" type="number" min="5" max="80" value="20" />'),
      field('球队说明', '<textarea name="description" maxlength="500">固定周末训练，优先招长期稳定到场的球友。</textarea>'),
      '      <button class="primary-btn" type="submit">创建球队</button>',
      '    </form>',
      '  </div>',
      '</section>',
    ].join('');
  }

  function teamCard(team) {
    var percent = team.member_limit ? Math.min(100, Math.round(Number(team.member_count || 0) / Number(team.member_limit || 1) * 100)) : 0;
    var isCaptain = Number(team.captain_user_id) === Number((session() || {}).id || 1);
    return [
      '<article class="team-card">',
      '  <div class="team-mark">' + h(initials(team.name)) + '</div>',
      '  <div class="item-head"><h4>' + h(team.name) + '</h4><span class="tag blue">' + sportLabel(team.sport) + '</span></div>',
      '  <p>' + h(team.description || '固定约球训练队') + '</p>',
      '  <div class="item-meta"><span>' + h(team.area) + '</span><span>队长 ' + h(team.captain_username) + '</span></div>',
      '  <div class="item-meta"><span>成员 ' + h(team.member_count || 0) + '/' + h(team.member_limit || 0) + '</span><div class="progress"><span style="width:' + percent + '%"></span></div></div>',
      '  <div class="split-row"><span class="tag ' + (team.is_member ? '' : 'orange') + '">' + (team.is_member ? (isCaptain ? '我是队长' : '已加入') : '可加入') + '</span><button class="secondary-btn" type="button" data-join-team="' + h(team.id) + '"' + (team.is_member ? ' disabled' : '') + '>加入球队</button></div>',
      '</article>',
    ].join('');
  }

  function aiClipsView() {
    var clips = state.data.clips || [];
    var games = state.data.games || [];
    var analyzed = state.aiDemoAnalyzed;
    return [
      '<section class="section layout-2">',
      '  <div class="panel ai-panel">',
      '    <div class="panel-title"><h3>AI 高光集锦</h3><span>进球识别 Demo</span></div>',
      '    <div class="ai-demo-player">',
      '      <video src="/assets/snap-goal-demo.mp4" controls playsinline preload="metadata"></video>',
      '      <div class="ai-demo-overlay ' + (analyzed ? 'is-done' : '') + '">',
      '        <span>' + (analyzed ? '高光已生成' : '待分析') + '</span>',
      '        <strong>' + (analyzed ? '识别到 1 次进球事件' : '上传进球视频，模拟端侧 AI 识别') + '</strong>',
      '      </div>',
      '    </div>',
      '    <div class="ai-action-row">',
      '      <button class="primary-btn" type="button" data-run-ai-demo>' + (analyzed ? '重新分析' : '开始 AI 分析') + '</button>',
      '      <button class="secondary-btn" type="button" data-seek-goal-demo>跳到进球片段</button>',
      '    </div>',
      '    <div data-ai-demo-result>',
      analyzed ? aiDemoResultCard() : aiDemoPendingCard(),
      '    </div>',
      '    <form class="form-grid" data-create-clip>',
      field('关联球局', '<select name="game_id"><option value="">不关联球局</option>' + games.map(function (game) { return '<option value="' + h(game.id) + '">' + h(game.title) + '</option>'; }).join('') + '</select>'),
      field('视频链接/文件名', '<input name="video_url" value="snap-goal-demo.mp4" />'),
      field('识别类型', '<select name="clip_type"><option value="goal_detection">进球识别</option><option value="highlight_reel">自动高光集锦</option><option value="heatmap">跑动热图占位</option></select>'),
      '      <button class="primary-btn" type="submit">提交任务</button>',
      '    </form>',
      '  </div>',
      '  <div class="panel">',
      '    <div class="panel-title"><h3>我的集锦任务</h3><span>处理队列</span></div>',
      clipList(clips),
      '  </div>',
      '</section>',
    ].join('');
  }

  function aiDemoPendingCard() {
    return [
      '<div class="ai-demo-card">',
      '  <span class="tag orange">Demo 模式</span>',
      '  <h4>现场演示路径</h4>',
      '  <p>点击“开始 AI 分析”后，系统会模拟端侧视频理解流程，生成进球时间点、高光片段和可分享卡片。</p>',
      '  <div class="ai-demo-steps"><span>上传视频</span><i></i><span>识别进球</span><i></i><span>生成高光</span></div>',
      '</div>',
    ].join('');
  }

  function aiDemoResultCard() {
    return [
      '<div class="ai-result-grid">',
      '  <article><span>识别结果</span><strong>进球 1 次</strong><p>模型判断：禁区前沿射门形成有效进球。</p></article>',
      '  <article><span>高光片段</span><strong>00:08 - 00:22</strong><p>自动保留进球前 8 秒和进球后庆祝片段。</p></article>',
      '  <article><span>传播建议</span><strong>江宁周末球局高光</strong><p>适合发朋友圈/社群，用于吸引下一场报名。</p></article>',
      '</div>',
      '<div class="ai-timeline">',
      '  <div><span style="left:16%"></span><em style="left:16%">起脚</em><span class="is-goal" style="left:48%"></span><em style="left:48%">进球</em><span style="left:76%"></span><em style="left:76%">庆祝</em></div>',
      '</div>',
      '<div class="ai-share-card">',
      '  <div><span class="tag">可分享</span><h4>AI 已生成进球高光</h4><p>1 次进球 · 14 秒高光 · SnapSport 自动生成</p></div>',
      '  <button class="secondary-btn" type="button" data-profile-toast="演示版已生成分享卡片，正式版可保存到相册">保存分享卡</button>',
      '</div>',
    ].join('');
  }

  function markAiDemoAnalyzed() {
    var wasAnalyzed = state.aiDemoAnalyzed;
    state.aiDemoAnalyzed = true;
    var overlay = app.querySelector('.ai-demo-overlay');
    if (overlay) {
      overlay.classList.add('is-done');
      var label = overlay.querySelector('span');
      var title = overlay.querySelector('strong');
      if (label) label.textContent = '高光已生成';
      if (title) title.textContent = '识别到 1 次进球事件';
    }
    var runButton = app.querySelector('[data-run-ai-demo]');
    if (runButton) runButton.textContent = '重新分析';
    var result = app.querySelector('[data-ai-demo-result]');
    if (result && !wasAnalyzed) result.innerHTML = aiDemoResultCard();
  }

  function clipList(clips) {
    if (!clips.length) return empty3d('还没有集锦任务，提交一段比赛视频即可生成队列记录。', 'clip');
    return '<div class="compact-list">' + clips.map(function (clip) {
      return '<article class="compact-order"><div><strong>' + h(clip.game_title || '比赛高光') + '</strong><span>' + h(clip.video_url || '比赛视频') + ' / ' + h(clip.demo_result || '等待处理') + '</span></div><span class="tag orange">' + h(clip.status) + '</span></article>';
    }).join('') + '</div>';
  }

  function dataUploadView() {
    var uploads = state.data.uploads || [];
    return [
      '<section class="section layout-2">',
      '  <div class="panel data-panel">',
      '    <div class="panel-title"><h3>运动档案</h3><span>训练与比赛记录</span></div>',
      '    <div class="feature-hero data-hero">',
      '      <div><span class="tag blue">授权与质量评分</span><h4>记录第一视角 / 场馆视频数据贡献意向</h4><p>先记录授权、来源、质量评分和奖励状态，后续接入真实文件上传、隐私处理和个人运动报告。</p></div>',
      '    </div>',
      '    <form class="form-grid" data-create-upload>',
      field('数据类型', '<select name="data_type"><option value="egocentric_video">第一视角视频</option><option value="venue_camera">场馆固定机位</option><option value="wearable_trace">可穿戴轨迹</option></select>'),
      field('采集来源', '<input name="source" value="手机/运动相机" />'),
      field('授权范围', '<select name="consent_scope"><option value="training_anonymized">脱敏后用于训练分析</option><option value="product_demo">仅用于产品体验</option><option value="personal_report">仅生成个人报告</option></select>'),
      field('数据说明', '<textarea name="note" maxlength="500">5 人制足球，包含奔跑、急停、变向和对抗片段。</textarea>'),
      '      <button class="primary-btn" type="submit">提交数据意向</button>',
      '    </form>',
      '  </div>',
      '  <div class="panel">',
      '    <div class="panel-title"><h3>我的记录</h3><span>质量评分</span></div>',
      uploadList(uploads),
      '  </div>',
      '</section>',
    ].join('');
  }

  function uploadList(uploads) {
    if (!uploads.length) return empty3d('暂无运动档案记录。先提交一条授权意向，后续可生成个人运动报告。', 'data');
    return '<div class="compact-list">' + uploads.map(function (upload) {
      return '<article class="compact-order"><div><strong>' + h(upload.data_type) + '</strong><span>' + h(upload.source) + ' / 授权：' + h(upload.consent_scope) + '</span></div><div class="order-code"><span>质量分</span><strong>' + h(upload.quality_score || 0) + '</strong></div><span class="tag">' + h(upload.reward_status) + '</span></article>';
    }).join('') + '</div>';
  }

  function demoView() {
    var me = state.data.me || {};
    var orderDone = (state.data.myOrders || []).length > 0;
    var teamDone = (state.data.teams || []).some(function (team) { return team.is_member; });
    var clipDone = (state.data.clips || []).length > 0;
    var uploadDone = (state.data.uploads || []).length > 0;
    var rating = ratingSummary();
    var steps = [
      ['登录账号', true, '复用现有 MySQL 登录系统'],
      ['订场/报名生成订单', orderDone, '从找球场订场，或在看球局里报名支付'],
      ['发布或加入球队', teamDone, '球队简版证明 PRD 里的球队管理入口'],
      ['完成实力自评', Number(rating.self_score || 0) > 0, '个人中心提交 5 维能力'],
      ['提交高光任务', clipDone, '提交比赛视频，生成高光任务'],
      ['提交运动档案', uploadDone, '记录授权范围和数据来源'],
    ];
    return [
      '<section class="section demo-layout">',
      '  <div class="panel">',
      '    <div class="panel-title"><h3>完整流程</h3><span>先看主线，再看扩展</span></div>',
      '    <div class="demo-steps">' + steps.map(function (step, index) {
        return '<article class="demo-step ' + (step[1] ? 'is-done' : '') + '"><strong>' + h(index + 1) + '</strong><div><h4>' + h(step[0]) + '</h4><p>' + h(step[2]) + '</p></div><span>' + (step[1] ? '已完成' : '待完成') + '</span></article>';
      }).join('') + '</div>',
      '  </div>',
      '  <div class="panel">',
      '    <div class="panel-title"><h3>推荐使用顺序</h3><span>给别人看时按这个走</span></div>',
      '    <div class="story-list">',
      '      <button type="button" data-jump-view="venues">1. 找球场并选择时段</button>',
      '      <button type="button" data-jump-view="games">2. 报名一场附近球局</button>',
      '      <button type="button" data-jump-view="teams">3. 创建/加入球队</button>',
      '      <button type="button" data-jump-view="me">4. 展示信用与实力评级</button>',
      '      <button type="button" data-jump-view="ai">5. 提交高光任务</button>',
      '      <button type="button" data-jump-view="data">6. 提交运动档案</button>',
      '    </div>',
      '    <div class="panel-soft-block"><strong>当前账号</strong><p>' + h((session() || {}).username || (session() || {}).name || 'demo_player') + ' / 信用分 ' + h(me.credit_score || 100) + '。这条路径覆盖主闭环，并保留后续能力入口。</p></div>',
      publicJoinLocked() ? '    <div class="panel-soft-block warning-block"><strong>信用分受限</strong><p>当前分数低于 80，公开局报名会被拦截；低于 60 时发局和订场也会被拦截。</p></div>' : '',
      '  </div>',
      '</section>',
    ].join('');
  }

  function notificationList() {
    var persisted = (state.data.notifications || []).map(function (item) {
      return {
        id: item.id,
        title: item.title,
        body: item.body,
        time: fmtDate(item.create_time),
        status: item.status,
        order_id: item.related_order_id,
      };
    });
    var orders = state.data.myOrders || [];
    var rating = ratingSummary();
    var messages = persisted.slice();
    var pendingOrder = orders.find(function (order) { return order.status === 'pending_payment'; });
    if (pendingOrder) {
      messages.push({
        title: '你有一笔订单待支付',
        body: (pendingOrder.title || '场地预订') + ' / 应付 ' + money(pendingOrder.amount) + '，支付后才会正式生效。',
        time: fmtDate(pendingOrder.create_time),
        order_id: pendingOrder.id,
      });
    }
    if (orders.length) {
      var latest = orders[0];
      messages.push({
        title: latest.status === 'paid' ? '支付成功，等待核销' : latest.status === 'checked_in' ? '订单已核销' : '最新订单记录',
        body: (latest.title || '场地预订') + ' / ' + statusLabel(latest.status) + (latest.checkin_code ? ' / 核销码 ' + latest.checkin_code : ''),
        time: fmtDate(latest.create_time || latest.start_time),
      });
    }
    (state.data.games || []).forEach(function (game) {
      if (game.is_joined && game.status === 'locked') {
        messages.push({
          title: '球局已锁局',
          body: (game.title || '附近球局') + ' 已满员锁局，请按时到场。',
          time: fmtDate(game.start_time),
        });
      }
      if (game.is_joined && game.status === 'pending_checkin') {
        messages.push({
          title: '开赛提醒',
          body: (game.title || '附近球局') + ' 即将开始，请到场后完成核销。',
          time: fmtDate(game.start_time),
        });
      }
      if (game.is_joined && game.status === 'review_open') {
        messages.push({
          title: '赛后互评已开启',
          body: (game.title || '附近球局') + ' 结束后 24 小时内可完成互评。',
          time: fmtDate(game.end_time),
        });
      }
    });
    (state.data.clips || []).forEach(function (clip) {
      messages.push({
        title: '集锦任务已生成',
        body: (clip.game_title || '比赛高光') + ' / ' + (clip.demo_result || '等待处理'),
        time: fmtDate(clip.create_time),
      });
    });
    if (Number(rating.effective_peer_games || 0) > 0) {
      messages.push({
        title: '实力评级已更新',
        body: '当前综合等级 ' + (rating.level_label || '进阶') + '，综合分 ' + oneDecimal(rating.composite_score, 3) + ' 分。',
        time: fmtDate(rating.update_time),
      });
    }
    if (!messages.length) {
      messages = demoNotifications();
    }
    return messages.slice(0, 80);
  }

  function demoNotifications() {
    return [
      {
        type: '报名提醒',
        title: '今晚 19:30 足球局报名成功',
        body: '江宁大学城五人制足球局已为你保留名额，当前 8/10 人，成局后会自动锁局。',
        time: '今天 14:26',
        status: 'unread',
      },
      {
        type: '核销提醒',
        title: '到场后出示核销码 S8271',
        body: '南京合作足球馆 A 场，开赛前 15 分钟可在场馆前台完成核销。',
        time: '今天 17:45',
        status: 'demo',
      },
      {
        type: '开赛提醒',
        title: '球局即将开始',
        body: '距离开赛还有 45 分钟，建议提前到场热身。若临时无法参加，请尽快联系队长。',
        time: '今天 18:45',
        status: 'demo',
      },
      {
        type: '互评提醒',
        title: '赛后互评将在结束后开放',
        body: '完成匿名互评后，系统会更新你的信用记录与五维实力评分。',
        time: '明天 21:30',
        status: 'demo',
      },
      {
        type: '场馆动态',
        title: '大学城室内篮球馆新增黄金时段',
        body: '周六 18:00-20:00 已开放预约，可在订场页按“黄金时段”筛选。',
        time: '昨天 20:18',
        status: 'demo',
      },
      {
        type: 'AI 集锦',
        title: '比赛高光任务已进入队列',
        body: '演示版将生成进球片段、跑动热区和可分享的社群文案。',
        time: '06-17 22:12',
        status: 'demo',
      },
    ];
  }

  function myOrderList(orders, emptyText) {
    if (!orders.length) return '<div class="empty">' + h(emptyText || '还没有订单。先去找球场预订，或报名一场附近球局。') + '</div>';
    return [
      '<div class="compact-list">',
      orders.map(function (order) {
        var canPay = order.status === 'pending_payment';
        var canCheckin = Boolean(order.can_checkin);
        var next = orderNextAction(order);
        var hint = exceptionHint(order);
        var checkinHint = order.status === 'paid' && !canCheckin ? (order.checkin_hint || '未到核销时间') : '';
        return [
          '<article class="compact-order ' + (String(state.highlightOrderId || '') === String(order.id) ? 'is-highlighted' : '') + '">',
          '  <div>',
          '    <strong>' + h(order.title || '场地预订') + '</strong>',
          '    <span>' + h(order.venue_name) + ' / ' + fmtDate(order.start_time || order.booking_start_time || order.create_time) + (order.booking_end_time ? ' - ' + fmtDate(order.booking_end_time) : '') + '</span>',
          '    <em>' + h(next.title) + '：' + h(next.body) + '</em>',
          hint ? '    <small>' + h(hint) + '</small>' : '',
          checkinHint ? '    <small>' + h(checkinHint) + '</small>' : '',
          '  </div>',
          '  <div class="order-code">',
          '    <span>核销码</span>',
          '    <strong>' + h(order.checkin_code) + '</strong>',
          '  </div>',
          canPay ? '<button class="primary-btn small-btn" type="button" data-open-payment="' + h(order.id) + '">去支付</button>' : '',
          order.status === 'paid' ? '<button class="secondary-btn small-btn" type="button" ' + (canCheckin ? 'data-checkin-order="' + h(order.id) + '"' : 'disabled') + '>' + (canCheckin ? '去核销' : h(order.checkin_hint || '未到核销')) + '</button>' : '',
          order.game_id ? '<button class="secondary-btn small-btn" type="button" data-review-game="' + h(order.game_id) + '">去互评</button>' : '',
          '  <span class="tag ' + orderStatusClass(order.status) + '">' + statusLabel(order.status) + '</span>',
          '</article>',
        ].join('');
      }).join(''),
      '</div>',
    ].join('');
  }

  function userMode() {
    var body = {
      home: function () { return ''; },
      venues: venuesView,
      games: gamesView,
      'my-games': myGamesView,
      create: createView,
      teams: teamsView,
      ai: aiClipsView,
      data: dataUploadView,
      favorites: favoritesView,
      demo: demoView,
      messages: messagesView,
      orders: myOrdersView,
      'venue-admin': venueAdminView,
      credit: creditView,
      legal: legalView,
      me: meView,
    }[state.userView]();
    var isHome = state.userView === 'home';
    return (isHome ? hero() : body) + mobileTabbar();
  }

  function mobileTabbar() {
    var tabs = [
      ['home', '首页'],
      ['venues', '订场'],
      ['games', '球局'],
      ['messages', '消息'],
    ];
    var tabViews = tabs.map(function (item) { return item[0]; }).concat('me');
    var activeIndex = tabViews.indexOf(state.userView);
    var fromIndex = typeof state.mobileTabFromIndex === 'number' ? state.mobileTabFromIndex : activeIndex;
    var isMoving = activeIndex >= 0 && fromIndex >= 0 && fromIndex !== activeIndex;
    var tabbarClass = 'mobile-tabbar' + (activeIndex >= 0 ? ' has-active-tab' : '') + (isMoving ? ' is-tab-moving' : '');
    var tabbar = '<nav class="' + tabbarClass + '" style="--tab-index: ' + activeIndex + '; --tab-from-index: ' + fromIndex + ';">' + tabs.map(function (item) {
      return '<button type="button" data-user-view="' + item[0] + '" class="mobile-tab-' + h(item[0]) + (state.userView === item[0] ? ' is-active' : '') + '"><span aria-hidden="true"></span><strong>' + h(item[1]) + '</strong></button>';
    }).join('') + '<button type="button" data-user-view="me" class="mobile-tab-me' + (state.userView === 'me' ? ' is-active' : '') + '"><span aria-hidden="true"></span><strong>我的</strong></button></nav>';
    if (activeIndex >= 0) state.mobileTabFromIndex = activeIndex;
    return tabbar;
  }

  function mobileMoreSheet() {
    if (!state.mobileMoreOpen) return '';
    var items = [
      ['create', '发起组局', '发布足球/篮球局，生成报名与支付链路', 'primary'],
      ['me', '我的', '个人资料、钱包、快捷入口', ''],
      ['orders', '订单/核销', '支付、核销码、退款与互评入口', ''],
      ['teams', '球队', '创建或加入固定球队', ''],
      ['credit', '守约账户', '信用分、扣分和恢复记录', ''],
      ['my-games', '我的球局', '已报名和待处理球局', ''],
      ['ai', 'AI 高光', '提交视频并生成高光任务', ''],
      ['data', '运动档案', '授权记录和运动数据', ''],
      ['favorites', '收藏', '常用场馆与关注球局', ''],
      ['demo', '完整流程', '演示主线与扩展能力', ''],
    ];
    return [
      '<div class="mobile-more-backdrop" data-close-mobile-more>',
      '  <section class="mobile-more-sheet" role="dialog" aria-modal="true" onclick="event.stopPropagation()">',
      '    <div class="mobile-more-handle"></div>',
      '    <div class="mobile-more-head">',
      '      <div><span>宁约球</span><h3>更多功能</h3></div>',
      '      <button type="button" data-close-mobile-more>关闭</button>',
      '    </div>',
      '    <div class="mobile-more-quick">',
      '      <button type="button" data-focus-search><strong>搜索</strong><span>找场馆/球局</span></button>',
      '      <button type="button" data-open-friend-add><strong>加好友</strong><span>推荐球友</span></button>',
      '    </div>',
      '    <div class="mobile-more-grid">',
      items.map(function (item) {
        return '<button type="button" data-user-view="' + h(item[0]) + '" class="' + (item[3] ? 'is-primary' : '') + '"><strong>' + h(item[1]) + '</strong><span>' + h(item[2]) + '</span></button>';
      }).join(''),
      '    </div>',
      '  </section>',
      '</div>',
    ].join('');
  }
  function venueMode() {
    var venues = state.data.venues;
    var orders = state.data.orders || [];
    return [
      '<section class="section layout-2">',
      '  <div>',
      '    <div class="panel-title"><h3>场地管理</h3><span>添加 / 编辑场地</span></div>',
      '    <div class="cards-grid">' + venues.map(venueCard).join('') + '</div>',
      '  </div>',
      '  <div class="form-panel">',
      '    <h3>新增合作场馆</h3>',
      '    <form class="form-grid" data-create-venue>',
      field('场馆名称', '<input name="name" required placeholder="例如：江宁合作足球馆" />'),
      field('区域', '<input name="area" required placeholder="例如：江宁大学城" />'),
      field('地址', '<input name="address" required placeholder="请输入详细地址" />'),
      field('每小时价格', '<input name="price_per_hour" type="number" value="200" />'),
      field('联系人', '<input name="contact" placeholder="联系人 / 电话" />'),
      field('场地类型', '<select name="sports"><option value="football,basketball">足球 + 篮球</option><option value="football">足球</option><option value="basketball">篮球</option></select>'),
      '      <button class="primary-btn" type="submit">提交审核</button>',
      '    </form>',
      '  </div>',
      '</section>',
      '<section class="section panel">',
      '  <div class="panel-title"><h3>订单管理 / 核销</h3><span>扫码核销入口</span></div>',
      orderTable(orders),
      '</section>',
    ].join('');
  }

  function orderTable(orders) {
    if (!orders.length) return '<div class="empty">暂无订单，先报名一场球局或预订一个场地。</div>';
    return [
      '<div class="table-wrap"><table>',
      '<thead><tr><th>订单</th><th>用户</th><th>球局</th><th>场馆</th><th>金额</th><th>核销码</th><th>状态</th><th>操作</th></tr></thead>',
      '<tbody>',
      orders.map(function (order) {
        var canCheckin = Boolean(order.can_checkin);
        var next = orderNextAction(order);
        return [
          '<tr>',
          '<td>#' + h(order.id) + '</td>',
          '<td>' + h(order.username) + '</td>',
          '<td>' + h(order.title || '场地预订') + '</td>',
          '<td>' + h(order.venue_name) + '</td>',
          '<td>' + money(order.amount) + '</td>',
          '<td>' + h(order.checkin_code) + '</td>',
          '<td><span class="tag ' + orderStatusClass(order.status) + '">' + statusLabel(order.status) + '</span><p class="table-hint">' + h(next.title) + '</p></td>',
          '<td><button class="secondary-btn" type="button" ' + (canCheckin ? 'data-checkin-order="' + h(order.id) + '"' : 'disabled') + '>' + (canCheckin ? '核销' : h(order.checkin_hint || statusLabel(order.status))) + '</button></td>',
          '</tr>',
        ].join('');
      }).join(''),
      '</tbody></table></div>',
    ].join('');
  }

  function adminMode() {
    var metrics = state.data.metrics || {};
    return [
      '<section class="section">',
      '  <div class="panel-title"><h3>数据看板</h3><span>上线 10 天 KPI 复盘</span><button class="secondary-btn small-btn" type="button" data-demo-reset>清理当前账号数据</button></div>',
      '  <div class="metric-grid">',
      metric('今日订单', metrics.today_orders || 0),
      metric('今日收入', money(metrics.today_income || 0)),
      metric('周活跃用户', metrics.wau || 0),
      metric('发局数', metrics.total_games || 0),
      metric('合作场馆', metrics.approved_venues || 0),
      metric('订单金额', money(metrics.gmv || 0)),
      '  </div>',
      '</section>',
      '<section class="section panel">',
      '  <div class="panel-title"><h3>转化漏斗</h3><span>近 7 天核心行为埋点</span></div>',
      funnelPanel(metrics.funnel || []),
      '</section>',
      '<section class="section panel">',
      '  <div class="panel-title"><h3>场馆审核</h3><span>保证样板区质量</span></div>',
      adminVenueTable(),
      '</section>',
      '<section class="section panel">',
      '  <div class="panel-title"><h3>用户管理</h3><span>封禁 / 解封恶意爽约用户</span></div>',
      userTable(),
      '</section>',
      '<section class="section panel">',
      '  <div class="panel-title"><h3>评分核查</h3><span>人工申诉核查 / 重置分数</span></div>',
      ratingAdminTable(),
      '</section>',
    ].join('');
  }

  function funnelPanel(rows) {
    if (!rows.length) return '<div class="empty">暂无埋点数据。访问首页、订场、报名、支付后会自动生成漏斗。</div>';
    return '<div class="funnel-list">' + rows.map(function (item) {
      return [
        '<div class="funnel-row">',
        '  <span>' + h(item.label) + '</span>',
        '  <div class="funnel-bar"><i style="width:' + h(item.rate || 0) + '%"></i></div>',
        '  <strong>' + h(item.count || 0) + '</strong>',
        '</div>',
      ].join('');
    }).join('') + '</div>';
  }

  function adminVenueTable() {
    return [
      '<div class="table-wrap"><table>',
      '<thead><tr><th>场馆</th><th>区域</th><th>价格</th><th>联系人</th><th>状态</th><th>操作</th></tr></thead><tbody>',
      state.data.venues.map(function (venue) {
        return [
          '<tr>',
          '<td>' + h(venue.name) + '</td>',
          '<td>' + h(venue.area) + '</td>',
          '<td>' + money(venue.price_per_hour) + '/小时</td>',
          '<td>' + h(venue.contact) + '</td>',
          '<td><span class="tag ' + (venue.status === 'approved' ? '' : 'gray') + '">' + statusLabel(venue.status) + '</span></td>',
          '<td><button class="secondary-btn" type="button" data-approve-venue="' + h(venue.id) + '"' + (venue.status === 'approved' ? ' disabled' : '') + '>通过</button></td>',
          '</tr>',
        ].join('');
      }).join(''),
      '</tbody></table></div>',
    ].join('');
  }

  function userTable() {
    var users = state.data.users || [];
    if (!users.length) return '<div class="empty">暂无用户数据，注册或登录后会写入 MySQL。</div>';
    return [
      '<div class="table-wrap"><table>',
      '<thead><tr><th>ID</th><th>用户名</th><th>信用</th><th>参与</th><th>爽约</th><th>状态</th><th>操作</th></tr></thead><tbody>',
      users.map(function (user) {
        var disabled = Number(user.status) === 0;
        return [
          '<tr>',
          '<td>' + h(user.id) + '</td>',
          '<td>' + h(user.username) + '</td>',
          '<td>' + h(user.credit_score || 100) + '</td>',
          '<td>' + h(user.joined_games || 0) + '</td>',
          '<td>' + h(user.no_shows || 0) + '</td>',
          '<td><span class="tag ' + (disabled ? 'orange' : '') + '">' + (disabled ? '已封禁' : '正常') + '</span></td>',
          '<td><button class="' + (disabled ? 'secondary-btn' : 'danger-btn') + '" type="button" data-user-status="' + h(user.id) + '" data-next-status="' + (disabled ? 1 : 0) + '">' + (disabled ? '解封' : '封禁') + '</button></td>',
          '</tr>',
        ].join('');
      }).join(''),
      '</tbody></table></div>',
    ].join('');
  }

  function ratingAdminTable() {
    var rows = state.data.ratingRows || [];
    if (!rows.length) return '<div class="empty">暂无评分数据，用户完成自评后会出现在这里。</div>';
    return [
      '<div class="table-wrap"><table>',
      '<thead><tr><th>用户</th><th>综合</th><th>自评</th><th>互评</th><th>有效场次</th><th>互评数</th><th>更新时间</th><th>操作</th></tr></thead><tbody>',
      rows.map(function (row) {
        return [
          '<tr>',
          '<td>' + h(row.username) + '</td>',
          '<td><span class="tag">' + h(row.level_label || ratingLabel(row.composite_score)) + ' ' + oneDecimal(row.composite_score, 3) + '</span></td>',
          '<td>' + oneDecimal(row.self_score, 3) + '</td>',
          '<td>' + (row.peer_score == null ? '暂无' : oneDecimal(row.peer_score, 3)) + '</td>',
          '<td>' + h(row.effective_peer_games || 0) + '</td>',
          '<td>' + h(row.peer_rating_count || 0) + '</td>',
          '<td>' + fmtDate(row.update_time) + '</td>',
          '<td><button class="danger-btn" type="button" data-reset-rating="' + h(row.user_id) + '">重置</button></td>',
          '</tr>',
        ].join('');
      }).join(''),
      '</tbody></table></div>',
    ].join('');
  }

  function render() {
    state.mode = 'user';
    syncPreviewRoute({ replace: true });
    var content = userMode();
    app.innerHTML = topbar() + returnHomeFab() + '<main class="page">' + content + '</main>' + searchOverlay() + mobileMoreSheet() + (state.friendAddOpen ? friendAddSheet() : '') + (state.toast ? '<div class="toast">' + h(state.toast) + '</div>' : '');
    bindEvents();
  }

  function bindRadarSlider() {
    var slider = app.querySelector('.radar-slider');
    var hint = app.querySelector('.radar-scroll-hint');
    if (!slider || !hint) return;
    var dots = Array.from(hint.querySelectorAll('i'));
    var arrows = Array.from(app.querySelectorAll('[data-radar-arrow]'));
    arrows.forEach(function (arrow) {
      arrow.addEventListener('click', function () {
        var direction = arrow.getAttribute('data-radar-arrow') === 'prev' ? -1 : 1;
        slider.scrollBy({ left: direction * slider.clientWidth, behavior: 'smooth' });
      });
    });
    var update = function () {
      var pageWidth = Math.max(1, slider.clientWidth);
      var index = Math.max(0, Math.min(dots.length - 1, Math.round(slider.scrollLeft / pageWidth)));
      dots.forEach(function (dot, dotIndex) {
        dot.classList.toggle('is-active', dotIndex === index);
      });
      hint.setAttribute('data-active-page', String(index + 1));
    };
    slider.addEventListener('scroll', function () {
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  function bindEvents() {
    bindRadarSlider();
    app.querySelectorAll('[data-mode]').forEach(function (button) {
      button.addEventListener('click', async function () {
        goToUserView(button.getAttribute('data-user-view') || 'home');
        render();
        try {
          await loadBootstrap();
          render();
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-venue-search-form]').forEach(function (venueSearchForm) {
      var searchInput = venueSearchForm.querySelector('input[name="venue_search"]');
      if (searchInput) {
        searchInput.addEventListener('input', function () {
          state.venueSearch = searchInput.value;
        });
      }
      venueSearchForm.addEventListener('submit', function (event) {
        event.preventDefault();
        state.venueSearch = (searchInput && searchInput.value || '').trim();
        state.searchOpen = false;
        goToUserView(searchTargetView(state.venueSearch));
        track('venue_search', { metadata: { keyword: state.venueSearch } });
        render();
      });
    });

    app.querySelectorAll('[data-clear-venue-search]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.venueSearch = '';
        render();
      });
    });

    bindSearchQuickCards();

    app.querySelectorAll('[data-focus-search]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.mobileMoreOpen = false;
        state.searchOpen = true;
        render();
        setTimeout(function () {
          var input = app.querySelector('[data-search-autofocus]');
          if (input) input.focus();
        }, 0);
      });
    });

    app.querySelectorAll('[data-close-search]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.searchOpen = false;
        render();
      });
    });

    app.querySelectorAll('[data-search-intent]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.searchIntent = button.getAttribute('data-search-intent') || 'recommend';
        refreshSearchOverlay();
      });
    });

    app.querySelectorAll('[data-user-view]:not([data-mode]), [data-jump-view]').forEach(function (button) {
      button.addEventListener('click', function () {
        var projectFilter = button.getAttribute('data-project-filter');
        if (projectFilter) state.sportFilter = projectFilter;
        var quickVenueSort = button.getAttribute('data-quick-venue-sort');
        if (quickVenueSort) state.venueSort = quickVenueSort;
        var targetView = button.getAttribute('data-user-view') || button.getAttribute('data-jump-view');
        var tabbar = button.closest('.mobile-tabbar');
        if (tabbar && previewMobileTabMove(tabbar, targetView)) return;
        var fromPrimaryTab = Boolean(tabbar) || button.hasAttribute('data-user-view');
        goToUserView(targetView, fromPrimaryTab ? { replace: true, replaceUrl: true } : null);
        render();
      });
      button.addEventListener('keydown', function (event) {
        if (!['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        button.click();
      });
    });

    app.querySelectorAll('[data-nav-back]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (button.disabled) return;
        navigateBack();
      });
    });

    app.querySelectorAll('[data-return-home]').forEach(function (button) {
      button.addEventListener('click', async function () {
        goToUserView('home', { replace: true, replaceUrl: true });
        render();
        try {
          await loadBootstrap();
          render();
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-open-support]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.supportOpen = true;
        render();
      });
    });

    app.querySelectorAll('[data-close-support]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.supportOpen = false;
        render();
      });
    });

    app.querySelectorAll('[data-open-settings]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.settingsOpen = true;
        render();
      });
    });

    app.querySelectorAll('[data-close-settings]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.settingsOpen = false;
        render();
      });
    });

    app.querySelectorAll('[data-open-profile-edit]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.profileEditOpen = true;
        render();
      });
    });

    app.querySelectorAll('[data-close-profile-edit]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.profileEditOpen = false;
        render();
      });
    });

    app.querySelectorAll('[data-open-friend-add]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.mobileMoreOpen = false;
        state.friendAddOpen = true;
        render();
      });
    });

    app.querySelectorAll('[data-close-friend-add]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.friendAddOpen = false;
        render();
      });
    });

    app.querySelectorAll('[data-open-mobile-more]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.mobileMoreOpen = true;
        render();
      });
    });

    app.querySelectorAll('[data-close-mobile-more]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.mobileMoreOpen = false;
        render();
      });
    });

    app.querySelectorAll('[data-add-friend]').forEach(function (button) {
      button.addEventListener('click', function () {
        var friendId = button.getAttribute('data-add-friend');
        var next = Array.from(new Set([].concat(state.addedFriends || [], friendId).filter(Boolean).map(String)));
        saveAddedFriends(next);
        render();
        showToast('已添加推荐球友');
      });
    });

    var profileEditForm = app.querySelector('[data-profile-edit-form]');
    if (profileEditForm) {
      var syncProfilePreview = function () {
        var nickname = (profileEditForm.querySelector('[name="nickname"]') || {}).value || '球友';
        var city = (profileEditForm.querySelector('[name="city"]') || {}).value || '南京';
        var bio = (profileEditForm.querySelector('[name="bio"]') || {}).value || 'SnapSport 球友';
        var sport = (profileEditForm.querySelector('[name="sport"]') || {}).value || '足球 / 篮球';
        var nameNode = profileEditForm.querySelector('[data-profile-preview-name]');
        var metaNode = profileEditForm.querySelector('[data-profile-preview-meta]');
        var sportNode = profileEditForm.querySelector('.profile-edit-preview em');
        if (nameNode) nameNode.textContent = nickname;
        if (metaNode) metaNode.textContent = city + ' · ' + bio;
        if (sportNode) sportNode.textContent = sport;
      };
      profileEditForm.addEventListener('input', syncProfilePreview);
      profileEditForm.addEventListener('change', syncProfilePreview);
      profileEditForm.addEventListener('submit', function (event) {
        event.preventDefault();
        saveProfileDemo({
          nickname: (profileEditForm.querySelector('[name="nickname"]') || {}).value || '',
          city: (profileEditForm.querySelector('[name="city"]') || {}).value || '',
          sport: (profileEditForm.querySelector('[name="sport"]') || {}).value || '',
          privacy: (profileEditForm.querySelector('[name="privacy"]') || {}).value || '',
          bio: (profileEditForm.querySelector('[name="bio"]') || {}).value || '',
        });
        state.profileEditOpen = false;
        render();
        showToast('展示资料已更新');
      });
    }

    app.querySelectorAll('[data-settings-demo]').forEach(function (button) {
      button.addEventListener('click', function () {
        showToast('演示版展示设置入口，正式版接入真实配置');
      });
    });

    app.querySelectorAll('[data-support-question]').forEach(function (button) {
      button.addEventListener('click', function () {
        var question = button.getAttribute('data-support-question') || '';
        state.supportMessages.push({ from: 'user', text: question });
        state.supportMessages.push({ from: 'bot', text: supportReply(question) });
        render();
      });
    });

    var supportForm = app.querySelector('[data-support-form]');
    if (supportForm) {
      supportForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var input = supportForm.querySelector('input[name="message"]');
        var message = (input && input.value || '').trim();
        if (!message) return;
        state.supportMessages.push({ from: 'user', text: message });
        state.supportMessages.push({ from: 'bot', text: supportReply(message) });
        render();
      });
    }

    app.querySelectorAll('[data-profile-toast]').forEach(function (button) {
      button.addEventListener('click', function () {
        showToast(button.getAttribute('data-profile-toast') || '正式版接入');
      });
    });

    app.querySelectorAll('[data-area-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.venueFilter = button.getAttribute('data-area-filter');
        render();
      });
    });

    app.querySelectorAll('[data-sport-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.sportFilter = button.getAttribute('data-sport-filter');
        render();
      });
    });

    app.querySelectorAll('[data-venue-sort]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.venueSort = button.getAttribute('data-venue-sort') || 'smart';
        render();
      });
    });

    app.querySelectorAll('[data-join-game]').forEach(function (button) {
      button.addEventListener('click', async function () {
        var gameId = button.getAttribute('data-join-game');
        button.disabled = true;
        try {
          var result = await api('/api/sports-app/games/' + gameId + '/join', { method: 'POST', body: '{}' });
          state.joinConfirm = null;
          var game = (state.data.games || []).find(function (item) { return String(item.id) === String(gameId); }) || {};
          state.paymentConfirm = Object.assign({}, result, {
            title: game.title || '球局报名',
            venue_name: game.venue_name || '合作场馆',
            amount: game.fee_per_person || 0,
          });
          await loadBootstrap();
          render();
          showToast('待支付订单已生成，请完成支付');
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-open-join]').forEach(function (button) {
      button.addEventListener('click', function () {
        var gameId = Number(button.getAttribute('data-open-join'));
        state.joinConfirm = (state.data.games || []).find(function (game) { return Number(game.id) === gameId; }) || null;
        render();
      });
    });

    app.querySelectorAll('[data-close-join-confirm]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.joinConfirm = null;
        render();
      });
    });

    app.querySelectorAll('[data-close-payment]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.paymentConfirm = null;
        render();
      });
    });

    app.querySelectorAll('[data-open-payment]').forEach(function (button) {
      button.addEventListener('click', function () {
        var order = (state.data.myOrders || state.data.orders || []).find(function (item) {
          return String(item.id) === String(button.getAttribute('data-open-payment'));
        });
        if (!order) return;
        state.paymentConfirm = Object.assign({ order_id: order.id }, order);
        render();
      });
    });

    app.querySelectorAll('[data-pay-order]').forEach(function (button) {
      button.addEventListener('click', async function () {
        button.disabled = true;
        try {
          var result = await api('/api/sports-app/orders/' + button.getAttribute('data-pay-order') + '/pay', { method: 'POST', body: '{}' });
          state.paymentConfirm = null;
          await loadBootstrap();
          goToUserView('orders');
          state.highlightOrderId = result.order_id;
          render();
          showToast('支付成功，已跳转到我的订单，核销码 ' + result.checkin_code);
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-cancel-order]').forEach(function (button) {
      button.addEventListener('click', async function () {
        if (!window.confirm('确认取消这笔订单？已支付订单在允许时间内会退款，超时需联系运营。')) return;
        button.disabled = true;
        try {
          await api('/api/sports-app/orders/' + button.getAttribute('data-cancel-order') + '/cancel', { method: 'POST', body: '{}' });
          state.paymentConfirm = null;
          await loadBootstrap();
          showToast('订单已取消');
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-read-notification]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          await api('/api/sports-app/notifications/' + button.getAttribute('data-read-notification') + '/read', { method: 'POST', body: '{}' });
          await loadBootstrap();
          render();
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-demo-reset]').forEach(function (button) {
      button.addEventListener('click', async function () {
        if (!window.confirm('确认清理当前账号数据？将删除该账号的订单、报名、通知和测试记录，信用分恢复为 100。')) return;
        try {
          await api('/api/sports-app/admin/demo-reset', { method: 'POST', body: '{}' });
          await loadBootstrap();
          if (state.mode === 'admin') await refreshModeData();
          render();
          showToast('当前账号数据已清理');
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-local-logout]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (window.AnotherMeLocalAuth && window.AnotherMeLocalAuth.logout) {
          window.AnotherMeLocalAuth.logout();
        }
      });
    });

    app.querySelectorAll('[data-game-detail]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          if (state.userView === 'home') goToUserView('games');
          state.gameDetail = await api('/api/sports-app/games/' + button.getAttribute('data-game-detail'));
          render();
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-close-game-detail]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.gameDetail = null;
        render();
      });
    });

    app.querySelectorAll('[data-book-venue]').forEach(function (button) {
      button.addEventListener('click', async function () {
        goToUserView('venues');
        state.venueBooking = state.data.venues.find(function (venue) { return String(venue.id) === String(button.getAttribute('data-book-venue')); }) || null;
        render();
      });
    });

    app.querySelectorAll('[data-open-venue-book]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.venueBooking = state.data.venues.find(function (venue) { return String(venue.id) === String(button.getAttribute('data-open-venue-book')); }) || null;
        track('venue_book_open', { entity_type: 'venue', entity_id: button.getAttribute('data-open-venue-book') });
        render();
      });
    });

    app.querySelectorAll('[data-close-venue-booking]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.venueBooking = null;
        render();
      });
    });

    var bookingForm = app.querySelector('[data-venue-booking-form]');
    if (bookingForm) {
      var bookingDateInput = bookingForm.querySelector('input[name="booking_date"]');
      var bookingRangeInput = bookingForm.querySelector('input[name="booking_range"]');
      var bookingStartInput = bookingForm.querySelector('input[name="booking_start_time"]');
      var bookingEndInput = bookingForm.querySelector('input[name="booking_end_time"]');
      var submitButton = bookingForm.querySelector('[data-submit-venue-book]');

      function syncSubmitState() {
        var hasRange = bookingStartInput.value && bookingEndInput.value;
        submitButton.disabled = !hasRange || actionLocked();
      }

      bookingDateInput.addEventListener('change', function () {
        if (!state.venueBooking) return;
        state.venueBooking.booking_date = bookingDateInput.value;
        render();
      });

      bookingForm.querySelectorAll('[data-booking-date-pick]').forEach(function (dateButton) {
        dateButton.addEventListener('click', function () {
          if (!state.venueBooking) return;
          state.venueBooking.booking_date = dateButton.getAttribute('data-booking-date-pick') || todayValue();
          render();
        });
      });

      bookingForm.querySelectorAll('[data-slot-pick]').forEach(function (slotButton) {
        slotButton.addEventListener('click', function () {
          var label = slotButton.getAttribute('data-slot-label') || slotButton.getAttribute('data-slot-pick');
          bookingRangeInput.value = label;
          bookingStartInput.value = slotButton.getAttribute('data-slot-start');
          bookingEndInput.value = slotButton.getAttribute('data-slot-end');
          syncSubmitState();
          bookingForm.querySelectorAll('[data-slot-pick]').forEach(function (item) {
            item.classList.remove('is-active');
          });
          slotButton.classList.add('is-active');
        });
      });

      syncSubmitState();

      bookingForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (!bookingStartInput.value || !bookingEndInput.value) {
          showToast('请选择一个可用时段');
          return;
        }
        var bookedVenue = state.venueBooking;
        if (!window.confirm('确认提交场地预订？')) return;
        try {
          var result = await api('/api/sports-app/venues/' + state.venueBooking.id + '/book', {
            method: 'POST',
            body: JSON.stringify({
              booking_date: bookingDateInput.value,
              booking_start_time: bookingStartInput.value,
              booking_end_time: bookingEndInput.value,
            }),
          });
          state.venueBooking = null;
          await loadBootstrap();
          var bookedOrder = (state.data.myOrders || state.data.orders || []).find(function (order) {
            return String(order.checkin_code) === String(result.checkin_code);
          }) || result;
          state.paymentConfirm = Object.assign({}, bookedOrder, {
            title: '场地预订',
            venue_name: bookedVenue ? bookedVenue.name : '合作场馆',
            amount: result.amount || 0,
            order_id: result.order_id,
            status: 'pending_payment',
          });
          render();
          showToast('场地订单已生成，请完成支付');
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    var createGameForm = app.querySelector('[data-create-game]');
    if (createGameForm) {
      createGameForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        var body = Object.fromEntries(new FormData(form).entries());
        try {
          await api('/api/sports-app/games', { method: 'POST', body: JSON.stringify(body) });
          await loadBootstrap();
          goToUserView('games');
          render();
          showToast('球局已发布，已写入数据库');
        } catch (error) {
          showToast(error.message || '发局失败，请检查时间、场馆和信用分');
        }
      });
    }

    var createTeamForm = app.querySelector('[data-create-team]');
    if (createTeamForm) {
      createTeamForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var body = Object.fromEntries(new FormData(event.currentTarget).entries());
        try {
          await api('/api/sports-app/teams', { method: 'POST', body: JSON.stringify(body) });
          await loadBootstrap();
          showToast('球队已创建，队长身份已绑定');
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    app.querySelectorAll('[data-join-team]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          await api('/api/sports-app/teams/' + button.getAttribute('data-join-team') + '/join', { method: 'POST', body: '{}' });
          await loadBootstrap();
          showToast('已加入球队，后续可扩展训练通知和出勤统计');
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    var createClipForm = app.querySelector('[data-create-clip]');
    if (createClipForm) {
      createClipForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var body = Object.fromEntries(new FormData(event.currentTarget).entries());
        try {
          var result = await api('/api/sports-app/ai-clips', { method: 'POST', body: JSON.stringify(body) });
          await loadBootstrap();
          showToast('高光任务已提交：' + result.demo_result);
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    var runAiDemo = app.querySelector('[data-run-ai-demo]');
    if (runAiDemo) {
      runAiDemo.addEventListener('click', function () {
        markAiDemoAnalyzed();
        showInlineToast('AI 高光已生成');
      });
    }

    var seekAiDemo = app.querySelector('[data-seek-goal-demo]');
    if (seekAiDemo) {
      seekAiDemo.addEventListener('click', function () {
        markAiDemoAnalyzed();
        var video = app.querySelector('.ai-demo-player video');
        if (video && typeof video.currentTime === 'number') {
          var targetTime = video.duration ? Math.min(8, Math.max(video.duration - 0.5, 0)) : 8;
          try {
            video.pause();
            video.muted = true;
            if (Math.abs((video.currentTime || 0) - targetTime) > 0.35) {
              video.currentTime = targetTime;
            }
          } catch (error) {}
        }
        var timeline = app.querySelector('.ai-timeline');
        if (timeline) {
          timeline.classList.add('is-jumped');
          window.setTimeout(function () { timeline.classList.remove('is-jumped'); }, 900);
        }
        showInlineToast('已定位到进球片段');
      });
    }

    var createUploadForm = app.querySelector('[data-create-upload]');
    if (createUploadForm) {
      createUploadForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var body = Object.fromEntries(new FormData(event.currentTarget).entries());
        try {
          var result = await api('/api/sports-app/data-uploads', { method: 'POST', body: JSON.stringify(body) });
          await loadBootstrap();
          showToast('数据授权意向已提交，质量评分 ' + result.quality_score);
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    var createVenueForm = app.querySelector('[data-create-venue]');
    if (createVenueForm) {
      createVenueForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        var body = Object.fromEntries(new FormData(event.currentTarget).entries());
        body.indoor = true;
        body.open_slots = ['周末黄金时段', '工作日晚间'];
        try {
          await api('/api/sports-app/venues', { method: 'POST', body: JSON.stringify(body) });
          await refreshModeData();
          showToast('场馆已提交，等待运营审核');
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    app.querySelectorAll('[data-checkin-order]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          await api('/api/sports-app/orders/' + button.getAttribute('data-checkin-order') + '/checkin', { method: 'POST', body: '{}' });
          await loadOrders();
          await loadBootstrap();
          goToUserView('orders');
          state.highlightOrderId = button.getAttribute('data-checkin-order');
          render();
          showToast('核销成功，信用分已更新');
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-approve-venue]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          await api('/api/sports-app/venues/' + button.getAttribute('data-approve-venue'), {
            method: 'PATCH',
            body: JSON.stringify({ status: 'approved' }),
          });
          await refreshModeData();
          showToast('场馆已审核通过');
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-user-status]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          await api('/api/sports-app/admin/users/' + button.getAttribute('data-user-status') + '/status', {
            method: 'PATCH',
            body: JSON.stringify({ status: Number(button.getAttribute('data-next-status')) }),
          });
          await loadUsers();
          showToast('用户状态已更新');
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-copy-address]').forEach(function (button) {
      button.addEventListener('click', async function () {
        var address = button.getAttribute('data-copy-address');
        try {
          await navigator.clipboard.writeText(address);
          showToast('地址已复制：' + address);
        } catch {
          showToast(address);
        }
      });
    });

    app.querySelectorAll('[data-rating-range]').forEach(function (input) {
      input.addEventListener('input', function () {
        syncRangeVisual(input);
      });
    });

    app.querySelectorAll('[data-rating-preset]').forEach(function (button) {
      button.addEventListener('click', function () {
        var form = button.closest('form');
        var value = button.getAttribute('data-preset-score') || 3;
        if (!form) return;
        form.querySelectorAll('[data-rating-range]').forEach(function (input) {
          input.value = value;
          syncRangeVisual(input);
        });
      });
    });

    var selfRatingForm = app.querySelector('[data-self-rating]');
    if (selfRatingForm) {
      selfRatingForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (!window.confirm('确认提交本次自评？提交后 7 天内仅可修改 1 次。')) return;
        var body = ratingBodyFromForm(event.currentTarget);
        try {
          var result = await api('/api/sports-app/rating/self', { method: 'POST', body: JSON.stringify(body) });
          state.data.rating = result.summary;
          await loadBootstrap();
          showToast('实力评级已更新');
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    app.querySelectorAll('[data-review-game]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          state.reviewDetail = await api('/api/sports-app/games/' + button.getAttribute('data-review-game'));
          state.gameDetail = null;
          render();
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-close-review]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.reviewDetail = null;
        render();
      });
    });

    var peerReviewForm = app.querySelector('[data-peer-review]');
    if (peerReviewForm) {
      peerReviewForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        if (!window.confirm('确认提交本场互评？每场对同一球员只能提交 1 次。')) return;
        var anonymous = peerReviewForm.querySelector('input[name="anonymous"]')?.checked !== false;
        var reviews = Array.from(peerReviewForm.querySelectorAll('[data-review-target]')).map(function (card) {
          var review = { target_user_id: Number(card.getAttribute('data-review-target')), anonymous: anonymous };
          card.querySelectorAll('[data-rating-range]').forEach(function (input) {
            review[input.getAttribute('data-rating-dimension')] = Number(input.value || 3);
          });
          return review;
        });
        try {
          var result = await api('/api/sports-app/games/' + state.reviewDetail.game.id + '/reviews', {
            method: 'POST',
            body: JSON.stringify({ reviews: reviews }),
          });
          state.reviewDetail = null;
          await loadBootstrap();
          showToast('已提交 ' + result.saved + ' 条互评');
        } catch (error) {
          showToast(error.message);
        }
      });
    }

    app.querySelectorAll('[data-player-profile]').forEach(function (button) {
      button.addEventListener('click', async function () {
        try {
          state.playerProfile = await api('/api/sports-app/players/' + button.getAttribute('data-player-profile'));
          render();
        } catch (error) {
          showToast(error.message);
        }
      });
    });

    app.querySelectorAll('[data-close-player-profile]').forEach(function (node) {
      node.addEventListener('click', function () {
        state.playerProfile = null;
        render();
      });
    });

    app.querySelectorAll('[data-close-rating-guide]').forEach(function (button) {
      button.addEventListener('click', function () {
        window.localStorage.setItem('nyq_rating_guide_seen', '1');
        render();
      });
    });

    app.querySelectorAll('[data-reset-rating]').forEach(function (button) {
      button.addEventListener('click', async function () {
        if (!window.confirm('确认重置该用户评分？该操作用于申诉核查后的人工处理。')) return;
        try {
          await api('/api/sports-app/admin/ratings/' + button.getAttribute('data-reset-rating') + '/reset', { method: 'POST', body: '{}' });
          await loadRatings();
          showToast('评分已重置');
        } catch (error) {
          showToast(error.message);
        }
      });
    });
  }

  function syncRangeVisual(input) {
    var slider = input.closest('.star-slider');
    var value = Math.round(score(input.value, 3));
    if (!slider) return;
    slider.querySelectorAll('.stars span').forEach(function (star, index) {
      star.classList.toggle('is-on', index < value);
    });
    var output = slider.querySelector('[data-rating-value]');
    if (output) output.textContent = value;
  }

  function ratingBodyFromForm(form) {
    var body = {};
    ratingDimensions.forEach(function (item) {
      var input = form.querySelector('[name="' + item[0] + '"]');
      body[item[0]] = Number(input ? input.value : 3);
    });
    return body;
  }

  async function boot() {
    try {
      state.userView = readPreviewRoute();
      await loadBootstrap();
      render();
    } catch (error) {
      app.innerHTML = '<div class="boot-screen"><div class="boot-mark">NYQ</div><p>' + h(error.message) + '</p></div>';
    }
  }

  window.addEventListener('popstate', function () {
    var nextView = readPreviewRoute();
    if (nextView === state.userView && !hasOpenOverlay()) return;
    rememberMobileTabMove(nextView);
    state.mode = 'user';
    state.userView = nextView;
    state.navStack = [];
    clearOverlays();
    render();
  });

  window.addEventListener('another-me-auth-change', boot);
  boot();
})();
