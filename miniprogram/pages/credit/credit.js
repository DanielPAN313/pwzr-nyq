const { get, post } = require("../../utils/api");

const ratingDimensions = [
  { key: "technique", label: "技术动作", hint: "投篮、传球、控球" },
  { key: "physical", label: "身体状态", hint: "速度、体能、爆发" },
  { key: "tactics", label: "战术意识", hint: "跑位、配合、判断" },
  { key: "defense", label: "防守覆盖", hint: "协防、补位、卡位" },
  { key: "attitude", label: "场上态度", hint: "团队、守规、沟通" }
];

const ratingPresets = [
  { key: "beginner", label: "入门", value: 1 },
  { key: "casual", label: "业余", value: 2 },
  { key: "advanced", label: "进阶", value: 3 },
  { key: "expert", label: "高手", value: 4 },
  { key: "master", label: "大神", value: 5 }
];

const fallbackEvents = [
  {
    title: "暂无信用记录",
    note: "完成报名、支付、核销后会在这里生成记录。",
    scoreText: "0",
    timeText: "",
    tone: "neutral"
  }
];

const eventTypeText = {
  paid_signup: "完成报名支付",
  checkin: "到场核销",
  create_game: "发起真实球局",
  review_submitted: "提交赛后互评",
  no_show: "无故缺席",
  late_cancel: "临近开赛取消",
  auto_recovery: "信用自动恢复",
  demo_reset: "开发数据重置"
};

const creditRules = [
  { title: "按时到场", text: "订单核销后会增加信用记录，后续报名更稳定。" },
  { title: "避免爽约", text: "无故缺席会扣信用分，低分会限制订场和发局。" },
  { title: "完成互评", text: "赛后给队友评价，有助于完善球友实力和信用画像。" }
];

