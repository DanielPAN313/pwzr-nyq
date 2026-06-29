# Server deployment with MySQL

This project can run on a server with Docker Compose. The Compose setup starts two services:

- `web`: the Node.js mirror site
- `mysql`: a MySQL 8 database with persistent data

The database data is stored in the Docker volume `mysql_data`, so it is not lost when the containers restart.

## 1. Prepare the server

Install Docker and Docker Compose on the server first.

Copy this project folder to the server, then enter the project directory:

```bash
cd AI_Lab_agent
```

## 2. Create the server env file

Copy the example file:

```bash
cp .env.server.example .env.server
```

Edit `.env.server` and replace the passwords:

```text
PORT=4174

MYSQL_DATABASE=another_me
MYSQL_USER=anotherme
MYSQL_PASSWORD=replace_with_a_strong_app_password
MYSQL_ROOT_PASSWORD=replace_with_a_strong_root_password
MYSQL_PUBLIC_PORT=3306
```

Use strong passwords on the real server. Do not commit or share `.env.server`.

## 3. Start the website and database

```bash
docker compose --env-file .env.server up -d --build
```

After it starts, open:

```text
http://SERVER_IP:4174/dashboard
```

Replace `SERVER_IP` with the real public IP or domain name of the server.

## 4. View the database

Enter the MySQL container:

```bash
docker compose --env-file .env.server exec mysql mysql -uanotherme -p another_me
```

Then run:

```sql
SELECT id, username, create_time, status FROM user;
```

Passwords are stored as bcrypt hashes in `password_hash`, not plaintext.

## 5. Backup the database

Create a SQL backup:

```bash
docker compose --env-file .env.server exec mysql mysqldump -uanotherme -p another_me > backup-another-me.sql
```

Keep this backup file private because it contains user data and password hashes.

## 6. Import local users into the server

On the local computer, export the local database:

```bash
mysqldump -uroot -p another_me > local-another-me.sql
```

Copy `local-another-me.sql` to the server project folder, then import it:

```bash
docker compose --env-file .env.server exec -T mysql mysql -uanotherme -p another_me < local-another-me.sql
```

## 7. Common commands

Stop the services:

```bash
docker compose --env-file .env.server down
```

Restart the services:

```bash
docker compose --env-file .env.server restart
```

View logs:

```bash
docker compose --env-file .env.server logs -f
```

Do not delete the `mysql_data` Docker volume unless you intentionally want to remove all database data.
