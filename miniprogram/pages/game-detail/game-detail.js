const { get, post } = require("../../utils/api");
const { getStoredUser } = require("../../utils/auth");

const statusText = {
  forming: "待成局",
  open: "可报名",
  locked: "已满员",
  pending_checkin: "待核销",
  checked_in: "已核销",
  review_open: "待评价",
  completed: "已完成",
  cancelled: "已取消"
};

function formatTime(value) {
  if (!value) return "时间待定";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day} ${hour}:${minute}`;
}

function mapPlayer(player, reviewedIds, currentUserId) {
  const userId = Number(player.user_id || 0);
  const checkedIn = Number(player.checked_in || 0) === 1;
  const reviewed = reviewedIds.includes(userId);
  const isSelf = currentUserId && Number(currentUserId) === userId;

  return {
    userId,
    username: player.username || "球友",
    checkedIn,
    reviewed,
    isSelf,
    reviewable: checkedIn && !reviewed && !isSelf,
    checkedInText: checkedIn ? "已到场" : "待到场",
    reviewText: reviewed ? "已评价" : checkedIn && !isSelf ? "可评价" : "",
    level: player.level_label || "进阶",
    score: Number(player.composite_score || 3).toFixed(1)
  };
}

function gameStep(game, players, currentUserId, reviewOpen, reviewablePlayers) {
  const status = game.status || "";
  const isJoined = players.some((player) => player.isSelf);
  const checkedInSelf = players.some((player) => player.isSelf && player.checkedIn);
  const capacity = Number(game.capacity || 0);
  const missing = Math.max(capacity - players.length, 0);

  if (reviewOpen && reviewablePlayers.length > 0) {
    return {
      tone: "success",
      title: "下一步：赛后互评",
      text: `还有 ${reviewablePlayers.length} 位已到场队友可评价，提交后会更新队友实力分。`
    };
  }

  if (checkedInSelf) {
    return {
      tone: "success",
      title: "你已完成到场核销",
      text: "等待互评开放或查看本场球友到场状态。"
    };
  }

  if (isJoined) {
    return {
      tone: "info",
      title: "你已报名占位",
      text: "请按时到场，支付订单里会显示核销码。"
    };
  }

  if (["forming", "open"].includes(status) && missing > 0) {
    return {
      tone: "warning",
      title: "可报名参加",
      text: `当前还缺 ${missing} 人，报名后会生成待支付订单，支付后正式占位。`
    };
  }

  if (status === "locked") {
    return {
      tone: "muted",
      title: "球局已满员",
      text: "可以返回球局列表看看其他可报名场次。"
    };
  }

  return {
    tone: "neutral",
    title: statusText[status] || "查看球局状态",
    text: "请关注订单、核销和消息提醒里的后续动作。"
  };
}

function mapDetail(detail) {
  const game = detail.game || {};
  const reviewedIds = Array.isArray(detail.reviewed_target_ids) ? detail.reviewed_target_ids.map(Number) : [];
  const currentUser = getStoredUser() || {};
  const players = Array.isArray(detail.players)
    ? detail.players.map((player) => mapPlayer(player, reviewedIds, currentUser.id))
    : [];
  const fee = Number(game.fee_per_person || 0);
  const reviewablePlayers = players.filter((player) => player.reviewable);
  const capacity = Number(game.capacity || 0);
  const playerCount = players.length;
  const missingCount = Math.max(capacity - playerCount, 0);
  const progressPercent = capacity ? Math.min(Math.round((playerCount / capacity) * 100), 100) : 0;
  const step = gameStep(game, players, currentUser.id, Boolean(detail.review_open), reviewablePlayers);

  return {
    title: game.title || "未命名球局",
    statusText: statusText[game.status] || game.status || "未知状态",
    statusTone: step.tone,
    venueName: game.venue_name || "场馆待定",
    area: game.area || "",
    address: game.address || "",
    startText: formatTime(game.start_time),
    endText: formatTime(game.end_time),
    capacity,
    feeText: fee ? `¥${fee}/人` : "免费/AA",
    notes: game.notes || "暂无备注",
    infoCards: [
      { label: "开始", value: formatTime(game.start_time) },
      { label: "人数", value: `${playerCount}/${capacity || "?"}` },
      { label: "费用", value: fee ? `¥${fee}/人` : "免费/AA" }
    ],
    stepTitle: step.title,
    stepText: step.text,
    stepTone: step.tone,
    missingText: missingCount > 0 ? `还缺 ${missingCount} 人` : "人数已满",
    progressPercent,
    players,
    reviewablePlayers,
    playerCount,
    reviewOpen: Boolean(detail.review_open),
    reviewedCount: reviewedIds.length
  };
}

function buildPraiseReviews(players) {
  return players.map((player) => ({
    target_user_id: player.userId,
    preset: "expert",
    anonymous: true
  }));
}

Page({
  data: {
    id: "",
    loading: false,
    submittingReview: false,
    reviewHint: "",
    error: "",
    detail: null
  },

  onLoad(query) {
    const id = query && query.id ? idString(query.id) : "";
    const reviewHint = query && query.review ? "订单已核销，赛后互评开放后可在这里提交。" : "";
    this.setData({ id, reviewHint });
    this.loadDetail();
  },

  onPullDownRefresh() {
    this.loadDetail().finally(() => wx.stopPullDownRefresh());
  },

  loadDetail() {
    const id = this.data.id;
    if (!id) {
      this.setData({ error: "缺少球局 ID" });
      return Promise.resolve();
    }

    this.setData({ loading: true, error: "" });

    return get(`/api/sports-app/games/${id}`, { showLoading: false })
      .then((detail) => {
        const mapped = mapDetail(detail);
        this.setData({
          loading: false,
          detail: mapped,
          reviewHint: mapped.reviewOpen
            ? "互评已开放，可以给已到场队友提交赛后好评。"
            : this.data.reviewHint
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "球局详情加载失败"
        });
      });
  },

  submitPraiseReviews() {
    const detail = this.data.detail;
    if (!detail || !detail.reviewOpen || this.data.submittingReview) return;

    const reviews = buildPraiseReviews(detail.reviewablePlayers);
    if (reviews.length === 0) {
      wx.showToast({
        title: "暂无可评价队友",
        icon: "none"
      });
      return;
    }

    this.setData({ submittingReview: true });

    post(`/api/sports-app/games/${this.data.id}/reviews`, { reviews }, { loadingTitle: "提交中" })
      .then((result) => {
        wx.showToast({
          title: `已提交${result.saved || reviews.length}条评价`,
          icon: "success"
        });

        return this.loadDetail();
      })
      .catch((error) => {
        wx.showToast({
          title: error.message || "评价失败",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ submittingReview: false });
      });
  }
});

function idString(value) {
  return String(value || "").trim();
}
