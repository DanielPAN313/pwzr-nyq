const { get } = require("./api");
const { hasCompletedPlayerProfile, storeProfileFromServer } = require("./player-rating");

const CREDIT_STORAGE_KEY = "nyq_credit_score";
const JOIN_MIN_SCORE = 60;
const CREATE_MIN_SCORE = 80;

function clampCredit(value) {
  const score = Number(value);
  if (Number.isNaN(score)) return 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getStoredCreditScore() {
  try {
    const stored = wx.getStorageSync(CREDIT_STORAGE_KEY);
    return stored === "" || stored == null ? 100 : clampCredit(stored);
  } catch (_error) {
    return 100;
  }
}

function storeCreditScore(value) {
  const score = clampCredit(value);
  try {
    wx.setStorageSync(CREDIT_STORAGE_KEY, score);
  } catch (_error) {
    // Keep the in-memory score when storage is unavailable.
  }
  return score;
}

function evaluateCreditAccess(value, profileReady = hasCompletedPlayerProfile()) {
  const creditScore = clampCredit(value);
  return {
    creditScore,
    profileReady: Boolean(profileReady),
    canJoinCasual: creditScore >= JOIN_MIN_SCORE && Boolean(profileReady),
    canCreateCasual: creditScore >= CREATE_MIN_SCORE,
    joinBlockedByCredit: creditScore < JOIN_MIN_SCORE,
    createBlockedByCredit: creditScore < CREATE_MIN_SCORE,
    joinHint: creditScore < JOIN_MIN_SCORE
      ? "信用分不足，无法报名。可通过按时到场踢球恢复（+2 分/次）"
      : !profileReady
        ? "报名散客球局前需先完成球员实力档案"
        : "可报名散客球局",
    createHint: creditScore < CREATE_MIN_SCORE
      ? `信用分 ${creditScore}/100，达到 80 分后可发起散客球局`
      : "可发起散客球局"
  };
}

function loadCreditAccess() {
  const creditPromise = get("/api/sports-app/me", { showLoading: false })
    .then((profile) => storeCreditScore(profile?.summary?.credit_score ?? 100))
    .catch(() => getStoredCreditScore());
  const profilePromise = get("/api/sports-app/player-profile", { showLoading: false })
    .then((result) => {
      const profile = result?.profile || result;
      storeProfileFromServer(profile);
      return Boolean(profile?.first_edit_at || profile?.firstEditAt);
    })
    .catch(() => hasCompletedPlayerProfile());

  return Promise.all([creditPromise, profilePromise])
    .then(([score, profileReady]) => evaluateCreditAccess(score, profileReady));
}

module.exports = {
  CREATE_MIN_SCORE,
  CREDIT_STORAGE_KEY,
  JOIN_MIN_SCORE,
  clampCredit,
  evaluateCreditAccess,
  getStoredCreditScore,
  loadCreditAccess,
  storeCreditScore
};
