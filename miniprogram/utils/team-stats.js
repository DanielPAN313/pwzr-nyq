const TEAM_STORAGE_KEY = "nyq_local_teams";
const GAME_STORAGE_KEY = "nyq_local_team_games";

const fallbackTeams = [
  {
    id: "demo-team-1",
    name: "南师附中校友足球队",
    sport: "football",
    badgeText: "宁",
    badgeColor: "#D8FF3E",
    homeVenue: "卡子门足球场",
    captainName: "王一鸣",
    captainUserId: 1,
    memberCount: 18,
    averageLevel: 72,
    activityTime: "每周三、周六晚",
    levelRequirement: "进阶及以上",
    acceptsTrial: true,
    requiresApproval: true,
    description: "固定训练和周末约战并行，欢迎中后场与门将参加试训。",
    tags: ["长期招人", "竞技", "5v5"],
    joined: true,
    members: [
      { id: "m-1", userId: 1, name: "宁约球体验用户", role: "captain", level: 78, attendance: 16 },
      { id: "m-2", userId: 12, name: "赵子墨", role: "member", level: 74, attendance: 15 },
      { id: "m-3", userId: 13, name: "孙晨", role: "member", level: 71, attendance: 14 },
      { id: "m-4", userId: 14, name: "胡宇", role: "member", level: 70, attendance: 12 },
      { id: "m-5", userId: 15, name: "郭凯", role: "member", level: 68, attendance: 11 }
    ]
  },
  {
    id: "demo-team-2",
    name: "江宁周末五人制",
    sport: "football",
    badgeText: "江",
    badgeColor: "#4FD1C5",
    homeVenue: "卡子门足球场",
    captainName: "陈启",
    captainUserId: 8,
    memberCount: 12,
    averageLevel: 64,
    activityTime: "周五 20:00、周日 18:00",
    levelRequirement: "不限水平",
    acceptsTrial: true,
    requiresApproval: false,
    description: "节奏轻松、稳定出勤，适合下班后一起踢球的球友。",
    tags: ["休闲", "长期招人", "5v5"],
    joined: false,
    members: [
      { id: "m-21", userId: 8, name: "陈启", role: "captain", level: 69, attendance: 13 },
      { id: "m-22", userId: 21, name: "刘航", role: "member", level: 65, attendance: 12 },
      { id: "m-23", userId: 22, name: "周子豪", role: "member", level: 63, attendance: 10 },
      { id: "m-24", userId: 23, name: "李昊然", role: "member", level: 60, attendance: 9 }
    ]
  }
];

const fallbackGames = [
  {
    id: "demo-game-1",
    teamId: "demo-team-1",
    type: "training",
    title: "周三队内对抗训练",
    venueName: "卡子门足球场",
    startTime: "2026-07-29 20:00:00",
    capacity: 16,
    signupCount: 12,
    fee: 30,
    status: "open",
    joined: true,
    notes: "黄绿两套球衣，提前 15 分钟到场热身。"
  },
  {
    id: "demo-game-2",
    teamId: "demo-team-1",
    type: "recruiting",
    title: "周末五人制公开招募",
    venueName: "卡子门足球场",
    startTime: "2026-08-01 19:30:00",
    capacity: 12,
    signupCount: 8,
    fee: 38,
    status: "open",
    joined: false,
    notes: "还缺 1 名门将和 2 名边路球员。"
  },
  {
    id: "demo-game-3",
    teamId: "demo-team-1",
    type: "challenge",
    title: "与江宁联队友谊赛",
    opponentName: "江宁联队",
    venueName: "卡子门足球场",
    startTime: "2026-07-20 18:30:00",
    capacity: 18,
    signupCount: 18,
    fee: 45,
    status: "finished",
    joined: true,
    resultText: "3 : 2 胜",
    notes: "赛后已完成出勤统计。"
  },
  {
    id: "demo-game-4",
    teamId: "demo-team-2",
    type: "training",
    title: "周五晚队内训练",
    venueName: "卡子门足球场",
    startTime: "2026-07-31 20:00:00",
    capacity: 10,
    signupCount: 7,
    fee: 35,
    status: "open",
    joined: false,
    notes: "轻强度训练，欢迎新成员第一次参加。"
  }
];

const typeMeta = {
  training: { label: "队内训练赛", shortLabel: "训练赛" },
  recruiting: { label: "公开招人球局", shortLabel: "公开招人" },
  challenge: { label: "球队约战", shortLabel: "球队约战" }
};

function readList(key) {
  const value = wx.getStorageSync(key);
  return Array.isArray(value) ? value : [];
}

function writeList(key, list) {
  const value = Array.isArray(list) ? list : [];
  wx.setStorageSync(key, value);
  return value;
}

function firstCharacter(value) {
  return String(value || "队").trim().slice(0, 1) || "队";
}

