# 宁约球小程序当前路线图

更新时间：2026-07-06

## 当前方向

项目当前按微信小程序推进，主工程是 `miniprogram/`。

本轮根据最新要求切换为 UI-first：

- 以 `origin/ui-polish` 最新界面为主。
- 可以删除旧功能页和旧闭环。
- 如果 UI 页面里已有按钮或入口，需要补成可点击、可请求或至少有明确提示。

## 当前页面

当前注册页面：

- `pages/splash/splash`
- `pages/register/register`
- `pages/login/login`
- `pages/home/home`
- `pages/venues/venues`
- `pages/venue-detail/venue-detail`
- `pages/games/games`
- `pages/create-game/create-game`
- `pages/game-detail/game-detail`
- `pages/messages/messages`
- `pages/me/me`
- `pages/orders/orders`
- `pages/venue-admin/venue-admin`
- `pages/credit/credit`
- `pages/my-games/my-games`
- `pages/legal/legal`

## 已保留能力

- 启动页：UI 分支动效，开发阶段自动进入首页，跳过强制登录。
- 注册/登录：保留同伴 UI，接入账号接口并写入 session。
- 首页：UI 分支主视觉，好友邀请/正在招人卡片接真实球局数据，首屏提供订场、找球局、查订单、消息快捷入口。
- 订场：真实场馆列表，一键尝试预订最近可用时段并生成订单。
- 场馆详情：查看开放时段、地址导航/复制地址，并按日期和时段订场。
- 订场/球局：保留新版 UI 搜索入口，可按名称、区域、运动类型、场地或状态筛选。
- 球局：真实球局列表，支持报名。
- 发起球局：选择场馆、运动、时间、人数和费用并发布。
- 球局详情：查看报名进度、球友状态，并支持赛后互评。
- 消息：真实通知列表，支持标记已读。
- 我的：个人概览、订单、我的球局、信用分、场馆端和规则入口。
- 订单：订单列表、金额、状态、核销码展示，支持支付预留、取消、到场核销和复制核销码。
- 场馆端：支持入驻申请、资料维护、扫码/输入核销码和订单核销。
- 信用分：展示信用分、信用事件和相关入口。
- 我的球局：展示报名、待处理和历史球局，可进入详情或发起球局。
- H5 预览：保留小程序桥接检查。

## 已恢复的旧闭环

旧闭环已按当前 UI-first 方向恢复入口和页面注册：场馆详情、球局详情、发起球局、场馆端、信用分、我的球局、合规说明。

## 下一步建议

1. 先让 UI 同伴确认这 16 页视觉和自定义 tabBar 是否就是最终方向。
2. 继续真机自测详情页、发起球局、场馆端核销、互评这些恢复页的窄屏表现。
3. 如果要上线体验版，仍需要正式 AppID、HTTPS 域名、服务器和微信合法域名配置。

## 常用命令

```bash
npm run check
npm run dev
```
