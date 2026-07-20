Component({
  data: {
    selected: 0,
    tabs: [
      { pagePath: "pages/home/home", text: "首页", mark: "H" },
      { pagePath: "pages/venues/venues", text: "订场", mark: "V" },
      { pagePath: "pages/rankings/rankings", text: "榜单", mark: "R" },
      { pagePath: "pages/messages/messages", text: "消息", mark: "M" },
      { pagePath: "pages/me/me", text: "我的", mark: "P" }
    ]
  },

  lifetimes: {
    attached() {
      this.updateSelected();
    }
  },

  pageLifetimes: {
    show() {
      this.updateSelected();
    }
  },

  methods: {
    updateSelected() {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      const route = current && current.route;
      const selected = this.data.tabs.findIndex((item) => item.pagePath === route);

      if (selected >= 0 && selected !== this.data.selected) {
        this.setData({ selected });
      }
    },

    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index);
      const item = this.data.tabs[index];
      if (!item) return;

      this.setData({ selected: index });
      wx.switchTab({
        url: `/${item.pagePath}`
      });
    }
  }
});