function normalizeMember(member, index = 0) {
  const name = member.name || member.nick_name || member.nickname || member.username || `队员 ${index + 1}`;
  const role = member.role === "captain" ? "captain" : "member";
  return {
    id: member.id || member.user_id || `member-${index}`,
    userId: Number(member.userId || member.user_id || 0),
    name,
    avatarText: firstCharacter(name),
    role,
    roleText: role === "captain" ? "队长" : "队员",
    level: Math.round(Number(member.level || member.composite_score || 50)),
    attendance: Number(member.attendance || member.attendance_count || 0),
    status: member.status || "active"
  };
}

function normalizeTeam(team) {
  const members = Array.isArray(team.members) ? team.members.map(normalizeMember) : [];
  const name = team.name || "未命名球队";
  const tags = Array.isArray(team.tags)
    ? team.tags
    : Array.isArray(team.tags_json)
      ? team.tags_json
      : [team.long_term_recruiting === false ? "稳定阵容" : "长期招人", team.competition_tag || "休闲", team.format_tag || "5v5"];
  const memberCount = Number(team.memberCount || team.member_count || members.length || 0);
  const averageLevel = Math.round(Number(team.averageLevel || team.average_level || 50));
  return {
    ...team,
    id: String(team.id || `team-${Date.now()}`),
    name,
    sport: team.sport || "football",
    badgeUrl: team.badgeUrl || team.badge_url || "",
    badgeText: team.badgeText || firstCharacter(name),
    badgeColor: team.badgeColor || team.badge_color || "#D8FF3E",
    homeVenue: "卡子门足球场",
    captainName: team.captainName || team.captain_username || "队长待定",
    captainUserId: Number(team.captainUserId || team.captain_user_id || 0),
    memberCount,
    memberLimit: Number(team.memberLimit || team.member_limit || 20),
    memberText: `${memberCount} 人`,
    averageLevel,
    averageLevelText: `平均 ${averageLevel} 分`,
    activityTime: team.activityTime || team.activity_time || "活动时间待定",
    levelRequirement: team.levelRequirement || team.level_requirement || "不限水平",
    acceptsTrial: team.acceptsTrial !== undefined ? Boolean(team.acceptsTrial) : team.accepts_trial !== 0,
    requiresApproval: team.requiresApproval !== undefined ? Boolean(team.requiresApproval) : team.requires_approval !== 0,
    description: team.description || "球队资料完善中。",
    tags: tags.filter(Boolean).slice(0, 4),
    joined: Boolean(team.joined || team.is_joined || team.is_member),
    joinPending: Boolean(team.joinPending || team.join_pending),
    members
  };
}

function normalizeGame(game) {
  const type = typeMeta[game.type] ? game.type : "training";
  const startTime = game.startTime || game.start_time || "时间待定";
  const capacity = Number(game.capacity || 0);
  const signupCount = Number(game.signupCount || game.signup_count || 0);
  return {
    ...game,
    id: String(game.id || `team-game-${Date.now()}`),
    teamId: String(game.teamId || game.team_id || ""),
    type,
    typeLabel: typeMeta[type].label,
    typeShortLabel: typeMeta[type].shortLabel,
    title: game.title || typeMeta[type].label,
    venueName: "卡子门足球场",
    opponentName: game.opponentName || game.opponent_name || "",
    startTime,
    timeText: String(startTime).replace(/:00$/, "").replace("T", " "),
    capacity,
    signupCount,
    slotsText: capacity ? `${signupCount}/${capacity} 人` : `${signupCount} 人已报名`,
    fee: Number(game.fee || game.fee_per_person || 0),
    feeText: Number(game.fee || game.fee_per_person || 0) ? `¥${Number(game.fee || game.fee_per_person)}/人` : "免费",
    status: game.status || "open",
    statusText: game.status === "finished" ? "已结束" : game.status === "cancelled" ? "已取消" : "报名中",
    joined: Boolean(game.joined || game.is_joined),
    notes: game.notes || ""
  };
}

function mergeById(...groups) {
  const map = new Map();
  groups.forEach((group) => {
    const items = Array.isArray(group) ? group : [group];
    items.filter(Boolean).forEach((item) => map.set(String(item.id), item));
  });
  return Array.from(map.values());
}

function getLocalTeams() {
  return readList(TEAM_STORAGE_KEY).map(normalizeTeam);
}

function getTeams(remoteTeams = []) {
  const remote = Array.isArray(remoteTeams) ? remoteTeams.map(normalizeTeam) : [];
  return mergeById(fallbackTeams.map(normalizeTeam), remote, getLocalTeams());
}

function getTeamById(id, remoteTeam) {
  if (remoteTeam) return normalizeTeam(remoteTeam);
  return getTeams().find((team) => String(team.id) === String(id)) || null;
}

function getTeamMembers(team, remoteMembers) {
  const source = Array.isArray(remoteMembers) && remoteMembers.length ? remoteMembers : team?.members || [];
  return source.map(normalizeMember);
}

