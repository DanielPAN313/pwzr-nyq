const { post } = require("../../utils/api");
const { setSession } = require("../../utils/auth");

function normalizeUser(rawUser) {
  const username = rawUser.username || rawUser.name || rawUser.email || "nyq_player";
  return {
    id: rawUser.id || 1,
    username,
    nickName: rawUser.nickName || rawUser.name || username,
    avatarUrl: rawUser.avatarUrl || "",
    creditScore: rawUser.creditScore ?? 100
  };
}

Page({
  data: {
    email: "",
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

    this.setData({ loading: true, error: "" });

    post("/api/auth/register", { email, username, password }, {
      auth: false,
      loadingTitle: "创建中"
    })
      .then((result) => {
        const rawUser = result.user || {};
        setSession({
          user: normalizeUser(rawUser),
          token: result.token || rawUser.token
        });
        wx.setStorageSync("nyq_register_profile", {
          email,
          username,
          registeredAt: Date.now()
        });
        wx.reLaunch({
          url: "/pages/home/home"
        });
      })
      .catch(() => {
        this.setData({ error: "创建账号失败，请稍后再试" });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  goLogin() {
    wx.navigateTo({
      url: "/pages/login/login"
    });
  }
});
