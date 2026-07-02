const legalTabs = [
  { key: "privacy", label: "隐私政策" },
  { key: "agreement", label: "用户协议" },
  { key: "payment", label: "支付说明" },
  { key: "venue", label: "场馆合作" }
];

const legalContent = {
  privacy: {
    title: "隐私政策摘要",
    updatedAt: "开发版草案",
    intro: "宁约球会尽量只收集完成找场、报名、订场、核销和信用记录所需的信息。",
    items: [
      "可能使用微信登录标识、本地开发用户 ID、昵称和基础账号状态。",
      "会记录订单、报名、核销、爽约、互评等履约数据，用于展示信用分和场馆端核销。",
      "正式上线前需要在微信公众平台补齐用户隐私保护指引，并把运营主体、联系方式和生效日期替换为真实信息。"
    ]
  },
  agreement: {
    title: "用户协议摘要",
    updatedAt: "开发版草案",
    intro: "用户需要按时到场、遵守场馆规则，并对自己的报名、订场和评价行为负责。",
    items: [
      "报名或订场后应及时支付，未支付订单不会正式占位。",
      "临近开赛取消或无故缺席可能影响信用分和后续使用权限。",
      "赛后互评应基于真实体验，不应恶意评价或冒用他人身份。"
    ]
  },
  payment: {
    title: "支付与退款说明",
    updatedAt: "开发版草案",
    intro: "当前开发版使用模拟支付，不会真实扣款。正式上线前需要接入微信支付商户能力。",
    items: [
      "本地开发阶段的支付、核销和退款状态仅用于演示流程。",
      "正式交易前需要配置商户号、证书、API v3 key、支付通知验签和退款通知验签。",
      "退款、结算和异常订单处理规则需要在上线前与场馆合作方确认。"
    ]
  },
  venue: {
    title: "场馆合作说明",
    updatedAt: "开发版草案",
    intro: "场馆端用于入驻申请、资料维护、订单查看和到场核销。",
    items: [
      "场馆管理员只能维护和核销自己管理的场馆订单。",
      "开放时段、价格、联系方式会展示到用户端场馆详情页。",
      "正式运营前需要补齐场馆资质审核、结算周期、客服电话和争议处理规则。"
    ]
  }
};

function currentContent(activeKey) {
  return legalContent[activeKey] || legalContent.privacy;
}

Page({
  data: {
    legalTabs,
    activeKey: "privacy",
    content: currentContent("privacy")
  },

  changeTab(event) {
    const key = event.currentTarget.dataset.key || "privacy";

    this.setData({
      activeKey: key,
      content: currentContent(key)
    });
  }
});
