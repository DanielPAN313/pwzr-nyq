const PROFILE_STORAGE_KEY = "nyq_player_profile";
const PROFILE_EDIT_META_KEY = "nyq_player_profile_edit_meta";
const REVIEW_STORAGE_KEY = "nyq_player_profile_reviews";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const INITIAL_EDIT_WINDOW = DAY;
const EDIT_COOLDOWN = 15 * DAY;

const ratingDimensions = [
  { key: "speed", label: "速度", shortLabel: "速度" },
  { key: "passing", label: "传球", shortLabel: "传球" },
  { key: "defense", label: "防守", shortLabel: "防守" },
  { key: "shooting", label: "射门", shortLabel: "射门" },
  { key: "dribbling", label: "盘带", shortLabel: "盘带" },
  { key: "stamina", label: "耐力", shortLabel: "耐力" }
];

const positionOptions = ["前锋", "边锋", "前腰", "中场", "后腰", "边后卫", "中后卫", "门将"];

const fallbackProfile = {
  speed: 62,
  passing: 68,
  defense: 55,
  shooting: 64,
  dribbling: 66,
  stamina: 72,
  positions: ["中场", "前腰"],
  firstEditAt: "",
  lastProfileEditAt: ""
};

const fallbackReviews = [
  {
    id: "review-1",
    nickname: "南航 7 号",
    starScore: 5,
    content: "传球视野很好，回防也很积极。",
    time: "2026-07-18 21:30",
    venue: "卡子门足球场",
    dimensions: { speed: 76, passing: 84, defense: 70, shooting: 72, dribbling: 79, stamina: 82 }
  },
  {
    id: "review-2",
    nickname: "卡子门门将",
    starScore: 4,
    content: "跑位清楚，配合意识稳定。",
    time: "2026-07-12 20:45",
    venue: "卡子门足球场",
    dimensions: { speed: 72, passing: 80, defense: 68, shooting: 70, dribbling: 75, stamina: 78 }
  },
  {
    id: "review-3",
    nickname: "江宁踢球搭子",
    starScore: 4,
    content: "体能不错，比赛后段还能保持压迫。",
    time: "2026-07-05 22:10",
    venue: "卡子门足球场",
    dimensions: { speed: 74, passing: 76, defense: 72, shooting: 67, dribbling: 73, stamina: 86 }
  }
];

function clampScore(value, fallback = 50) {
  const score = Number(value);
  if (Number.isNaN(score)) return fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function clampStar(value) {
  const score = Number(value);
  if (Number.isNaN(score)) return 3;
  return Math.max(1, Math.min(5, Math.round(score)));
}

function formatAverage(value) {
  const score = Number(value);
  return Number.isNaN(score) ? "50.0" : score.toFixed(1);
}

function ratingLabel(score) {
  const value = Number(score) || 0;
  if (value >= 85) return "核心球员";
  if (value >= 70) return "稳定主力";
  if (value >= 55) return "进阶球员";
  if (value >= 40) return "休闲球员";
  return "新手球员";
}

function normalizePositions(value) {
  let source = [];
  if (Array.isArray(value)) source = value;
  else if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      source = Array.isArray(parsed) ? parsed : value.split(",");
    } catch (_error) {
      source = value.split(",");
    }
  }
  return source
    .map((item) => String(item || "").trim())
    .filter((item, index, list) => positionOptions.indexOf(item) >= 0 && list.indexOf(item) === index);
}

function normalizeProfile(value) {
  const source = value || {};
  const profile = {
    positions: normalizePositions(source.positions || source.preferred_positions || source.preferred_positions_json),
    firstEditAt: source.firstEditAt || source.first_edit_at || "",
    lastProfileEditAt: source.lastProfileEditAt || source.last_profile_edit_at || source.update_time || "",
    extraEditUsed: Boolean(source.extraEditUsed || source.extra_edit_used)
  };

  ratingDimensions.forEach((item) => {
    profile[item.key] = clampScore(source[item.key], fallbackProfile[item.key]);
  });

  if (!profile.positions.length) profile.positions = [...fallbackProfile.positions];
  profile.average = Number(formatAverage(averageDimensions(profile)));
  return profile;
}

function averageDimensions(value) {
  const source = value || {};
  const total = ratingDimensions.reduce((sum, item) => sum + clampScore(source[item.key]), 0);
  return total / ratingDimensions.length;
}

function normalizeReview(value, index = 0) {
  const source = value || {};
  const dimensions = source.dimensions || source;
  const normalizedDimensions = {};
  ratingDimensions.forEach((item) => {
    normalizedDimensions[item.key] = clampScore(dimensions[item.key], clampStar(source.star_score || source.starScore) * 20);
  });

  return {
    id: source.id || `review-${index + 1}`,
    gameId: source.gameId || source.game_id || source.id || `review-game-${index + 1}`,
    nickname: source.nickname || source.rater_username || "匿名球友",
    starScore: clampStar(source.starScore || source.star_score || source.average_score),
    stars: Array.from({ length: 5 }, (_, starIndex) => starIndex < clampStar(source.starScore || source.star_score || source.average_score)),
    content: source.content || source.comment || "完成了一场有效互评。",
    time: source.time || source.create_time || "",
    venue: source.venue || source.venue_name || "宁约球合作场馆",
    dimensions: normalizedDimensions,
    isNegative: clampStar(source.starScore || source.star_score || source.average_score) <= 2
  };
}

