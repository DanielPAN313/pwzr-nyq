# MacBook 复现与修改指南

这份文档给同伴用。现在还没有正式注册微信小程序，也可以先开发、预览和改代码。

## 一次性准备

安装：

- Git
- Node.js 20+
- 微信开发者工具
- MySQL 8，可选；只看页面和本地假数据时可以先不装

## 拉代码

```bash
git clone https://github.com/DanielPAN313/pwzr-nyq.git
cd pwzr-nyq
npm ci
npm run check
```

看到下面输出，说明本地工程、H5 预览桥接和小程序结构都通过：

```text
Mini Program check passed.
Mini Program runtime check passed: loaded app.js, 5 pages, and home.switchTab.
H5 Mini Program preview check passed.
H5 HTTP preview check passed.
H5 Mini Program bridge runtime check passed.
H5 Mini Program bridge coverage check passed: wx.request, wx.switchTab.
```

## 未注册小程序时怎么开发

先用浏览器打开 H5 小程序预览：

```bash
npm run dev
```

默认地址：

```text
http://localhost:4174/
```

常用直达页面：

```text
http://localhost:4174/?page=home
http://localhost:4174/?page=venues
http://localhost:4174/?page=games
http://localhost:4174/?page=messages
http://localhost:4174/?page=me
```

也可以用更接近真实微信小程序的路径：

```text
http://localhost:4174/?path=pages/home/home
http://localhost:4174/pages/games/games
```

这个预览不是普通网页外壳，里面已经模拟了常用 `wx` API、页面直达、底部 tab、页面栈、启动参数、扫码、支付、上传下载任务和本地请求任务，用来在没注册 AppID 前尽量靠近真实小程序。

## 打开微信开发者工具

微信开发者工具里选择「导入项目」：

```text
项目目录：miniprogram/
AppID：touristappid 或测试号
```

不要导入仓库根目录，也不要导入 `site/` 或 `android/`。

没有正式 AppID 不影响开发基础页面；真实登录、支付、线上合法域名这些等注册后再接。

## 修改页面

真正小程序页面路径：

```text
miniprogram/pages/home/
miniprogram/pages/venues/
miniprogram/pages/games/
miniprogram/pages/messages/
miniprogram/pages/me/
```

每个小程序页面由四个文件组成：

```text
页面名.js
页面名.json
页面名.wxml
页面名.wxss
```

新增页面后要在 `miniprogram/app.json` 的 `pages` 里注册。如果是底部 tab 页面，也要注册到 `tabBar.list`。

浏览器预览相关文件：

```text
site/miniapp-bridge.js
site/sports-app.js
site/sports-app.css
site/mobile-preview-lock.css
site/mobile-tabbar-motion.css
```

## 联调本地接口

```bash
cp .env.example .env
npm run dev
```

默认接口地址：

```text
http://localhost:4174
```

如果端口被占用：

```bash
PORT=4190 npm run dev
```

如果要使用 MySQL，先创建数据库并导入 schema：

```sql
CREATE DATABASE another_me CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE another_me;
SOURCE db/schema.sql;
```

然后把 `.env` 里的 MySQL 用户名和密码改成自己的本机配置。

## GitHub 自动检查

仓库已经配置 GitHub Actions：

```text
.github/workflows/check.yml
```

每次 push 到 `main` 或开 Pull Request 时，都会在 Ubuntu 和 macOS 上执行：

```bash
npm ci
npm run check
```

同伴如果担心 MacBook 复现问题，可以看 GitHub 仓库的 Actions 页面。也可以手动点 `Run workflow` 重新跑一次。

## 提交前

每次提交前必须跑：

```bash
npm run check
```

这个检查会提前发现大多数会导致微信开发者工具打不开、页面路由失效、WXML 点击方法缺失、H5 预览桥接缺 API、Mac/Linux 环境不一致的问题。
