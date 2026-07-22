# 宁约球小程序路线图

更新时间：2026-07-23

## 当前方向

只推进微信小程序，主工程为 `miniprogram/`。Android、APK、Capacitor 和旧 H5 仅作为历史参考。

阶段顺序固定为：

```text
P0 → P1 → P2.5 → P2 → P3 → P4 → P5 → P6
```

每个阶段完成后必须运行 `npm run check`，检查通过后再提交并推送到 `feature-miniprogram-flow`。

## 阶段状态

| 阶段 | 状态 | 主要范围 |
|---|---|---|
| P0 | 已完成 | 身份选择、权限守卫、静默 fallback、错误清理 |
| P1 | 已完成 | 首页、出勤榜、订场、球局、订单取消、消息 |
| P2.5 | 已完成 | 球队列表、详情、创建、队内比赛、球队数据 |
| P2 | 已完成 | 球员六维档案、雷达图、位置、他评、信用分 |
| P3 | 已完成 | 场馆看板、发球局、分队结果、核销、设置 |
| P4 | 已完成 | 智能分队算法和 `< 15%` 分差目标 |
| P5 | 已完成 | 统一支付预留、模拟支付与退款超时处理 |
| P6 | 下一阶段 | 分享邀请、三套文案和统一分享入口 |

## 当前页面

小程序现注册 29 个页面。P3/P5 新增：

- `pages/venue/create-game/index`
- `pages/venue/team-balance/index`
- `pages/venue/settings/index`
- `pages/payment/callback`

场馆主入口继续使用 `pages/venue/home/index`，扫码和补核销继续使用 `pages/venue/scan/index`，旧 `pages/venue-admin/venue-admin` 仅保留兼容入口。

## 质量门槛

- 所有网络请求失败时静默使用本地或 mock 数据。
- 普通用户不可见、不可进入场馆端。
- 所有新增页面注册到 `app.json` 并进入运行时检查。
- 不向用户展示域名、请求栈或其他技术错误。
- 不提交私有配置、环境变量、构建产物、截图或日志。

## 常用命令

```bash
npm run check
npm run dev
```
