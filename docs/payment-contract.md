# 支付与退款预留契约

更新时间：2026-07-23

## 当前模式

小程序统一从 `miniprogram/utils/payment/index.js` 发起支付。当前 `USE_MOCK = true`，模拟支付等待 1 秒后成功，不会产生真实扣款。

页面不得直接调用 `wx.requestPayment`。正式切换微信支付时，只替换 `wechat.js` 适配层和后端商户接口。

## 支付结果

模拟支付返回：

- `success`
- `orderId`
- `payTime`
- `amount`
- `venueId`
- `matchId`
- `transactionId`（预留）
- `merchantId`（预留）

标准状态流转：

```text
pending_pay -> paid/offline_paid -> pending_verify -> verified
```

后端兼容历史状态 `pending_payment` 和 `checked_in`，前端统一映射为 `pending_pay` 和 `verified`。

## 模拟退款

- 开场前 24 小时以上：退 100%。
- 开场前 2-24 小时：退 50%。
- 开场前 2 小时以内：不退款。
- 场馆取消：退 100%。
- 天气或不可抗力：预留人工协商原因。
- 用户申请后 48 小时未处理：自动变为 `refunded`，并发送“自动处理（模拟）”消息。

## 商户配置

前端 `venue-config.js` 只保留 `kazimen` 的空 `merchantId` 字段和接入状态，不保存 API 密钥、证书、私钥或签名材料。

真实商户号、API v3 密钥、证书和回调验签逻辑必须存放在后端安全配置中，不得写入小程序代码、仓库或 `project.private.config.json`。
