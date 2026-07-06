# 当前交接快照

更新时间：2026-07-06

## 当前结论

- 当前主线仍是微信小程序，主工程是 `miniprogram/`。
- 当前功能分支是 `feature-miniprogram-flow`。
- 本轮已按最新要求改成 UI-first：以 `origin/ui-polish` 最新小程序界面为准，保留同伴新增页面和自定义 tabBar。
- 当前小程序注册 16 个页面：启动页、注册、登录、首页、订场、场馆详情、球局、发起球局、球局详情、消息、我的、订单、场馆端、信用分、我的球局、合规说明。
- 旧的场馆详情、球局详情、发起球局、场馆端、信用分、我的球局、合规说明已恢复到当前 UI-first 小程序入口中。
- 本地后端仍默认 `http://localhost:4174`，开发阶段仍使用模拟登录。

## 当前保留功能

- 启动页：使用 UI 分支动效，开发阶段自动进入首页，跳过强制登录。
- 注册/登录：保留同伴 UI，接入 `/api/auth/register` 和 `/api/auth/login`，成功后写入小程序 session。
- 首页：展示 UI 分支首页视觉，好友邀请/正在招人卡片接入真实球局数据，失败时保留 UI 兜底示例。
- 首页：首屏增加订场、找球局、查订单、消息快捷入口，订单入口使用普通页面跳转。
- 订场：加载真实场馆列表，支持搜索、进入场馆详情，点击订场会尝试锁定今天最近可用时段并生成待支付订单。
- 场馆详情：支持日期/时段选择、地址导航、复制地址和按时段订场。
- 球局：加载真实球局列表，支持搜索、进入球局详情、发起球局、报名并生成订单。
- 球局详情：展示报名进度、球友状态和赛后互评入口。
- 消息：加载通知列表，点击消息可标记已读。
- 我的：加载个人概览，可进入订单、我的球局、信用分、场馆端和规则说明。
- 订单：加载订单列表，展示金额、状态和核销码，支持支付预留、取消订单、到场核销、复制核销码和赛后互评跳转。
- 场馆端：支持入驻申请、资料维护、扫码/输入核销码和订单核销。

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
Mini Program runtime check passed: loaded app.js, 16 pages, restored product pages, search flows, and order actions.
```

## 注意

- 这版已恢复主要旧业务闭环，但详情页、场馆端、信用分、我的球局等恢复页仍建议继续做真机窄屏 UI 细修。
- 不要提交 `.env`、`project.private.config.json`、截图、APK、日志或 `node_modules`。
