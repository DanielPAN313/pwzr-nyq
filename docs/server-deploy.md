# 服务端部署与域名配置

这份文档用于后续真正上线微信小程序时准备服务器、域名、HTTPS 和微信合法请求域名。当前未注册小程序阶段，仍然可以继续用 `localhost:4174` 开发。

## 什么时候需要买服务器和域名

本地开发阶段：

- 不需要域名
- 不需要服务器
- 可以用 `touristappid`
- 可以用 `http://localhost:4174`
- 微信开发者工具里保持 `urlCheck: false`

准备真机体验版、提交审核、线上发布时：

- 需要一台后端服务器
- 需要一个已备案或可用于微信小程序的 HTTPS 域名
- 需要把该域名配置到微信公众平台的“服务器域名”
- 小程序请求地址必须改成 HTTPS

## 服务器推荐最小配置

开发和路演阶段：

```text
2 核 CPU
2GB 内存
40GB SSD
Ubuntu 22.04 或 24.04
```

生产阶段如果有真实用户，再按访问量升级。

## 域名建议

示例：

```text
api.your-domain.com
```

微信小程序要求请求域名必须是 HTTPS，并且要在微信公众平台配置：

```text
开发管理 -> 开发设置 -> 服务器域名 -> request 合法域名
```

填写：

```text
https://api.your-domain.com
```

不要填写 IP、localhost 或普通 HTTP 地址。

## Docker Compose 部署

服务器安装 Docker 和 Docker Compose 后，进入项目目录：

```bash
cd pwzr-nyq
cp .env.server.example .env.server
```

编辑 `.env.server`：

```text
PORT=4174
MYSQL_DATABASE=nyq
MYSQL_USER=nyq
MYSQL_PASSWORD=replace_with_a_strong_app_password
MYSQL_ROOT_PASSWORD=replace_with_a_strong_root_password
MYSQL_PUBLIC_PORT=3306
```

真实服务器必须使用强密码，不要提交或分享 `.env.server`。

启动：

```bash
docker compose --env-file .env.server up -d --build
```

查看日志：

```bash
docker compose --env-file .env.server logs -f
```

停止：

```bash
docker compose --env-file .env.server down
```

不要删除 `mysql_data` volume，除非确认要清空数据库。

## HTTPS 反向代理

Docker 服务默认监听：

```text
http://SERVER_IP:4174
```

微信小程序不能直接使用这个地址。需要用 Nginx、Caddy、宝塔面板或云厂商网关把 HTTPS 域名反代到本地端口。

反代目标：

```text
127.0.0.1:4174
```

线上访问结果应是：

```text
https://api.your-domain.com/api/sports-app/bootstrap
```

能返回 JSON 后，再去改小程序 API 地址。

## 小程序 API 地址切换

本地开发默认在：

```text
miniprogram/utils/config.js
```

当前默认值：

```js
apiBaseUrl: "http://localhost:4174"
```

上线前改成：

```js
apiBaseUrl: "https://api.your-domain.com"
```

也可以在 `miniprogram/app.js` 的 `globalData` 中覆盖：

```js
globalData: {
  config: {
    ...DEFAULT_CONFIG,
    env: "production",
    apiBaseUrl: "https://api.your-domain.com",
    useMockAuth: false
  }
}
```

注意：改成线上域名后，本地同伴可能无法直接连本地服务。开发分支默认仍建议保留 `localhost`，上线前再单独切生产配置。

## 上线前必须补齐

当前项目已经有开发版模拟登录和模拟支付。真正上线前还需要：

- 微信登录：`wx.login` 换取 openid/session
- 用户身份：后端绑定 openid，不再只靠开发版模拟用户
- 微信支付：统一下单、支付回调、退款回调
- 场馆端权限：场馆管理员只能看自己场馆订单
- 生产数据库：禁止使用弱密码
- HTTPS：证书自动续期
- 合规材料：隐私政策、用户协议、支付说明、场馆合作说明

## 验证清单

上线前至少检查：

```bash
npm ci
npm run check
```

服务器检查：

```bash
curl https://api.your-domain.com/api/sports-app/bootstrap
```

微信开发者工具检查：

```text
详情 -> 本地设置
```

开发阶段可勾选“不校验合法域名”；体验版、审核和正式版必须使用微信公众平台配置过的 HTTPS 合法域名。

## 常见问题

### 没注册小程序能不能继续开发？

可以。继续使用 `touristappid`、微信开发者工具和本地 `localhost:4174`。

### 现在要不要马上买服务器？

如果只是开发和 UI 协作，暂时不用。等要真机体验版、给外部用户测试或提交审核时再买。

### 为什么本地能请求，真机不行？

真机和正式小程序不能请求 `localhost`。必须换成 HTTPS 域名，并在微信公众平台配置合法请求域名。

