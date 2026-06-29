# 宁约球小程序 / H5 MVP

面向南京高校和园区的「足球 / 篮球约局 + 场馆预订 + 信用管理」产品原型。当前仓库只保留小程序/H5 主线代码，方便 Windows 和 macOS 都能用 Codex 复现、继续开发和测试。

## 当前主流程

- 用户端：登录、找球场、预订场地、看附近球局、发局、报名支付占位、个人订单与信用记录。
- 场馆端：新增场馆、查看订单、核销订单、今日收入统计。
- 运营后台：用户封禁/解封、场馆审核、基础数据看板。
- 数据库：用户、场馆、球局、报名、订单、信用事件都写入 MySQL。

## 给同伴的快速启动

需要先安装：

- Node.js 20 或更高版本
- MySQL 8

然后运行：

```bash
npm install
cp .env.example .env
npm run mirror
```

默认地址：

```text
http://localhost:4174/
```

如果端口被占用：

```bash
PORT=4190 npm run mirror
```

Windows PowerShell 可以这样写：

```powershell
$env:PORT="4190"; npm run mirror
```

## MySQL 初始化

```sql
CREATE DATABASE another_me CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE another_me;
SOURCE db/schema.sql;
```

复制 `.env.example` 为 `.env`，填入数据库配置：

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=another_me
PORT=4174
```

启动服务后会自动补齐业务表，并写入南京样板区的种子场馆和球局。

## 仓库边界

- 当前目标：小程序/H5 开发与上架准备。
- 不需要 Android Studio、Gradle、模拟器或 APK 构建。
- 本地如果存在 `android/` 目录，那只是历史安卓壳文件，已被 `.gitignore` 忽略，不参与协作开发。

## 试点范围

- 城市：南京
- 核心区域：南师附中江宁分校、江宁大学城、江宁开发区、百家湖
- 合作目标：周边 3-5 家室内/黄金时段优先场馆

## 上线前需要替换的生产能力

- 微信一键登录：当前为 MySQL 用户名密码演示登录，接口位置是 `/api/auth/login` 和 `/api/auth/register`。
- 微信支付：当前报名会直接生成 paid 订单和核销码，生产环境需要接微信支付回调后再写入 paid。
- 地图 SDK：当前是 H5 可演示地图面板，小程序上线应替换腾讯位置服务或高德地图组件。
- 权限系统：当前三端共用登录态演示，生产环境应区分用户、场馆管理员和运营管理员角色。
