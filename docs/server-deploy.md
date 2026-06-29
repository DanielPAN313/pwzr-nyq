# 服务端部署

这个项目可以用 Docker Compose 部署本地接口和 MySQL。当前部署只服务于「宁约球」小程序联调，不包含 Android、APK 或 Capacitor 流程。

Compose 会启动两个服务：

- `web`：Node.js 本地接口服务
- `mysql`：MySQL 8 数据库

数据库数据保存在 Docker volume `mysql_data`，容器重启不会丢失。

## 1. 准备服务器

先安装 Docker 和 Docker Compose，然后进入项目目录：

```bash
cd pwzr-nyq
```

## 2. 创建环境变量

```bash
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

真实服务器必须使用强密码。不要提交或分享 `.env.server`。

## 3. 启动服务

```bash
docker compose --env-file .env.server up -d --build
```

启动后接口默认地址：

```text
http://SERVER_IP:4174/
```

上线给小程序使用时必须配置 HTTPS 域名，并在微信公众平台加入合法请求域名。

## 4. 查看数据库

```bash
docker compose --env-file .env.server exec mysql mysql -unyq -p nyq
```

示例查询：

```sql
SHOW TABLES;
SELECT id, username, status FROM user LIMIT 10;
```

## 5. 备份数据库

```bash
docker compose --env-file .env.server exec mysql mysqldump -unyq -p nyq > backup-nyq.sql
```

备份文件可能包含用户数据，不能公开提交。

## 6. 导入本地数据

本地导出：

```bash
mysqldump -uroot -p nyq > local-nyq.sql
```

复制到服务器项目目录后导入：

```bash
docker compose --env-file .env.server exec -T mysql mysql -unyq -p nyq < local-nyq.sql
```

## 7. 常用命令

停止：

```bash
docker compose --env-file .env.server down
```

重启：

```bash
docker compose --env-file .env.server restart
```

查看日志：

```bash
docker compose --env-file .env.server logs -f
```

不要删除 `mysql_data` volume，除非你确认要清空所有数据库数据。
