const { get, post } = require("../../utils/api");
const { getStoredUser } = require("../../utils/auth");
const { appendLocalNotification } = require("../../utils/notifications");
const { buildSharePayload } = require("../../utils/share");

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
  const currentOrder = detail.current_order || detail.order || null;
  const orderStatus = currentOrder ? (currentOrder.status === "pending_pay" ? "pending_payment" : currentOrder.status) : "";
  const canJoin = Boolean(game.id) && !game.is_joined && !currentOrder && ["forming", "open"].includes(game.status) && missingCount > 0;
  const cancelRule = buildCancelRule(currentOrder, game.start_time);
  const venueName = "卡子门足球场";
  const address = game.address || "";
  const notes = game.notes || "";

  return {
    id: game.id,
    title: game.title || "未命名球局",
    matchType: game.match_type || game.game_type || game.type || "casual",
    joinedCount: playerCount,
    feeAmount: fee,
    format: game.format || game.mode || "5v5",
    statusText: statusText[game.status] || game.status || "未知状态",
    statusTone: step.tone,
    venueName,
    area: game.area || "",
    address,
    startText: formatTime(game.start_time),
    endText: formatTime(game.end_time),
    capacity,
    feeText: fee ? `¥${fee}/人` : "免费/AA",
    notes,
    hasVenueInfo: Boolean(address || notes),
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
    canJoin,
    joinText: canJoin ? "提交报名" : game.is_joined ? "已报名" : "暂不可报名",
    currentOrder,
    orderId: currentOrder?.id || "",
    orderStatus,
    canCancel: Boolean(cancelRule?.canCancel),
    cancelLabel: cancelRule?.label || "取消报名",
    cancelContent: cancelRule?.content || "取消后将释放报名名额，确定取消？",
    cancelStatusText: cancelRule?.statusText || "",
    players,
    reviewablePlayers,
    playerCount,
    reviewOpen: Boolean(detail.review_open),
    reviewedCount: reviewedIds.length
  };
}

function buildCancelRule(order, startTime) {
  if (!order) return null;
  const status = order.status === "pending_pay" ? "pending_payment" : order.status;
  if (!["pending_payment", "paid", "offline_paid"].includes(status)) return null;
  if (order.can_cancel === false) return { canCancel: false, statusText: "当前时间不可取消" };
  if (status === "pending_payment") {
    return {
      canCancel: true,
      label: "取消报名",
      statusText: "未支付订单将直接取消",
      content: "取消后将扣除信用分 0 分，退款 0%（无需退款），确定取消？"
    };
  }
  const startAt = new Date(order.start_time || startTime).getTime();
  const hours = Number.isNaN(startAt) ? 48 : (startAt - Date.now()) / (60 * 60 * 1000);
  const refundPercent = hours > 24 ? 100 : hours > 2 ? 50 : 0;
  const penalty = hours > 24 ? 0 : hours > 2 ? 3 : 8;
  const amount = Number(order.amount || 0);
  const refundAmount = Math.round(amount * refundPercent) / 100;
  return {
    canCancel: true,
    label: hours > 2 ? "取消并申请退款" : "取消报名（不退款）",
    statusText: refundPercent ? `模拟退款 ${refundPercent}%` : "取消后不退款",
    content: `取消后将扣除信用分 ${penalty} 分，退款 ${refundPercent}%（¥${refundAmount.toFixed(2)}），确定取消？`,
    refundPercent,
    penalty,
    refundAmount
  };
}

