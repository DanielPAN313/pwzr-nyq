const SHARE_TEMPLATES = {
  casual: "今晚 8 点卡子门足球场缺 3 人，AA 50 元/人，一起来踢？",
  event: "卡子门周末赛事局，7v7 对抗，已有 10 人报名，速来组队！",
  default: "我在宁约球组了个局，一起来踢场球？"
};

function shareTypeForGame(game) {
  const source = game || {};
  const value = String(source.matchType || source.match_type || source.gameType || source.game_type || source.typeText || source.type || "").toLowerCase();
  if (["event", "tournament", "赛事局"].includes(value)) return "event";
  if (["casual", "pickup", "散客局"].includes(value)) return "casual";
  return "default";
}

function buildSharePath(gameId, inviter) {
  const id = encodeURIComponent(String(gameId || "invite-preview"));
  const inviterValue = encodeURIComponent(String(inviter || "nyq-player"));
  return `/pages/game-detail/game-detail?id=${id}&inviter=${inviterValue}`;
}

function buildSharePayload(game, inviter, templateType) {
  const source = game || {};
  const type = templateType && SHARE_TEMPLATES[templateType] ? templateType : shareTypeForGame(source);
  return {
    title: SHARE_TEMPLATES[type],
    path: buildSharePath(source.id || source.gameId, inviter),
    templateType: type
  };
}

module.exports = {
  SHARE_TEMPLATES,
  buildSharePath,
  buildSharePayload,
  shareTypeForGame
};
