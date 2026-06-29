Page({
  data: {
    quickActions: [
      { label: "订场", target: "/pages/venues/venues" },
      { label: "找球局", target: "/pages/games/games" },
      { label: "消息", target: "/pages/messages/messages" },
      { label: "我的", target: "/pages/me/me" }
    ]
  },

  switchTab(event) {
    wx.switchTab({
      url: event.currentTarget.dataset.target
    });
  }
});
