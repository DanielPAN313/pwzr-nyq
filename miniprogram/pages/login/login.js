const { MOCK_USER, getLandingPath, setSession } = require("../../utils/auth");
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

    const finish = () => {
      setSession({
        user: { ...MOCK_USER, role: "player" },
        token: `dev-token-${MOCK_USER.username}`
      });
      reLaunchByRole("player");
    };

    if (typeof wx.login !== "function") {
      finish();
      return;
    }

    wx.login({
      success: finish,
      fail: finish
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
    const session = verifyVenueAdmin(phone, code);
    if (!session) {
      this.setData({ loading: false, error: "手机号或验证码未通过场馆验证" });
      return;
    }
    reLaunchByRole("venue_admin");
  }
});
