const DEFAULT_SCORE = 50;
const BALANCE_THRESHOLD = 15;

const formationTargets = {
  "5v5": { goalkeeper: 1, defender: 1, midfielder: 1, forward: 2 },
  "7v7": { goalkeeper: 1, defender: 2, midfielder: 2, forward: 2 },
  "8v8": { goalkeeper: 1, defender: 2, midfielder: 3, forward: 2 }
};

const rankBonuses = {
  核心球员: 3,
  稳定主力: 2,
  进阶球员: 1,
  休闲球员: 0,
  新手球员: -1
};

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_SCORE;
  const expanded = numeric > 0 && numeric <= 5 ? numeric * 20 : numeric;
  return Math.max(0, Math.min(100, Math.round(expanded * 10) / 10));
}

function parsePositions(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  const source = String(value);
  try {
    const parsed = JSON.parse(source);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch (_error) {
    // Fall through to comma-separated position text.
  }
  return source.split(/[,，/]/).map((item) => item.trim()).filter(Boolean);
}

function roleForPosition(position) {
  const value = String(position || "");
  if (value.includes("门将")) return "goalkeeper";
  if (value.includes("后卫") || value.includes("后腰")) return "defender";
  if (value.includes("中场") || value.includes("前腰") || value.includes("边锋")) return "midfielder";
  if (value.includes("前锋")) return "forward";
  return "flex";
}

function normalizePlayer(player, index = 0) {
  const source = player || {};
  const positions = parsePositions(source.positions || source.preferred_positions || source.position);
  const baseScore = clampScore(source.composite_score ?? source.score ?? source.rating);
  const rank = source.rank || source.level_label || source.levelLabel || "";
  const rankBonus = Number(rankBonuses[rank] || 0);
  const score = clampScore(baseScore + rankBonus);
  const primaryRole = roleForPosition(positions[0]);

  return {
    ...source,
    id: source.id || source.user_id || `player-${index + 1}`,
    name: source.name || source.username || `球员 ${index + 1}`,
    positions,
    position: positions[0] || source.position || "待定",
    primaryRole,
    baseScore,
    rank,
    rankBonus,
    score,
    isDefaultScore: source.composite_score == null && source.score == null && source.rating == null
  };
}

function normalizePlayers(players) {
  return (Array.isArray(players) ? players : []).map(normalizePlayer);
}

function snakeDistribute(players) {
  const redTeam = [];
  const blueTeam = [];
  players.forEach((player, index) => {
    const slot = index % 4;
    (slot === 0 || slot === 3 ? redTeam : blueTeam).push(player);
  });
  return { redTeam, blueTeam };
}

function teamScore(team) {
  return Math.round((team || []).reduce((sum, player) => sum + clampScore(player.score), 0) * 10) / 10;
}

function countRoles(team) {
  return (team || []).reduce((counts, player) => {
    const roles = (player.positions || []).map(roleForPosition);
    const role = roles.find((item) => item !== "flex") || player.primaryRole || "flex";
    counts[role] = (counts[role] || 0) + 1;
    return counts;
  }, { goalkeeper: 0, defender: 0, midfielder: 0, forward: 0, flex: 0 });
}

function positionRisksForTeam(team, format) {
  const target = formationTargets[format] || formationTargets["5v5"];
  const counts = countRoles(team);
  const labels = { goalkeeper: "门将", defender: "后卫", midfielder: "中场", forward: "前锋" };
  const risks = [];
  Object.keys(target).forEach((role) => {
    const missing = Math.max(0, target[role] - Number(counts[role] || 0));
    if (missing) risks.push(`缺少${labels[role]} ${missing} 人`);
  });
  return { counts, risks, missingCount: risks.reduce((sum, text) => sum + Number((text.match(/(\d+)/) || [0, 0])[1]), 0) };
}

function scoreDifferencePercent(redTeam, blueTeam) {
  const redScore = teamScore(redTeam);
  const blueScore = teamScore(blueTeam);
  const average = (redScore + blueScore) / 2;
  return average ? Math.round((Math.abs(redScore - blueScore) / average) * 1000) / 10 : 0;
}

function evaluateTeams(redTeam, blueTeam, format = "5v5") {
  const redScore = teamScore(redTeam);
  const blueScore = teamScore(blueTeam);
  const difference = Math.round(Math.abs(redScore - blueScore) * 10) / 10;
  const differencePercent = scoreDifferencePercent(redTeam, blueTeam);
  const redPosition = positionRisksForTeam(redTeam, format);
  const bluePosition = positionRisksForTeam(blueTeam, format);
  const positionRiskCount = redPosition.missingCount + bluePosition.missingCount;
  const balance = Math.max(0, Math.round(100 - differencePercent));
  return {
    redScore,
    blueScore,
    difference,
    differencePercent,
    differenceText: `${differencePercent.toFixed(1)}%`,
    balance,
    positionRiskCount,
    positionRisks: {
      red: redPosition.risks,
      blue: bluePosition.risks
    },
    positionRiskTexts: {
      red: redPosition.risks.join("、"),
      blue: bluePosition.risks.join("、")
    },
    needsManualAdjustment: differencePercent >= BALANCE_THRESHOLD,
    balanceHint: differencePercent < BALANCE_THRESHOLD
      ? "两队分差符合小于 15% 的目标"
      : "当前分差较大，建议手动调整相近评分球员"
  };
}

function objective(redTeam, blueTeam, format) {
  const result = evaluateTeams(redTeam, blueTeam, format);
  const sizePenalty = Math.abs(redTeam.length - blueTeam.length) * 1000;
  return sizePenalty + result.differencePercent * 10 + result.positionRiskCount * 20;
}

function optimizeBySwaps(redInput, blueInput, format) {
  let redTeam = redInput.slice();
  let blueTeam = blueInput.slice();
  let currentObjective = objective(redTeam, blueTeam, format);

  for (let round = 0; round < 20; round += 1) {
    let best = null;
    for (let redIndex = 0; redIndex < redTeam.length; redIndex += 1) {
      for (let blueIndex = 0; blueIndex < blueTeam.length; blueIndex += 1) {
        const nextRed = redTeam.slice();
        const nextBlue = blueTeam.slice();
        nextRed[redIndex] = blueTeam[blueIndex];
        nextBlue[blueIndex] = redTeam[redIndex];
        const nextObjective = objective(nextRed, nextBlue, format);
        if (nextObjective + 0.01 < currentObjective && (!best || nextObjective < best.objective)) {
          best = { redTeam: nextRed, blueTeam: nextBlue, objective: nextObjective };
        }
      }
    }
    if (!best) break;
    redTeam = best.redTeam;
    blueTeam = best.blueTeam;
    currentObjective = best.objective;
  }
  return { redTeam, blueTeam };
}

function ensureGoalkeeperSplit(redInput, blueInput) {
  const redTeam = redInput.slice();
  const blueTeam = blueInput.slice();
  const redGoalkeepers = redTeam.filter((item) => item.primaryRole === "goalkeeper");
  const blueGoalkeepers = blueTeam.filter((item) => item.primaryRole === "goalkeeper");
  if (redGoalkeepers.length >= 1 && blueGoalkeepers.length >= 1) return { redTeam, blueTeam };

  const source = redGoalkeepers.length >= 2 ? redTeam : blueGoalkeepers.length >= 2 ? blueTeam : null;
  const target = source === redTeam ? blueTeam : source === blueTeam ? redTeam : null;
  if (!source || !target) return { redTeam, blueTeam };
  const keeperIndex = source.findIndex((item, index) => item.primaryRole === "goalkeeper" && index > source.findIndex((first) => first.primaryRole === "goalkeeper"));
  if (keeperIndex < 0) return { redTeam, blueTeam };
  let targetIndex = 0;
  let smallestGap = Infinity;
  target.forEach((item, index) => {
    if (item.primaryRole === "goalkeeper") return;
    const gap = Math.abs(item.score - source[keeperIndex].score);
    if (gap < smallestGap) {
      smallestGap = gap;
      targetIndex = index;
    }
  });
  const temporary = source[keeperIndex];
  source[keeperIndex] = target[targetIndex];
  target[targetIndex] = temporary;
  return { redTeam, blueTeam };
}

function balanceTeams(players, options = {}) {
  const format = formationTargets[options.format] ? options.format : "5v5";
  const normalized = normalizePlayers(players)
    .sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
  const initial = snakeDistribute(normalized);
  const goalkeeperBalanced = ensureGoalkeeperSplit(initial.redTeam, initial.blueTeam);
  const optimized = optimizeBySwaps(goalkeeperBalanced.redTeam, goalkeeperBalanced.blueTeam, format);
  const finalGoalkeepers = ensureGoalkeeperSplit(optimized.redTeam, optimized.blueTeam);
  return {
    format,
    redTeam: finalGoalkeepers.redTeam,
    blueTeam: finalGoalkeepers.blueTeam,
    ...evaluateTeams(finalGoalkeepers.redTeam, finalGoalkeepers.blueTeam, format)
  };
}

module.exports = {
  BALANCE_THRESHOLD,
  DEFAULT_SCORE,
  balanceTeams,
  clampScore,
  evaluateTeams,
  formationTargets,
  normalizePlayer,
  normalizePlayers,
  parsePositions,
  positionRisksForTeam,
  rankBonuses,
  roleForPosition,
  snakeDistribute,
  teamScore
};