function normalizeReviews(value) {
  const source = Array.isArray(value) ? value : [];
  return source.map(normalizeReview);
}

function calculateRating(profileValue, reviewValue) {
  const profile = normalizeProfile(profileValue);
  const allReviews = normalizeReviews(reviewValue)
    .sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime());
  const selectedGameIds = [];
  const reviews = allReviews.filter((review) => {
    const gameId = String(review.gameId);
    const existingIndex = selectedGameIds.indexOf(gameId);
    if (existingIndex >= 0) return existingIndex < 5;
    if (selectedGameIds.length >= 5) return false;
    selectedGameIds.push(gameId);
    return true;
  });
  const peerDimensions = {};
  const compositeDimensions = {};

  ratingDimensions.forEach((item) => {
    const peerAverage = reviews.length
      ? reviews.reduce((sum, review) => sum + review.dimensions[item.key], 0) / reviews.length
      : null;
    peerDimensions[item.key] = peerAverage == null ? null : Math.round(peerAverage * 10) / 10;
    compositeDimensions[item.key] = peerAverage == null
      ? profile[item.key]
      : Math.round((profile[item.key] * 0.4 + peerAverage * 0.6) * 10) / 10;
  });

  const selfScore = averageDimensions(profile);
  const peerScore = reviews.length ? averageDimensions(peerDimensions) : null;
  const compositeScore = averageDimensions(compositeDimensions);

  return {
    selfScore: Math.round(selfScore * 10) / 10,
    peerScore: peerScore == null ? null : Math.round(peerScore * 10) / 10,
    compositeScore: Math.round(compositeScore * 10) / 10,
    compositeScoreText: formatAverage(compositeScore),
    levelLabel: ratingLabel(compositeScore),
    peerCount: allReviews.length,
    effectivePeerGames: selectedGameIds.length,
    selfDimensions: ratingDimensions.map((item) => ({ ...item, value: profile[item.key] })),
    peerDimensions: ratingDimensions.map((item) => ({ ...item, value: peerDimensions[item.key] == null ? 0 : peerDimensions[item.key] })),
    compositeDimensions: ratingDimensions.map((item) => ({ ...item, value: compositeDimensions[item.key] }))
  };
}

function safeStorageGet(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    return value || fallback;
  } catch (_error) {
    return fallback;
  }
}

function getStoredProfile() {
  return normalizeProfile(safeStorageGet(PROFILE_STORAGE_KEY, fallbackProfile));
}

function hasCompletedPlayerProfile() {
  try {
    const profile = wx.getStorageSync(PROFILE_STORAGE_KEY) || {};
    const meta = wx.getStorageSync(PROFILE_EDIT_META_KEY) || {};
    return Boolean(profile.firstEditAt || profile.first_edit_at || meta.firstSubmittedAt);
  } catch (_error) {
    return false;
  }
}

function getStoredReviews() {
  const reviews = safeStorageGet(REVIEW_STORAGE_KEY, fallbackReviews);
  return normalizeReviews(Array.isArray(reviews) && reviews.length ? reviews : fallbackReviews);
}

function getEditPolicy(nowValue = Date.now()) {
  const now = Number(nowValue) || Date.now();
  const meta = safeStorageGet(PROFILE_EDIT_META_KEY, {});
  const firstAt = new Date(meta.firstSubmittedAt || 0).getTime();
  const lastAt = new Date(meta.lastProfileEditAt || 0).getTime();

  if (!firstAt) {
    return { canEdit: true, mode: "first", hint: "首次填写可直接保存", nextEditableAt: "" };
  }

  const initialWindowEnd = firstAt + INITIAL_EDIT_WINDOW;
  if (!meta.extraEditUsed && now < initialWindowEnd) {
    const remaining = Math.max(0, initialWindowEnd - now);
    const hours = Math.floor(remaining / HOUR);
    const minutes = Math.ceil((remaining % HOUR) / (60 * 1000));
    return {
      canEdit: true,
      mode: "initial-edit",
      hint: `剩余可修改时间：${hours} 小时 ${minutes} 分钟`,
      nextEditableAt: new Date(initialWindowEnd).toISOString()
    };
  }

  const cooldownStart = meta.extraEditUsed && lastAt ? lastAt : initialWindowEnd;
  const nextEditableAt = cooldownStart + EDIT_COOLDOWN;
  if (now >= nextEditableAt) {
    return { canEdit: true, mode: "cooldown-finished", hint: "本轮冷却已结束，可以更新档案", nextEditableAt: "" };
  }

  const remainingDays = Math.max(1, Math.ceil((nextEditableAt - now) / DAY));
  return {
    canEdit: false,
    mode: "cooldown",
    hint: `下次可修改时间：${remainingDays} 天后`,
    nextEditableAt: new Date(nextEditableAt).toISOString()
  };
}

