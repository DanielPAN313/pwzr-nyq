# MacBook 复现与修改指南

## 一次性准备

安装：

- Git
- Node.js 20+
- 微信开发者工具
- MySQL 8，可选

## 拉代码

```bash
git clone https://github.com/DanielPAN313/pwzr-nyq.git
cd pwzr-nyq
npm ci
npm run check
```

看到下面输出就说明仓库基础结构正常：

```text
Mini Program check passed.
```

## 打开小程序

打开微信开发者工具，选择「导入项目」：

```text
项目目录：miniprogram/
AppID：touristappid 或测试号
```

不要导入仓库根目录，也不要导入 `site/` 或 `android/`。

## 修改小程序页面

页面路径：

```text
miniprogram/pages/home/
miniprogram/pages/venues/
miniprogram/pages/games/
miniprogram/pages/messages/
miniprogram/pages/me/
```

每个页面由四个文件组成：

```text
page.js
page.json
page.wxml
page.wxss
```

新增页面后要在 `miniprogram/app.json` 的 `pages` 里注册。

## 联调本地接口

```bash
cp .env.example .env
npm run dev
```

默认接口地址：

```text
http://localhost:4174
```

如果要使用 MySQL，先创建数据库并导入 schema：

```sql
CREATE DATABASE another_me CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE another_me;
SOURCE db/schema.sql;
```

然后把 `.env` 里的 MySQL 用户名和密码改成自己的本机配置。

## 提交前

```bash
npm run check
```

这个检查必须通过。它能提前发现大多数会导致微信开发者工具打不开或页面路由失效的问题。
