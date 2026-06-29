(function mountHackathonModules() {
  var parts = [
    '/module-parts/01-agent-launch/entry-card.html',
    '/module-parts/02-avatar/entry-card.html',
    '/module-parts/03-social/entry-card.html'
  ];

  function ensureStyles() {
    if (document.querySelector('link[data-module-entry-style="true"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/module-parts/shared/module-entry.css';
    link.dataset.moduleEntryStyle = 'true';
    document.head.appendChild(link);
  }

  function isDashboard() {
    return window.location.pathname === '/dashboard' || window.location.pathname === '/merchant' || window.location.pathname === '/agent';
  }

  function findSidebar() {
    var candidates = Array.prototype.slice.call(document.querySelectorAll('aside, nav, [class*="sidebar"], [class*="Sidebar"]'));
    return candidates.find(function (node) {
      var rect = node.getBoundingClientRect();
      var style = window.getComputedStyle(node);
      return rect.width >= 150 && rect.width <= 320 && rect.left <= 32 && rect.height >= 240 && style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  function shell() {
    var section = document.createElement('section');
    section.id = 'hackathon-modules-sidebar';
    section.innerHTML = [
      '<div class="module-sidebar-eyebrow">HACKATHON MODULES</div>',
      '<div class="module-sidebar-list" data-module-entry-grid="true"></div>',
      '<a class="module-sidebar-hub" href="/modules/">Module hub</a>'
    ].join('');
    return section;
  }

  async function loadPart(url) {
    var response = await fetch(url);
    if (!response.ok) throw new Error(url + ' HTTP ' + response.status);
    return response.text();
  }

  async function mount() {
    if (!isDashboard() || document.getElementById('hackathon-modules-sidebar')) return;
    var sidebar = findSidebar();
    if (!sidebar) return;
    ensureStyles();
    var section = shell();
    sidebar.appendChild(section);
    var grid = section.querySelector('[data-module-entry-grid="true"]');
    try {
      var html = await Promise.all(parts.map(loadPart));
      grid.innerHTML = html.join('');
    } catch (error) {
      grid.innerHTML = '<div class="module-sidebar-error">Could not load module parts: ' + error.message + '</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', mount);
  new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true });
  mount();
})();
