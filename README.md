# 宁约球微信小程序

这是「宁约球」微信小程序项目，面向南京高校和园区的足球、篮球约局与场馆预订场景。当前仓库的主线是微信小程序开发和上线准备，不再按 Android、APK、Capacitor 或 H5 手机壳方向推进。

## 当前结论

- 主开发入口：`miniprogram/`
- 本地后端与接口：`scripts/serve-local-mirror.mjs`
- 数据库结构：`db/schema.sql`
- 产品与协作文档：`docs/`
- 旧 H5 原型参考：`site/`

不要把 `android/`、APK、Capacitor、安卓模拟器、旧 H5 手机壳当成当前开发方向。它们只是历史产物或参考材料。

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

## 协作规则

每次提交前先跑：

```bash
npm run check
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

旧 H5 只能作为业务流程和文案参考，不要把新功能继续做在 `site/`。

## 上线前重点

- 微信登录：`wx.login` + 后端换取 openid/session
- 微信支付：统一下单、支付回调、订单状态流转
- HTTPS 后端：备案域名、合法请求域名、生产数据库
- 场馆端：场馆登录、时段维护、订单核销、收入统计
- 合规材料：隐私政策、用户协议、支付说明、场馆合作说明

## 目录速览

```text
miniprogram/               微信小程序主工程
scripts/                   本地 Node 服务与 API
db/                        MySQL schema
docs/                      产品、协作、部署文档
site/                      旧 H5 原型，仅参考
modules/                   旧模块实验，仅参考
android/                   历史安卓壳，已忽略
```
