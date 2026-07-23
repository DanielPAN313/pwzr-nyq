const { MOCK_USER, getLandingPath, setSession } = require("../../utils/auth");
const { getConfig } = require("../../utils/config");
const { post } = require("../../utils/api");
const { verifyVenueAdmin } = require("../../utils/venue-auth");

function reLaunchByRole(role) {
  wx.reLaunch({ url: getLandingPath(role) });
}

Page({
  data: {
    selectedRole: "player",
    phone: "",
    code: "",
    error: "",
    loading: false
  },

  selectRole(event) {
    const role = event.currentTarget.dataset.role;
    if (!["player", "venue_admin"].includes(role)) return;
    this.setData({ selectedRole: role, error: "" });
  },

  updateField(event) {
    const field = event.currentTarget.dataset.field;
    if (!["phone", "code"].includes(field)) return;
    this.setData({ [field]: event.detail.value, error: "" });
  },

  submitIdentity() {
    if (this.data.loading) return;
    if (this.data.selectedRole === "venue_admin") {
      this.submitVenueLogin();
      return;
    }
    this.submitPlayerLogin();
  },

  submitPlayerLogin() {
    this.setData({ loading: true, error: "" });
    const { useMockAuth } = getConfig();

    if (useMockAuth) {
      setSession({
        user: { ...MOCK_USER, role: "player" },
        token: `dev-token-${MOCK_USER.username}`
      });
      reLaunchByRole("player");
      return;
    }

    if (typeof wx.login !== "function") {
      this.setData({ loading: false, error: "当前环境无法使用微信登录" });
      return;
    }

    wx.login({
      success: ({ code }) => {
        post("/api/sports-app/auth/wechat-login", { code }, { auth: false, showLoading: false })
          .then((session) => {
            setSession({ ...session, role: "player" });
            reLaunchByRole("player");
          })
          .catch(() => this.setData({ loading: false, error: "微信登录失败，请稍后重试" }));
      },
      fail: () => this.setData({ loading: false, error: "微信登录失败，请稍后重试" })
    });
  },

  submitVenueLogin() {
    const phone = this.data.phone.trim();
    const code = this.data.code.trim();

    if (!/^1\d{10}$/.test(phone)) {
      this.setData({ error: "请输入正确的管理员手机号" });
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      this.setData({ error: "请输入 6 位验证码" });
      return;
    }

    this.setData({ loading: true, error: "" });
    const { useMockAuth } = getConfig();
    if (useMockAuth) {
      const session = verifyVenueAdmin(phone, code);
      if (!session) {
        this.setData({ loading: false, error: "手机号或验证码未通过场馆验证" });
        return;
      }
      reLaunchByRole("venue_admin");
      return;
    }

    post("/api/sports-app/auth/venue-login", { phone, code }, { auth: false, showLoading: false })
      .then((session) => {
        setSession({ ...session, role: "venue_admin" });
        reLaunchByRole("venue_admin");
      })
      .catch(() => this.setData({ loading: false, error: "场馆账号验证失败，请联系平台管理员" }));
  }
});