function mapPreviewDetail(query) {
  const title = decodeURIComponent(query.title || "附近球局");
  const venue = decodeURIComponent(query.venue || "卡子门足球场");
  const desc = decodeURIComponent(query.desc || "名额和时间以球局列表为准");
  const fee = decodeURIComponent(query.fee || "免费/AA");

  return {
    title,
    statusText: "体验版",
    statusTone: "preview",
    venueName: venue,
    area: "",
    address: "这是首页卡片预览，连接后端真实球局后可直接提交报名。",
    startText: desc,
    endText: "",
    capacity: 0,
    feeText: fee,
    notes: "点击下方按钮可先去球局页选择真实可报名场次。",
    hasVenueInfo: true,
    infoCards: [
      { label: "时间", value: desc || "待定" },
      { label: "场馆", value: venue },
      { label: "费用", value: fee }
    ],
    stepTitle: "确认报名信息",
    stepText: "真实球局会在这里显示报名按钮，提交后生成待支付订单。",
    stepTone: "warning",
    missingText: "待同步",
    progressPercent: 0,
    canJoin: false,
    joinText: "去球局页报名",
    previewOnly: true,
    players: [],
    reviewablePlayers: [],
    playerCount: 0,
    reviewOpen: false,
    reviewedCount: 0
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
    joiningId: "",
    submittingReview: false,
    reviewHint: "",
    error: "",
    detail: null,
    inviter: ""
  },

  onLoad(query) {
    const id = query && query.id ? idString(query.id) : "";
    const reviewHint = query && query.review ? "订单已核销，赛后互评开放后可在这里提交。" : "";
    const previewOnly = query && query.preview && !/^\d+$/.test(id);
    this.setData({
      id,
      inviter: query?.inviter || "",
      reviewHint,
      detail: previewOnly ? mapPreviewDetail(query || {}) : null
    });
    wx.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage"] });
    if (previewOnly) return;
    this.loadDetail();
  },

  onShareAppMessage(event) {
    const user = getStoredUser() || {};
    const templateType = event?.target?.dataset?.template || "";
    return buildSharePayload({
      ...(this.data.detail || {}),
      id: this.data.id || this.data.detail?.id
    }, user.id || user.username || "nyq-player", templateType);
  },

  copyInvitePath() {
    const payload = this.onShareAppMessage({ target: { dataset: {} } });
    wx.setClipboardData({
      data: payload.path,
      success() {
        wx.showToast({ title: "邀请路径已复制", icon: "success" });
      }
    });
  },

  onPullDownRefresh() {
    this.loadDetail().finally(() => wx.stopPullDownRefresh());
  },

  retryLoadDetail() {
    this.loadDetail();
  },

  goGames() {
    wx.navigateTo({ url: "/pages/games/games" });
  },

  goOrders() {
    wx.navigateTo({ url: "/pages/orders/orders" });
  },

  submitJoinGame() {
    const detail = this.data.detail;

    if (detail && detail.previewOnly) {
      wx.navigateTo({ url: "/pages/games/games" });
      return;
    }

    const id = this.data.id;
    if (!id || this.data.joiningId || !detail || !detail.canJoin) return;

    this.setData({ joiningId: id });

    post(`/api/sports-app/games/${id}/join`, {}, { loadingTitle: "报名中" })
      .then((result) => {
        wx.showToast({
          title: result.order_id ? "已生成待支付订单" : "报名成功",
          icon: "success"
        });

        if (result.order_id) {
          wx.navigateTo({ url: `/pages/orders/orders?orderId=${result.order_id}` });
          return null;
        }

        return this.loadDetail();
      })
      .catch(() => {
        wx.showToast({
          title: "报名未完成，请稍后重试",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ joiningId: "" });
      });
  },

  cancelRegistration() {
    const detail = this.data.detail;
    const orderId = detail?.orderId;
    if (!detail || !orderId || !detail.canCancel || this.data.joiningId) return;

    wx.showModal({
      title: "确认取消报名？",
      content: detail.cancelContent,
      confirmText: "确定取消",
      confirmColor: "#b42318",
      success: (result) => {
        if (!result.confirm) return;
        this.setData({ joiningId: `cancel-${orderId}` });
        post(`/api/sports-app/orders/${orderId}/cancel`, {}, { loadingTitle: "取消中" })
          .then((payload) => {
            appendLocalNotification({
              type: "order_cancelled",
              title: "报名已取消",
              body: `您已取消报名，信用分 -${Math.abs(Number(payload.penalty) || 0)}${payload.status === "refunding" ? "，模拟退款处理中" : ""}`,
              orderId,
              gameId: this.data.id
            });
            wx.showToast({ title: payload.status === "refunding" ? "已提交取消" : "报名已取消", icon: "success" });
            return this.loadDetail();
          })
          .catch(() => {
            appendLocalNotification({
              type: "order_cancelled",
              title: "报名已取消",
              body: `您已取消报名，信用分 -${detail.cancelContent.includes("8 分") ? 8 : detail.cancelContent.includes("3 分") ? 3 : 0}`,
              orderId,
              gameId: this.data.id
            });
            this.setData({
              detail: {
                ...detail,
                canCancel: false,
                canJoin: false,
                orderStatus: "cancelled",
                cancelStatusText: "已取消"
              }
            });
            wx.showToast({ title: "报名已取消（本地演示）", icon: "success" });
          })
          .finally(() => this.setData({ joiningId: "" }));
      }
    });
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
      .catch(() => {
        this.setData({
          loading: false,
          error: ""
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
      .catch(() => {
        wx.showToast({
          title: "评价未提交，请稍后重试",
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