const recoveryTips = [
  "优先完成已报名球局的到场核销。",
  "需要取消时尽早处理，避免临近开赛扣分。",
  "赛后互评开放后及时提交。"
];

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day} ${hour}:${minute}`;
}

function formatAverage(value) {
  const next = Number(value == null ? 3 : value);
  if (Number.isNaN(next)) return "3.0";
  return next.toFixed(1);
}

function clampRatingValue(value) {
  const next = Number(value == null ? 3 : value);
  if (Number.isNaN(next)) return 3;
  return Math.max(1, Math.min(5, Math.round(next)));
}

function buildRatingForm(summary) {
  const source = summary || {};

  return {
    technique: clampRatingValue(source.technique_self),
    physical: clampRatingValue(source.physical_self),
    tactics: clampRatingValue(source.tactics_self),
    defense: clampRatingValue(source.defense_self),
    attitude: clampRatingValue(source.attitude_self)
  };
}

function buildRatingInputs(form) {
  return ratingDimensions.map((item) => ({
    ...item,
    value: clampRatingValue(form && form[item.key])
  }));
}

function buildRatingSummary(summary) {
  const source = summary || {};
  const compositeScore = Number(source.composite_score == null ? 3 : source.composite_score);
  const selfScore = Number(source.self_score == null ? 3 : source.self_score);
  const peerScore = source.peer_score == null ? null : Number(source.peer_score);
  const effectivePeerGames = Number(source.effective_peer_games || 0);
  const peerRatingCount = Number(source.peer_rating_count || 0);

  return {
    composite_score: Number.isNaN(compositeScore) ? 3 : compositeScore,
    compositeScoreText: formatAverage(compositeScore),
    level_label: source.level_label || "进阶",
    self_score: Number.isNaN(selfScore) ? 3 : selfScore,
    selfScoreText: formatAverage(selfScore),
    peer_score: peerScore,
    peerScoreText: peerScore == null || Number.isNaN(peerScore) ? "待积累" : formatAverage(peerScore),
    effective_peer_games: effectivePeerGames,
    peer_rating_count: peerRatingCount,
    metaText: `${effectivePeerGames} 场有效互评 · ${peerRatingCount} 条记录`,
    technique_self: clampRatingValue(source.technique_self),
    physical_self: clampRatingValue(source.physical_self),
    tactics_self: clampRatingValue(source.tactics_self),
    defense_self: clampRatingValue(source.defense_self),
    attitude_self: clampRatingValue(source.attitude_self)
  };
}

function ratingHint(summary) {
  const level = summary.level_label || "进阶";
  return `综合 ${summary.compositeScoreText} · ${level} · 提交后 7 天内仅可修改 1 次`;
}

function buildRatingSummaryCards(summary) {
  return [
    { label: "综合分", value: summary.compositeScoreText, hint: summary.level_label },
    { label: "自评分", value: summary.selfScoreText, hint: "当前自评" },
    { label: "互评分", value: summary.peerScoreText, hint: summary.metaText }
  ];
}

function mapCreditEvent(event) {
  const score = Number(event.score_delta || 0);

  return {
    id: event.id,
    eventType: event.event_type || "credit_event",
    title: eventTypeText[event.event_type] || event.event_type || "信用记录",
    note: event.note || "",
    scoreText: score > 0 ? `+${score}` : String(score),
    timeText: formatTime(event.create_time),
    tone: score > 0 ? "positive" : score < 0 ? "negative" : "neutral"
  };
}

function buildEventSections(events) {
  const positive = events.filter((event) => event.tone === "positive");
  const negative = events.filter((event) => event.tone === "negative");
  const neutral = events.filter((event) => event.tone === "neutral");
  const sections = [];

  if (negative.length) sections.push({ title: "需要注意", events: negative });
  if (positive.length) sections.push({ title: "守约加分", events: positive });
  if (neutral.length) sections.push({ title: "普通记录", events: neutral });

  return sections.length ? sections : [{ title: "信用记录", events: fallbackEvents }];
}

function buildScoreCards(summary) {
  const played = Number(summary.played || 0);
  const checkedIn = Number(summary.checked_in || 0);
  const noShows = Number(summary.no_shows || 0);
  const checkinRate = played ? Math.round((checkedIn / played) * 100) : 0;

  return [
    { label: "参与场次", value: played, hint: "报名或发起后计入" },
    { label: "到场核销", value: checkedIn, hint: `${checkinRate}% 到场率` },
    { label: "爽约次数", value: noShows, hint: noShows > 0 ? "后续请尽早取消" : "暂无爽约记录" }
  ];
}

Page({
  data: {
    loading: false,
    error: "",
    score: 100,
    scorePercent: 100,
    level: "守约良好",
    levelTone: "excellent",
    progressHint: "当前信用健康，继续保持按时到场和赛后互评。",
    scoreCards: buildScoreCards({}),
    creditRules,
    recoveryTips,
    ratingDimensions,
    ratingPresets,
    ratingSummary: buildRatingSummary({}),
    ratingSummaryCards: buildRatingSummaryCards(buildRatingSummary({})),
    ratingHint: "综合 3.0 · 进阶 · 提交后 7 天内仅可修改 1 次",
    ratingForm: buildRatingForm({}),
    ratingInputs: buildRatingInputs(buildRatingForm({})),
    ratingDraftAverage: "3.0",
    ratingError: "",
    ratingSubmitting: false,
    events: fallbackEvents,
    eventSections: buildEventSections(fallbackEvents)
  },

  onLoad() {
    this.loadCredit();
  },

  onPullDownRefresh() {
    this.loadCredit().finally(() => wx.stopPullDownRefresh());
  },

  syncRatingState(summary) {
    const ratingSummary = buildRatingSummary(summary || {});
    const ratingForm = buildRatingForm(summary || {});
    const ratingInputs = buildRatingInputs(ratingForm);

    this.setData({
      ratingSummary,
      ratingSummaryCards: buildRatingSummaryCards(ratingSummary),
      ratingHint: ratingHint(ratingSummary),
      ratingForm,
      ratingInputs,
      ratingDraftAverage: formatAverage(ratingForm && (ratingForm.technique + ratingForm.physical + ratingForm.tactics + ratingForm.defense + ratingForm.attitude) / ratingDimensions.length),
      ratingError: ""
    });
  },

  loadCredit() {
    this.setData({ loading: true, error: "", ratingError: "" });

    const profilePromise = get("/api/sports-app/me", { showLoading: false })
      .then((profile) => ({ ok: true, value: profile }))
      .catch((error) => ({ ok: false, error }));

    const ratingPromise = get("/api/sports-app/rating/self", { showLoading: false })
      .then((rating) => ({ ok: true, value: rating }))
      .catch((error) => ({ ok: false, error }));

    return Promise.all([profilePromise, ratingPromise]).then(([profileResult, ratingResult]) => {
      const nextState = { loading: false };

      if (profileResult.ok) {
        const profile = profileResult.value || {};
        const summary = profile.summary || {};
        const score = Number(summary.credit_score || 100);
        const events = Array.isArray(profile.credit) ? profile.credit.map(mapCreditEvent) : [];
        const visibleEvents = events.length ? events : fallbackEvents;

        nextState.score = score;
        nextState.scorePercent = Math.max(0, Math.min(score, 100));
        nextState.level = score >= 90 ? "信用健康" : score >= 80 ? "保持良好" : score >= 60 ? "注意守约" : "信用偏低";
        nextState.levelTone = score >= 90 ? "excellent" : score >= 80 ? "good" : score >= 60 ? "warning" : "danger";
        nextState.progressHint = score >= 90
          ? "当前信用健康，继续保持按时到场和赛后互评。"
          : score >= 80
            ? "仍可正常使用核心功能，建议优先完成核销和互评。"
            : score >= 60
              ? "部分能力可能受限，先把已报名场次按时完成。"
              : "信用较低，建议先通过履约慢慢恢复。";
        nextState.scoreCards = buildScoreCards(summary);
        nextState.events = visibleEvents;
        nextState.eventSections = buildEventSections(visibleEvents);
      } else {
        nextState.error = "";
        nextState.events = fallbackEvents;
        nextState.eventSections = buildEventSections(fallbackEvents);
      }

      if (ratingResult.ok) {
        this.syncRatingState(ratingResult.value || {});
      } else {
        nextState.ratingError = "";
        this.syncRatingState({});
      }

      this.setData(nextState);
    });
  },

  onRatingChange(event) {
    const key = event.currentTarget.dataset.key;
    if (!key) return;

    const nextValue = clampRatingValue(event.detail && event.detail.value);
    const nextForm = {
      ...this.data.ratingForm,
      [key]: nextValue
    };
    const nextInputs = buildRatingInputs(nextForm);
    const draftAverage = formatAverage(
      (nextForm.technique + nextForm.physical + nextForm.tactics + nextForm.defense + nextForm.attitude) /
        ratingDimensions.length
    );

    this.setData({
      ratingForm: nextForm,
      ratingInputs: nextInputs,
      ratingDraftAverage: draftAverage
    });
  },

  applyRatingPreset(event) {
    const score = clampRatingValue(event.currentTarget.dataset.score);
    const nextForm = ratingDimensions.reduce((acc, item) => {
      acc[item.key] = score;
      return acc;
    }, {});

    this.setData({
      ratingForm: nextForm,
      ratingInputs: buildRatingInputs(nextForm),
      ratingDraftAverage: formatAverage(score)
    });
  },

  submitSelfRating() {
    if (this.data.ratingSubmitting) return;

    const body = {
      technique: clampRatingValue(this.data.ratingForm.technique),
      physical: clampRatingValue(this.data.ratingForm.physical),
      tactics: clampRatingValue(this.data.ratingForm.tactics),
      defense: clampRatingValue(this.data.ratingForm.defense),
      attitude: clampRatingValue(this.data.ratingForm.attitude)
    };

    this.setData({ ratingSubmitting: true });

    post("/api/sports-app/rating/self", body, { loadingTitle: "提交自评" })
      .then((result) => {
        const summary = result && result.summary ? result.summary : {};
        const ratingSummary = buildRatingSummary(summary);
        const ratingForm = buildRatingForm(summary);

        this.setData({
          ratingSummary,
          ratingSummaryCards: buildRatingSummaryCards(ratingSummary),
          ratingHint: ratingHint(ratingSummary),
          ratingForm,
          ratingInputs: buildRatingInputs(ratingForm),
          ratingDraftAverage: formatAverage((ratingForm.technique + ratingForm.physical + ratingForm.tactics + ratingForm.defense + ratingForm.attitude) / ratingDimensions.length),
          ratingError: ""
        });

        wx.showToast({
          title: "自评已更新",
          icon: "success"
        });
      })
      .catch(() => {
        wx.showToast({
          title: "自评未提交，请稍后重试",
          icon: "none"
        });
      })
      .finally(() => {
        this.setData({ ratingSubmitting: false });
      });
  },

  goOrders() {
    wx.navigateTo({ url: "/pages/orders/orders" });
  },

  goMyGames() {
    wx.navigateTo({ url: "/pages/my-games/my-games" });
  }
});
