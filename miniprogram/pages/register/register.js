Page({
  data: {
    email: "",
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

  submitRegister() {
    const email = this.data.email.trim();
    const username = this.data.username.trim();
    const password = this.data.password;

    if (!email || !username || !password) {
      this.setData({ error: "请填写邮箱、账户名和密码" });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.setData({ error: "请输入有效邮箱" });
      return;
    }

    if (password.length < 6) {
      this.setData({ error: "密码至少 6 位" });
      return;
    }

    wx.setStorageSync("nyq_register_profile", {
      email,
      username,
      registeredAt: Date.now()
    });

    wx.reLaunch({
      url: "/pages/home/home"
    });
  },

  goLogin() {
    wx.navigateTo({
      url: "/pages/login/login"
    });
  }
});
