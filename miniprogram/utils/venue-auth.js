const { getConfig } = require("./config");
const { setSession } = require("./auth");

const MOCK_VENUE_ACCOUNTS = [
  {
    phone: "13800000000",
    code: "123456",
    user: {
      id: 9001,
      username: "venue_admin",
      nickName: "宁约球场馆管理员",
      avatarUrl: "",
      venueId: "venue-demo-001",
      venueName: "卡子门足球场",
      role: "venue_admin"
    }
  }
];

function verifyVenueAdmin(phone, code) {
  const normalizedPhone = String(phone || "").trim();
  const normalizedCode = String(code || "").trim();
  const account = MOCK_VENUE_ACCOUNTS.find((item) => (
    item.phone === normalizedPhone && item.code === normalizedCode
  ));

  if (!account) return null;

  const session = setSession({
    user: { ...account.user, phone: normalizedPhone },
    token: `venue-dev-token-${account.user.id}`
  });
  const { storageKeys } = getConfig();
  wx.setStorageSync(storageKeys.venueVerification, {
    venueId: account.user.venueId,
    verifiedAt: Date.now()
  });
  return session;
}

module.exports = {
  MOCK_VENUE_ACCOUNTS,
  verifyVenueAdmin
};
