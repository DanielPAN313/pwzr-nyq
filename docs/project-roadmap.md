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
- `pages/games/games`
- `pages/messages/messages`
- `pages/me/me`
- `pages/orders/orders`

## 已保留能力

- 启动页：UI 分支动效，开发阶段自动进入首页，跳过强制登录。
- 注册/登录：保留同伴 UI，接入账号接口并写入 session。
- 首页：UI 分支主视觉，好友邀请/正在招人卡片接真实球局数据。
- 订场：真实场馆列表，一键尝试预订最近可用时段并生成订单。
- 球局：真实球局列表，支持报名。
- 消息：真实通知列表，支持标记已读。
- 我的：个人概览和订单入口。
- 订单：订单列表、金额、状态、核销码展示。
- H5 预览：保留小程序桥接检查。

## 已移除的旧闭环

这些旧页面不在当前 UI-first 小程序里：

- 场馆详情页
- 球局详情页
- 发起球局页
- 场馆管理页
- 信用分页
- 我的球局页
- 合规说明页

## 下一步建议

1. 先让 UI 同伴确认这 9 页视觉和自定义 tabBar 是否就是最终方向。
2. 再决定哪些旧闭环要重新加回这套 UI：详情页、支付、取消退款、场馆端、核销。
3. 如果要上线体验版，仍需要正式 AppID、HTTPS 域名、服务器和微信合法域名配置。

## 常用命令

```bash
npm run check
npm run dev
```
