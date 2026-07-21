const { getPendingPaymentCount } = require("../utils/tab-bar-state");

Component({
  data: {
    selected: 0,
    showPendingDot: false,
    tabs: [
      { pagePath: "pages/home/home", text: "首页", mark: "H", type: "tab" },
      { pagePath: "pages/venues/venues", text: "订场", mark: "V", type: "tab" },
      { pagePath: "pages/games/games", text: "球局", mark: "G", type: "tab" },
      { pagePath: "pages/rankings/rankings", text: "排行", mark: "R", type: "page" },
      { pagePath: "pages/messages/messages", text: "消息", mark: "M", type: "tab" },
      { pagePath: "pages/me/me", text: "我的", mark: "P", type: "tab" }
    ]
  },

  lifetimes: {
    attached() {
      this.syncTabState();
    }
  },

  pageLifetimes: {
    show() {
      this.syncTabState();
    }
  },

  methods: {
    refreshPendingDot() {
      const showPendingDot = getPendingPaymentCount() > 0;
      if (showPendingDot !== this.data.showPendingDot) {
        this.setData({ showPendingDot });
      }
    },

    updateSelected() {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      const route = current && current.route;
      const selected = this.data.tabs.findIndex((item) => item.pagePath === route);

      if (selected >= 0 && selected !== this.data.selected) {
        this.setData({ selected });
      }
    },

    syncTabState() {
      this.updateSelected();
      this.refreshPendingDot();
    },

    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index);
      const item = this.data.tabs[index];
      if (!item) return;

      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      if (current && current.route === item.pagePath) return;

      if (item.type === "page") {
        wx.navigateTo({ url: `/${item.pagePath}` });
        return;
      }

      wx.switchTab({ url: `/${item.pagePath}` });
    }
  }
});