function getLocalGames() {
  return readList(GAME_STORAGE_KEY).map(normalizeGame);
}

function getTeamGames(teamId, remoteGames = []) {
  const all = mergeById(fallbackGames.map(normalizeGame), (remoteGames || []).map(normalizeGame), getLocalGames());
  return all
    .filter((game) => String(game.teamId) === String(teamId))
    .sort((left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime());
}

function buildTeamStats(team, members = [], games = []) {
  const activeMembers = members.filter((member) => member.status === "active");
  const levelValues = activeMembers.map((member) => Number(member.level || 0)).filter((value) => value > 0);
  const calculatedLevel = levelValues.length
    ? Math.round(levelValues.reduce((sum, value) => sum + value, 0) / levelValues.length)
    : 0;
  const attendanceRanking = activeMembers
    .slice()
    .sort((left, right) => right.attendance - left.attendance)
    .slice(0, 5)
    .map((member, index) => ({ ...member, rank: index + 1 }));
  const finishedGames = games.filter((game) => game.status === "finished");
  const totalAttendance = activeMembers.reduce((sum, member) => sum + Number(member.attendance || 0), 0);
  return {
    memberCount: Number(team?.memberCount || activeMembers.length),
    averageLevel: Number(team?.averageLevel || calculatedLevel || 50),
    attendanceCount: totalAttendance,
    attendanceRate: activeMembers.length ? Math.min(100, Math.round(totalAttendance / activeMembers.length / 16 * 100)) : 0,
    gameCount: games.length,
    finishedGameCount: finishedGames.length,
    attendanceRanking,
    recentGames: games.slice(0, 3)
  };
}

function saveLocalTeam(payload, currentUser, explicitId) {
  const existing = getLocalTeams();
  const id = String(explicitId || payload.id || `local-team-${Date.now()}`);
  const current = existing.find((team) => String(team.id) === id);
  const user = currentUser || {};
  const captain = normalizeMember({
    id: user.id || "local-captain",
    user_id: user.id || 0,
    name: user.nickName || user.username || "我",
    role: "captain",
    level: user.compositeScore || 50,
    attendance: 0
  });
  const team = normalizeTeam({
    ...(current || {}),
    ...payload,
    id,
    captainUserId: user.id || payload.captainUserId || 0,
    captainName: user.nickName || user.username || payload.captainName || "我",
    memberCount: current?.memberCount || 1,
    joined: payload.joined !== undefined ? Boolean(payload.joined) : true,
    members: current?.members?.length ? current.members : [captain]
  });
  writeList(TEAM_STORAGE_KEY, [team, ...existing.filter((item) => String(item.id) !== id)]);
  return team;
}

function recordLocalJoin(teamId, currentUser, pending = false) {
  const team = getTeamById(teamId);
  if (!team) return null;
  const user = currentUser || {};
  const member = normalizeMember({
    id: user.id || `local-member-${Date.now()}`,
    user_id: user.id || 0,
    name: user.nickName || user.username || "体验球友",
    role: "member",
    level: user.compositeScore || 50,
    attendance: 0,
    status: pending ? "pending" : "active"
  });
  return saveLocalTeam({
    ...team,
    joined: !pending,
    joinPending: pending,
    memberCount: pending ? team.memberCount : team.memberCount + (team.joined ? 0 : 1),
    members: team.members.some((item) => String(item.userId) === String(member.userId)) ? team.members : [...team.members, member]
  }, { id: team.captainUserId, username: team.captainName }, team.id);
}

function saveLocalGame(payload, explicitId) {
  const existing = getLocalGames();
  const id = String(explicitId || payload.id || `local-team-game-${Date.now()}`);
  const game = normalizeGame({ ...payload, id });
  writeList(GAME_STORAGE_KEY, [game, ...existing.filter((item) => String(item.id) !== id)]);
  return game;
}

function signupLocalGame(gameId) {
  const game = mergeById(fallbackGames.map(normalizeGame), getLocalGames()).find((item) => String(item.id) === String(gameId));
  if (!game) return null;
  const updated = normalizeGame({
    ...game,
    joined: true,
    signupCount: Math.min(game.capacity || game.signupCount + 1, game.signupCount + (game.joined ? 0 : 1))
  });
  saveLocalGame(updated, updated.id);
  return updated;
}

function isLocalId(id) {
  return /^(?:local|demo)-/.test(String(id || ""));
}

module.exports = {
  buildTeamStats,
  fallbackGames,
  fallbackTeams,
  getLocalGames,
  getLocalTeams,
  getTeamById,
  getTeamGames,
  getTeamMembers,
  getTeams,
  isLocalId,
  normalizeGame,
  normalizeMember,
  normalizeTeam,
  recordLocalJoin,
  saveLocalGame,
  saveLocalTeam,
  signupLocalGame,
  typeMeta
};
