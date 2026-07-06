# 当前交接快照

更新时间：2026-07-06

## 当前结论

- 当前主线仍是微信小程序，主工程是 `miniprogram/`。
- 当前功能分支是 `feature-miniprogram-flow`。
- 本轮已按最新要求改成 UI-first：以 `origin/ui-polish` 最新小程序界面为准，保留同伴新增页面和自定义 tabBar。
- 当前小程序注册 9 个页面：启动页、注册、登录、首页、订场、球局、消息、我的、订单。
- 旧的场馆详情、球局详情、发起球局、场馆端、信用分、我的球局、合规说明等页面已从小程序注册路径中移除。
- 本地后端仍默认 `http://localhost:4174`，开发阶段仍使用模拟登录。

## 当前保留功能

- 启动页：使用 UI 分支动效，自动进入注册页。
- 注册/登录：保留同伴 UI，接入 `/api/auth/register` 和 `/api/auth/login`，成功后写入小程序 session。
- 首页：展示 UI 分支首页视觉，好友邀请/正在招人卡片接入真实球局数据，失败时保留 UI 兜底示例。
- 订场：加载真实场馆列表，点击订场会尝试锁定今天最近可用时段并生成待支付订单。
- 球局：加载真实球局列表，支持报名并生成订单。
- 消息：加载通知列表，点击消息可标记已读。
- 我的：加载个人概览，已有页面可跳转；UI 版暂未开放的入口会提示。
- 订单：加载订单列表，展示金额、状态和核销码。

## 自动检查

当前 `npm run check` 使用 UI-first 简化检查集：

```bash
npm run check:miniprogram
npm run check:miniprogram-runtime
npm run check:h5-preview
npm run check:h5-http-preview
npm run check:h5-bridge
npm run check:h5-bridge-coverage
```

当前通过时应看到：

```text
Mini Program runtime check passed: loaded app.js, 9 pages, and home.switchTab.
```

## 注意

- 这版不是完整业务闭环版，而是 UI 优先版。
- 如果后续要恢复详情页、场馆端、核销、支付取消退款等旧闭环，需要在这套 UI 上重新设计入口再逐个加回。
- 不要提交 `.env`、`project.private.config.json`、截图、APK、日志或 `node_modules`。
