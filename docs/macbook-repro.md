# MacBook 复现与修改指南

这份文档给同伴使用。当前项目主线是微信小程序开发；历史 Android、APK、Capacitor 目录只做参考，不作为当前开发方向。

## 1. 安装工具

MacBook 上先安装：

- Git
- Node.js 20 或更高版本
- 微信开发者工具
- VS Code
- MySQL 8，可选；只改 UI 或看页面时可以先不装

微信开发者工具用她自己的微信扫码登录即可，不需要用你的微信。

## 2. 拉取代码

```bash
git clone https://github.com/DanielPAN313/pwzr-nyq.git
cd pwzr-nyq
```

如果她要基于当前最新小程序功能改 UI，建议从功能分支开始：

```bash
git fetch origin
git checkout feature-miniprogram-flow
git pull origin feature-miniprogram-flow
git checkout -b ui-polish
```

如果只想看稳定基线，也可以留在 `main`。但当前最新的场馆管理、订单定位、核销码核销、赛后互评都在 `feature-miniprogram-flow`。

## 3. 安装依赖并检查

```bash
npm ci
npm run check
```

当前通过时应看到这些关键信息：

```text
Mini Program check passed.
Mini Program flow contract check passed.
Mini Program runtime check passed: loaded app.js, 12 pages, and home.switchTab.
H5 Mini Program preview check passed.
H5 HTTP preview check passed.
H5 Mini Program bridge runtime check passed.
H5 Mini Program bridge coverage check passed.
```

`npm run check` 现在不只检查页面能不能打开，还会检查关键业务链路有没有被改断：

- 消息跳订单并带 `orderId`
- 订单页高亮定位
- 订单页跳赛后评价
- 场馆管理页核销码核销
- 后端场馆核销接口：仅允许场馆所属账号核销自己的订单
- 球局详情页赛后互评

## 4. 用微信开发者工具打开

打开微信开发者工具，选择：

```text
小程序 -> 导入项目
```

项目目录必须选择：

```text
pwzr-nyq/miniprogram
```

不要选择 `pwzr-nyq` 根目录，也不要选择 `site/` 或 `android/`。

导入配置：

```text
AppID: touristappid
后端服务: 不使用云服务
开发模式: 小程序
```

没有正式 AppID 不影响本地开发基础功能。真实登录、微信支付、线上合法域名这些等注册后再接。

## 5. 启动本地服务

在项目根目录运行：

```bash
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

Windows PowerShell 是：

```powershell
$env:PORT="4190"; npm run dev
```

小程序默认接口地址在 `miniprogram/app.js` 中，目前是：

```js
apiBaseUrl: "http://localhost:4174"
```

本地开发默认使用模拟登录，不需要注册小程序也能继续开发和改 UI。

后续注册小程序并准备接真实微信登录时，再在启动后端前配置：

```bash
export WECHAT_APP_ID="你的小程序 AppID"
export WECHAT_APP_SECRET="你的小程序 AppSecret"
npm run dev
```

Windows PowerShell 对应写法是：

```powershell
$env:WECHAT_APP_ID="你的小程序 AppID"
$env:WECHAT_APP_SECRET="你的小程序 AppSecret"
npm run dev
```

然后把 `miniprogram/utils/config.js` 里的 `useMockAuth` 改成 `false`，小程序会通过 `wx.login` 请求 `/api/sports-app/auth/wechat-login`。

## 6. 浏览器预览

未注册小程序时，也可以先用浏览器看 H5 小程序预览：

```text
http://localhost:4174/
http://localhost:4174/?page=home
http://localhost:4174/?page=venues
http://localhost:4174/?page=games
http://localhost:4174/?page=messages
http://localhost:4174/?page=me
```

浏览器预览在 `site/`，它模拟了常用 `wx` API、底部 tab、页面跳转、启动参数和本地请求任务。最终小程序代码仍以 `miniprogram/` 为准。

## 7. UI 同伴主要改哪些文件

优先改：

```text
miniprogram/pages/home/*.wxml
miniprogram/pages/home/*.wxss
miniprogram/pages/venues/*.wxml
miniprogram/pages/venues/*.wxss
miniprogram/pages/games/*.wxml
miniprogram/pages/games/*.wxss
miniprogram/pages/messages/*.wxml
miniprogram/pages/messages/*.wxss
miniprogram/pages/me/*.wxml
miniprogram/pages/me/*.wxss
miniprogram/pages/orders/*.wxml
miniprogram/pages/orders/*.wxss
miniprogram/pages/venue-admin/*.wxml
miniprogram/pages/venue-admin/*.wxss
miniprogram/pages/game-detail/*.wxml
miniprogram/pages/game-detail/*.wxss
miniprogram/app.wxss
```

先不要改：

```text
miniprogram/pages/**/*.js
miniprogram/utils/
scripts/
db/
.env
project.private.config.json
```

如果确实要改 JS 或接口，先和负责功能的人确认。

## 8. 提交前必须做

```bash
npm run check
git status
```

确认只提交需要的文件，不要提交：

```text
.env
miniprogram/project.private.config.json
node_modules/
日志文件
截图
APK
```

提交和推送：

```bash
git add miniprogram
git commit -m "Polish miniprogram UI"
git push origin ui-polish
```

推送后把分支名发给团队，例如：

```text
ui-polish
```

## 9. 当前主流程自测

建议每次大改后走一遍：

1. 首页能打开。
2. 订场页能进入场馆详情并生成订单。
3. 球局页能报名或创建球局。
4. 订单页能支付、取消、查看核销码。
5. 场馆管理页能申请入驻场馆。
6. 有自己的场馆后，场馆管理页能维护每小时价格、联系方式和开放时段。
7. 用户端场馆详情页能看到场馆端维护的开放时段。
8. 场馆管理页能输入核销码完成核销，且只能核销自己管理场馆的订单。
9. 消息页能点进关联订单或球局。
10. 已核销球局订单能进入赛后互评。
