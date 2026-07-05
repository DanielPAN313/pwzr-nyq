const { post } = require("../../utils/api");
const { ensureLogin, getStoredUser, logout, setSession } = require("../../utils/auth");

function normalizeAuthUser(rawUser) {
  const username = rawUser.username || rawUser.name || rawUser.email || "nyq_player";
  return {
    id: rawUser.id,
    username,
    nickName: rawUser.nickName || rawUser.name || username,
    avatarUrl: rawUser.avatarUrl || "",
    creditScore: rawUser.creditScore || 100
  };
}

function emailName(email) {
  return String(email || "").split("@")[0] || "";
}

Page({
  data: {
    mode: "register",
    loading: false,
    statusText: "",
    currentUser: null,
    form: {
      email: "",
      username: "",
      password: ""
    }
  },

  onLoad() {
    this.syncSession();
  },

  onShow() {
    this.syncSession();
  },

  syncSession() {
    this.setData({ currentUser: getStoredUser() || null });
  },

  switchMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!mode || mode === this.data.mode) return;
    this.setData({ mode, statusText: "" });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    this.setData({
      [`form.${field}`]: value,
      statusText: ""
    });
  },

  submitAuth() {
    if (this.data.loading) return;

    const form = this.data.form;
    const username = String(form.username || emailName(form.email)).trim();
    const email = String(form.email || username).trim();
    const password = String(form.password || "");

    if (!username) {
      this.setData({ statusText: "请填写用户名或邮箱。" });
      return;
    }

    if (password.length < 6) {
      this.setData({ statusText: "密码至少 6 位，方便后续接真实服务器。" });
      return;
    }

    const isRegister = this.data.mode === "register";
    const path = isRegister ? "/api/auth/register" : "/api/auth/login";
    this.setData({ loading: true, statusText: "" });

    post(path, { username, email, password }, {
      auth: false,
      loadingTitle: isRegister ? "创建中" : "登录中"
    })
      .then((result) => {
        const rawUser = result.user || {};
        const session = setSession({
          user: normalizeAuthUser(rawUser),
          token: result.token || rawUser.token
        });

        this.setData({
          currentUser: session.user,
          statusText: isRegister ? "账号已创建，已进入宁约球。" : "登录成功，已进入宁约球。"
        });

        wx.showToast({ title: "已登录", icon: "success" });
        wx.switchTab({ url: "/pages/home/home" });
      })
      .catch((error) => {
        this.setData({
          statusText: error.message || "账号服务暂不可用，可先使用演示快速进入。"
        });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  quickEnter() {
    if (this.data.loading) return;

    this.setData({ loading: true, statusText: "" });
    ensureLogin()
      .then((session) => {
        this.setData({
          currentUser: session.user,
          statusText: "已使用演示身份进入。"
        });
        wx.switchTab({ url: "/pages/home/home" });
      })
      .catch((error) => {
        this.setData({ statusText: error.message || "演示登录失败，请稍后再试。" });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  logoutAccount() {
    logout();
    this.setData({
      currentUser: null,
      statusText: "已退出当前账号。"
    });
    wx.showToast({ title: "已退出", icon: "none" });
  },

  goHome() {
    wx.switchTab({ url: "/pages/home/home" });
  }
});
