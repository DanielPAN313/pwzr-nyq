# 当前交接快照

更新时间：2026-07-02

这份文档用于快速交接当前小程序状态。详细路线图看 `docs/project-roadmap.md`，逐页自测看 `docs/miniprogram-self-test.md`，UI 标准看 `docs/ui-design-system.md`。

## 当前结论

- 当前主线：微信小程序。
- 当前功能分支：`feature-miniprogram-flow`。
- UI 同伴分支：从 `feature-miniprogram-flow` 新建 `ui-polish`。
- 小程序目录：`miniprogram/`。
- 未注册阶段 AppID：`touristappid`。
- 本地后端：`http://localhost:4174`。
- 当前仍使用开发版模拟登录和模拟支付。

## 先跑这些命令

```bash
git checkout feature-miniprogram-flow
git pull origin feature-miniprogram-flow
npm ci
npm run check
npm run dev
```

微信开发者工具导入：

```text
目录：pwzr-nyq/miniprogram
AppID：touristappid
后端服务：不使用云服务
```

## 当前已覆盖功能

- 首页：统计、快捷入口、待处理事项、推荐场馆、推荐球局。
- 订场：场馆列表、搜索筛选、场馆详情、时段选择、生成待支付订单。
- 球局：球局列表、搜索筛选、发起球局、报名、球局详情、赛后互评。
- 订单：支付、取消、核销码、核销、评价入口。
- 消息：未读/已读分组，跳转关联订单或球局。
- 我的：订单、我的球局、信用分、场馆端、合规说明。
- 场馆端：入驻申请、资料维护、订单列表、核销码核销。
- 合规说明：隐私政策、用户协议、支付说明、场馆合作摘要。

## 当前自动检查

`npm run check` 已覆盖：

- 小程序结构检查。
- 主流程契约检查。
- 小程序运行时检查。
- WXML 事件绑定和 `data-*` 参数检查。
- API 契约检查。
- DB 契约检查。
- 演示数据契约检查。
- H5 小程序预览检查。
- `wx.*` 桥接覆盖检查。
- 协作文档检查。
- 演示准备检查。
- 仓库卫生检查。
- 部署准备检查。

## UI 同伴注意

UI 同伴主要改：

```text
miniprogram/pages/**/*.wxml
miniprogram/pages/**/*.wxss
miniprogram/app.wxss
docs/ui-design-system.md
```

先不要改：

```text
miniprogram/pages/**/*.js
miniprogram/utils/
scripts/
db/
package.json
```

改完必须跑：

```bash
npm run check
```

如果开 PR，按 `.github/pull_request_template.md` 勾选检查项。

## 下一步建议

短期：

- UI 同伴按 `docs/ui-merge-checklist.md` 做视觉统一。
- UI 同伴按 `docs/ui-design-system.md` 控制颜色、间距、按钮、状态和空态。
- 你按 `docs/miniprogram-self-test.md` 在微信开发者工具逐页点通。
- 合并 UI 分支前跑 `npm run check`。

中期：

- 注册小程序后替换正式 AppID。
- 配置 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET`。
- 将登录从模拟模式切到真实 `wx.login`。

上线前：

- 购买服务器和 HTTPS 域名。
- 配置微信 request 合法域名。
- 配置微信支付商户号、证书、API v3 key、支付通知验签和退款通知验签。
- 补齐 `docs/legal/` 中的正式主体、客服电话、生效日期和隐私字段。
