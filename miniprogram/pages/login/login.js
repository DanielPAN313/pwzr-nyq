Page({
  data: {
    username: "",
    password: "",
    error: ""
  },

  updateField(event) {
    const field = event.currentTarget.dataset.field;
    if (!field) return;

    this.setData({
      [field]: event.detail.value,
      error: ""
    });
  },

  submitLogin() {
    const username = this.data.username.trim();
    const password = this.data.password;

    if (!username || !password) {
      this.setData({ error: "请输入用户名和密码" });
      return;
    }

    wx.reLaunch({
      url: "/pages/home/home"
    });
  },

  rememberLogin() {
    const profile = wx.getStorageSync("nyq_register_profile");

    if (!profile || !profile.username) {
      this.setData({ error: "未找到已注册账户，请先创建账号" });
      return;
    }

    wx.setStorageSync("nyq_remember_login", true);
    wx.reLaunch({
      url: "/pages/home/home"
    });
  }
});
