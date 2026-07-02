# 宁约球微信小程序

这是「宁约球」微信小程序项目，面向南京高校和园区的足球、篮球约局与场馆预订场景。当前仓库的主线是微信小程序开发和上线准备，不再按 Android、APK、Capacitor 或 H5 手机壳方向推进。

## 当前结论

- 主开发入口：`miniprogram/`
- 未注册阶段预览入口：`site/` + `npm run dev`
- 本地后端与接口：`scripts/serve-local-mirror.mjs`
- 数据库结构：`db/schema.sql`
- 产品与协作文档：`docs/`
- 历史 Android 壳参考：`android/`

常用文档：

- 项目路线图与当前进度：`docs/project-roadmap.md`
- MacBook 复现与修改：`docs/macbook-repro.md`
- 团队协作计划：`docs/collaboration-plan.md`
- 微信开发者工具自测清单：`docs/miniprogram-self-test.md`
- UI 分支合并检查清单：`docs/ui-merge-checklist.md`
- 服务器与域名上线：`docs/server-deploy.md`
- UI 设计系统：`docs/ui-design-system.md`

不要把 `android/`、APK、Capacitor、安卓模拟器当成当前开发方向。当前方向是微信小程序；在小程序未注册前，用 `site/` 的 H5 小程序预览模拟微信运行环境，方便浏览器开发、同伴改 UI 和本地演示。

## MacBook 复现步骤

### 1. 安装工具

- Node.js 20 或更高版本
- 微信开发者工具
- Git
- MySQL 8，可选；只看小程序界面时可以先不装

### 2. 克隆仓库

```bash
git clone https://github.com/DanielPAN313/pwzr-nyq.git
cd pwzr-nyq
```

### 3. 安装依赖并体检

```bash
npm ci
npm run check
```

`npm run check` 会检查小程序工程是否可打开：`app.json`、页面四件套、tabBar 路由、JSON 语法、UTF-8 编码和浏览器 API 误用。

它还会执行 H5 小程序预览检查、H5 本地 HTTP 直达检查、`wx` 桥接层运行时检查，以及 `miniprogram/` 实际使用的 `wx.*` API 覆盖检查。

它也会检查小程序调用的 `/api/sports-app/*` 关键接口是否仍在本地后端中存在，避免前端页面和后端接口脱节。

它还会检查数据库契约，避免场馆、球局、订单、报名、信用分、消息和互评依赖字段被误删。

它还会检查演示数据契约，确保本地首次启动时有基础场馆、球局、开放时段和演示球队。

它也会检查协作文档、演示准备入口和关键忽略规则，避免同伴拉代码或 UI 分支合并时漏掉必要说明。

它还会检查仓库卫生，防止 `.env`、截图、APK、日志、`node_modules`、微信本机私有配置等内容被误提交。

### 4. 打开微信小程序

在微信开发者工具里选择「导入项目」：

```text
项目目录：miniprogram/
AppID：没有正式 AppID 时选择测试号 / touristappid
```

导入后应看到 5 个 tab：

- 首页
- 订场
- 球局
- 消息
- 我的

### 5. 可选：启动本地接口

如果要联调接口：

```bash
cp .env.example .env
npm run dev
```

默认地址：

```text
http://localhost:4174/
```

如果端口被占用：

```bash
PORT=4190 npm run dev
```

Windows PowerShell：

```powershell
$env:PORT="4190"; npm run dev
```

小程序默认接口地址在 `miniprogram/app.js`：

```js
apiBaseUrl: "http://localhost:4174"
```

真机或线上版本需要替换成 HTTPS 域名，并在微信公众平台配置合法请求域名。

未注册小程序时，也可以先直接用浏览器预览：

```text
http://localhost:4174/
http://localhost:4174/?page=home
http://localhost:4174/?path=pages/games/games
```

H5 预览里已经模拟了常用 `wx` API、底部 tab、页面直达、页面栈、启动参数、扫码、支付、上传下载任务和请求任务，用来让本地开发尽量接近真实微信小程序。

## 协作规则

每次提交前先跑：

```bash
npm run check
```

上线配置单独检查：

```bash
npm run check:deploy
```

小程序页面放在：

```text
miniprogram/pages/
```

新增页面时必须同时完成：

- 新建 `.js`
- 新建 `.json`
- 新建 `.wxml`
- 新建 `.wxss`
- 在 `miniprogram/app.json` 注册页面
- 如果是底部 tab 页面，也要注册到 `tabBar.list`

后端接口改动放在：

```text
scripts/serve-local-mirror.mjs
db/schema.sql
```

`site/` 现在承担未注册阶段的浏览器预览职责。业务主线和最终小程序代码仍以 `miniprogram/` 为准；如果改了 H5 预览里的交互，也要确认真实小程序目录能继续通过 `npm run check`。

GitHub Actions 已经配置在 Ubuntu 和 macOS 上执行 `npm ci` 与 `npm run check`。同伴在 MacBook 上遇到问题时，可以先对照 Actions 结果判断是本机环境问题还是仓库问题。

UI 同伴或功能同伴提交 PR 时，GitHub 会自动套用 `.github/pull_request_template.md`。按模板勾选检查项，能减少合并前遗漏页面自测或误提交本机文件。

## 上线前重点

- 微信登录：`wx.login` + 后端换取 openid/session，接口已预留
- 微信支付：预支付、确认支付、支付回调结构已预留，正式启用前补商户号、证书和验签
- HTTPS 后端：已有 Docker Compose 和 `.env.server.example`，正式上线前配置备案域名、合法请求域名、生产数据库
- 场馆端：场馆登录、时段维护、订单核销、收入统计
- 合规材料：草案放在 `docs/legal/`，包含隐私政策、用户协议、支付说明、场馆合作说明和上线合规清单

## 目录速览

```text
miniprogram/               微信小程序主工程
scripts/                   本地 Node 服务与 API
db/                        MySQL schema
docs/                      产品、协作、部署文档
site/                      未注册阶段的 H5 小程序预览
modules/                   旧模块实验，仅参考
android/                   历史安卓壳，已忽略
```
