const { post } = require("../../utils/api");
const { setSession } = require("../../utils/auth");

function normalizeUser(rawUser) {
  const username = rawUser.username || rawUser.name || rawUser.email || "nyq_player";
  return {
    id: rawUser.id || 1,
    username,
    nickName: rawUser.nickName || rawUser.name || username,
    avatarUrl: rawUser.avatarUrl || "",
    creditScore: rawUser.creditScore || 100
  };
}

Page({
  data: {
    username: "",
    password: "",
    error: "",
    loading: false
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

    this.setData({ loading: true, error: "" });

    post("/api/auth/login", { username, password }, {
      auth: false,
      loadingTitle: "登录中"
    })
      .then((result) => {
        const rawUser = result.user || {};
        setSession({
          user: normalizeUser(rawUser),
          token: result.token || rawUser.token
        });
        wx.reLaunch({
          url: "/pages/home/home"
        });
      })
      .catch((error) => {
        this.setData({ error: error.message || "登录失败，请检查账号密码" });
      })
      .finally(() => {
        this.setData({ loading: false });
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
