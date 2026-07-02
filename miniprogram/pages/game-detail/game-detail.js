const { get } = require("../../utils/api");

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

function mapPlayer(player) {
  return {
    userId: player.user_id,
    username: player.username || "球友",
    checkedInText: Number(player.checked_in || 0) === 1 ? "已到场" : "待到场",
    level: player.level_label || "进阶",
    score: Number(player.composite_score || 3).toFixed(1)
  };
}

function mapDetail(detail) {
  const game = detail.game || {};
  const players = Array.isArray(detail.players) ? detail.players.map(mapPlayer) : [];
  const fee = Number(game.fee_per_person || 0);

  return {
    title: game.title || "未命名球局",
    statusText: statusText[game.status] || game.status || "未知状态",
    venueName: game.venue_name || "场馆待定",
    area: game.area || "",
    address: game.address || "",
    startText: formatTime(game.start_time),
    endText: formatTime(game.end_time),
    capacity: Number(game.capacity || 0),
    feeText: fee ? `¥${fee}/人` : "免费/AA",
    notes: game.notes || "暂无备注",
    players,
    playerCount: players.length,
    reviewOpen: Boolean(detail.review_open)
  };
}

Page({
  data: {
    id: "",
    loading: false,
    error: "",
    detail: null
  },

  onLoad(query) {
    const id = query && query.id ? query.id : "";
    this.setData({ id });
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
        this.setData({
          loading: false,
          detail: mapDetail(detail)
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || "球局详情加载失败"
        });
      });
  }
});