function saveLocalProfile(profileValue, nowValue = Date.now()) {
  const now = Number(nowValue) || Date.now();
  const profile = normalizeProfile(profileValue);
  const previousMeta = safeStorageGet(PROFILE_EDIT_META_KEY, {});
  const policy = getEditPolicy(now);
  if (!policy.canEdit) return { ok: false, policy, profile: getStoredProfile() };

  let nextMeta;
  if (!previousMeta.firstSubmittedAt) {
    nextMeta = {
      firstSubmittedAt: new Date(now).toISOString(),
      lastProfileEditAt: new Date(now).toISOString(),
      extraEditUsed: false
    };
  } else if (policy.mode === "initial-edit") {
    nextMeta = {
      ...previousMeta,
      lastProfileEditAt: new Date(now).toISOString(),
      extraEditUsed: true
    };
  } else {
    nextMeta = {
      firstSubmittedAt: new Date(now).toISOString(),
      lastProfileEditAt: new Date(now).toISOString(),
      extraEditUsed: true
    };
  }

  const storedProfile = {
    ...profile,
    firstEditAt: nextMeta.firstSubmittedAt,
    lastProfileEditAt: nextMeta.lastProfileEditAt
  };
  wx.setStorageSync(PROFILE_STORAGE_KEY, storedProfile);
  wx.setStorageSync(PROFILE_EDIT_META_KEY, nextMeta);
  return { ok: true, policy: getEditPolicy(now + 1), profile: storedProfile };
}

function storeProfileFromServer(profileValue) {
  const profile = normalizeProfile(profileValue);
  try {
    wx.setStorageSync(PROFILE_STORAGE_KEY, profile);
    if (profile.firstEditAt) {
      wx.setStorageSync(PROFILE_EDIT_META_KEY, {
        firstSubmittedAt: profile.firstEditAt,
        lastProfileEditAt: profile.lastProfileEditAt || profile.firstEditAt,
        extraEditUsed: profile.extraEditUsed
      });
    }
  } catch (_error) {
    // Keep the in-memory server value when storage is unavailable.
  }
  return profile;
}

function storeReviewsFromServer(reviewValue) {
  const reviews = normalizeReviews(reviewValue);
  if (!reviews.length) return getStoredReviews();
  try {
    wx.setStorageSync(REVIEW_STORAGE_KEY, reviews);
  } catch (_error) {
    // Keep the in-memory server value when storage is unavailable.
  }
  return reviews;
}

function drawRadarChart(context, dimensionValues, options = {}) {
  if (!context || typeof context.beginPath !== "function") return false;
  const dimensions = Array.isArray(dimensionValues) && dimensionValues.length === 6
    ? dimensionValues
    : calculateRating(getStoredProfile(), []).compositeDimensions;
  const width = Number(options.width || 300);
  const height = Number(options.height || 260);
  const centerX = width / 2;
  const centerY = height / 2 + 4;
  const radius = Math.min(width, height) * 0.32;
  const points = dimensions.length;

  function pointAt(index, ratio) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / points;
    return {
      x: centerX + Math.cos(angle) * radius * ratio,
      y: centerY + Math.sin(angle) * radius * ratio
    };
  }

  context.clearRect(0, 0, width, height);
  context.setLineWidth(1);
  context.setStrokeStyle("rgba(247,251,245,0.18)");
  for (let level = 1; level <= 4; level += 1) {
    context.beginPath();
    for (let index = 0; index < points; index += 1) {
      const point = pointAt(index, level / 4);
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    }
    context.closePath();
    context.stroke();
  }

  for (let index = 0; index < points; index += 1) {
    const outer = pointAt(index, 1);
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(outer.x, outer.y);
    context.stroke();
  }

  context.beginPath();
  dimensions.forEach((item, index) => {
    const point = pointAt(index, clampScore(item.value) / 100);
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.closePath();
  context.setFillStyle("rgba(216,255,62,0.28)");
  context.fill();
  context.setLineWidth(2);
  context.setStrokeStyle("#d8ff3e");
  context.stroke();

  context.setFillStyle("#f7fbf5");
  context.setFontSize(11);
  context.setTextAlign("center");
  dimensions.forEach((item, index) => {
    const labelPoint = pointAt(index, 1.22);
    context.fillText(`${item.shortLabel || item.label} ${Math.round(item.value)}`, labelPoint.x, labelPoint.y + 4);
  });
  context.draw();
  return true;
}

module.exports = {
  EDIT_COOLDOWN,
  INITIAL_EDIT_WINDOW,
  PROFILE_EDIT_META_KEY,
  PROFILE_STORAGE_KEY,
  REVIEW_STORAGE_KEY,
  averageDimensions,
  calculateRating,
  clampScore,
  drawRadarChart,
  fallbackProfile,
  fallbackReviews,
  formatAverage,
  getEditPolicy,
  hasCompletedPlayerProfile,
  getStoredProfile,
  getStoredReviews,
  normalizeProfile,
  normalizeReview,
  normalizeReviews,
  positionOptions,
  ratingDimensions,
  ratingLabel,
  saveLocalProfile,
  storeProfileFromServer,
  storeReviewsFromServer
};
