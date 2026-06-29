# 小程序协作计划

## 目标

三个人围绕同一个微信小程序工程协作，默认只改 `miniprogram/`、`scripts/`、`db/` 和 `docs/`。历史 Android、APK、Capacitor、旧 H5 手机壳都不作为当前任务继续推进。

## 推荐分工

### 同伴 A：用户端与首页

主要文件：

- `miniprogram/pages/home/`
- `miniprogram/pages/me/`
- `miniprogram/utils/api.js`

当前目标：

- 完善首页入口、推荐球局、推荐场馆
- 做微信登录入口和用户资料展示
- 展示订单、信用分、报名记录入口

### 同伴 B：场馆与订单

主要文件：

- `miniprogram/pages/venues/`
- `scripts/serve-local-mirror.mjs`
- `db/schema.sql`

当前目标：

- 完善场馆列表、筛选、时段库存
- 跑通场地预订、订单生成、核销码展示
- 保持接口字段和数据库字段一致

### 同伴 C：球局与消息

主要文件：

- `miniprogram/pages/games/`
- `miniprogram/pages/messages/`
- `scripts/serve-local-mirror.mjs`

当前目标：

- 完善附近球局、发起球局、报名占位
- 展示报名提醒、订单提醒、场馆通知
- 预留支付成功、成局、满员锁局等状态

## 本地开发流程

```bash
npm ci
npm run check
npm run dev
```

微信开发者工具导入：

```text
miniprogram/
```

没有正式 AppID 时使用测试号即可。

## 提交前检查

```bash
npm run check
```

检查通过后再提交。这个命令会验证：

- `miniprogram/app.json` 可解析
- 每个注册页面都有 `.js/.json/.wxml/.wxss`
- tabBar 页面已注册
- 页面 JSON 可解析
- 小程序 JS 没有误用 `window/document/localStorage/fetch` 等浏览器 API
- 文件没有 UTF-8 替换字符

## 不要踩的坑

- 不要把新页面写进 `site/`
- 不要恢复 Android/APK/Capacitor 作为主线
- 不要提交 `.env`、日志、截图、APK、`node_modules`
- 不要在小程序页面里使用浏览器 DOM API
- 不要直接改线上支付、订单、信用分状态语义，除非团队已经确认

## 合并建议

1. 先拉最新代码。
2. 跑 `npm ci` 和 `npm run check`。
3. 在微信开发者工具里打开 `miniprogram/`。
4. 自测自己负责的 tab。
5. 如果改了接口，同时说明新增或变更的 API 路径和字段。
