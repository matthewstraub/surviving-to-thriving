# Deploying "Surviving to Thriving" on Render

This guide walks you through deploying the Surviving to Thriving classroom check-in app to **Render** (free tier) with a **TiDB Cloud Starter** MySQL database (also free). By the end, you will have a publicly accessible URL that your students can reach from any device — no Manus account required.

---

## Overview

The app has three components that need to work together in production:

| Component | Technology | Hosting |
|-----------|-----------|---------|
| Frontend (React SPA) | Vite + React 19 + Tailwind 4 | Render (bundled with server) |
| Backend API + WebSocket | Express 4 + tRPC + Socket.io | Render Web Service (free tier) |
| Database | MySQL-compatible (Drizzle ORM) | TiDB Cloud Starter (free tier) |

The free tiers of both services are sufficient for a classroom tool. Render's free web service has a **cold start** delay (the server spins down after ~15 minutes of inactivity and takes ~30 seconds to restart on the next request), but once active it runs smoothly. TiDB Cloud Starter provides **25 GiB of storage** and **250 million Request Units per month** at no cost.

---

## Step 1: Set Up the Database on TiDB Cloud

Since Render does not offer a managed MySQL database, you will use TiDB Cloud Starter, which is MySQL-compatible and has a generous free tier.

### 1.1 Create a TiDB Cloud Account

1. Go to [tidbcloud.com](https://tidbcloud.com/free-trial/) and sign up (you can use Google or GitHub SSO).
2. After signing in, you will land on the TiDB Cloud dashboard.

### 1.2 Create a Free Cluster

1. Click **Create Cluster** (or it may auto-create a "Cluster0" for you).
2. Select **Starter** (the free tier).
3. Choose a region close to your Render deployment region (e.g., **US East** if you plan to deploy on Render's Oregon region, or **US West**).
4. Click **Create** — the cluster will be ready in about 30 seconds.

### 1.3 Get Your Connection String

1. On your cluster overview page, click **Connect**.
2. Select **General** connection method.
3. Under "Connect With", choose **MySQL-compatible / General**.
4. You will see a connection string like:

   ```
   mysql://username:password@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/test?ssl={"rejectUnauthorized":true}
   ```

5. **Important:** Change `test` in the URL to a database name of your choice, such as `surviving_to_thriving`:

   ```
   mysql://username:password@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/surviving_to_thriving?ssl={"rejectUnauthorized":true}
   ```

6. Copy this full connection string — you will need it in Step 3.

### 1.4 Create the Database

TiDB Cloud may not automatically create the database name you specified. Use the **SQL Editor** in the TiDB Cloud console (or any MySQL client) to run:

```sql
CREATE DATABASE IF NOT EXISTS surviving_to_thriving;
```

---

## Step 2: Push Your Code to GitHub

Render deploys from a Git repository. If you have not already, push the project to GitHub:

1. Create a new repository on [github.com](https://github.com/new) (can be private).
2. From your local project directory, run:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/surviving-to-thriving.git
   git push -u origin main
   ```

> **Tip:** You can also use the **GitHub export** feature in the Manus Management UI (Settings > GitHub) to export the code directly to a new repository.

---

## Step 3: Deploy on Render

### 3.1 Create a Render Account

1. Go to [render.com](https://render.com) and sign up (GitHub SSO recommended for easy repo access).

### 3.2 Create a New Web Service

1. From the Render Dashboard, click **New > Web Service**.
2. Connect your GitHub account if prompted, then select the `surviving-to-thriving` repository.
3. Configure the service with these settings:

| Setting | Value |
|---------|-------|
| **Name** | `surviving-to-thriving` (or any name you prefer) |
| **Region** | Choose one close to your TiDB cluster |
| **Runtime** | `Node` |
| **Build Command** | `npm install -g pnpm && pnpm install && pnpm build` |
| **Start Command** | `pnpm start` |
| **Instance Type** | **Free** |

### 3.3 Set Environment Variables

Before clicking "Create Web Service", scroll down to the **Environment Variables** section and add the following:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Your TiDB connection string from Step 1.3 | Must include `?ssl=...` |
| `TEACHER_PASSWORD` | A password of your choice | Used to log into the teacher dashboard |
| `JWT_SECRET` | Any random string (e.g., `my-super-secret-key-2024`) | Used for session cookie signing |
| `NODE_ENV` | `production` | Tells the app to serve built static files |
| `PORT` | `10000` | Render's default port for web services |

The following Manus-specific variables are **not required** for the core functionality and can be left unset. The app will still work without them — you just will not get the Manus OAuth login or push notifications:

| Variable | Can Skip? | Effect if Missing |
|----------|-----------|-------------------|
| `VITE_APP_ID` | Yes | Manus OAuth login button won't work (not needed — teacher uses password auth) |
| `OAUTH_SERVER_URL` | Yes | Same as above |
| `VITE_OAUTH_PORTAL_URL` | Yes | Same as above |
| `BUILT_IN_FORGE_API_URL` | Yes | Outlier push notifications to Manus won't send (app still works) |
| `BUILT_IN_FORGE_API_KEY` | Yes | Same as above |
| `OWNER_OPEN_ID` | Yes | Admin role auto-assignment won't work (not needed) |

### 3.4 Create the Service

Click **Create Web Service**. Render will:

1. Clone your repository
2. Run the build command (`pnpm install && pnpm build`)
3. Start the server (`pnpm start`)

The first deploy takes 3–5 minutes. You can watch the build logs in real time.

### 3.5 Your Public URL

Once deployed, your app will be live at:

```
https://surviving-to-thriving.onrender.com
```

(The exact subdomain depends on the name you chose in Step 3.2.)

---

## Step 4: Run Database Migrations

After the first deploy, you need to create the database tables. You have two options:

### Option A: Run Migrations via Render Shell

1. In the Render Dashboard, go to your web service.
2. Click the **Shell** tab (available on paid plans) or use a **One-Off Job**.
3. Run: `pnpm db:push`

### Option B: Run the SQL Manually

If you cannot access the Render shell on the free tier, run the following SQL statements directly in the **TiDB Cloud SQL Editor** (or any MySQL client connected to your database):

```sql
CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT NOT NULL,
  `openId` varchar(64) NOT NULL,
  `name` text,
  `email` varchar(320),
  `loginMethod` varchar(64),
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `users_id` PRIMARY KEY(`id`),
  CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);

CREATE TABLE IF NOT EXISTS `survey_sessions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `code` varchar(32) NOT NULL,
  `label` varchar(255),
  `isActive` int NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `survey_sessions_id` PRIMARY KEY(`id`),
  CONSTRAINT `survey_sessions_code_unique` UNIQUE(`code`)
);

CREATE TABLE IF NOT EXISTS `submissions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `sessionId` int NOT NULL,
  `studentName` varchar(255) NOT NULL,
  `emoji` varchar(32) NOT NULL,
  `rating` int NOT NULL,
  `ipAddress` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `submissions_id` PRIMARY KEY(`id`)
);
```

Also create the Drizzle migrations tracking table so future migrations work:

```sql
CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (
  `id` bigint AUTO_INCREMENT PRIMARY KEY,
  `hash` text NOT NULL,
  `created_at` bigint
);
```

---

## Step 5: Verify Everything Works

1. Visit your Render URL (e.g., `https://surviving-to-thriving.onrender.com`).
2. You should see the "Surviving to Thriving" landing page.
3. Click **Teacher Dashboard** and log in with your `TEACHER_PASSWORD`.
4. Create a new session — you will get a QR code and shareable link.
5. Open the student link on your phone and submit a test response.
6. Confirm the response appears in real time on the teacher dashboard.

---

## Important Notes

### Cold Starts on Render Free Tier

Render's free web services spin down after approximately 15 minutes of inactivity. The next request will take **30–60 seconds** to respond while the server restarts. For classroom use, you can work around this by visiting the teacher dashboard a minute or two before class starts to "wake up" the server.

### WebSocket Connections

Render supports WebSocket connections on all plans, including free. The real-time submission updates via Socket.io will work as expected.

### TiDB Cloud SSL

TiDB Cloud requires SSL connections. The connection string from Step 1.3 already includes the SSL parameter. If you encounter connection errors, make sure the `?ssl={"rejectUnauthorized":true}` part is included in your `DATABASE_URL`.

### Custom Domain (Optional)

If you want a cleaner URL (e.g., `checkin.yourdomain.com`), you can add a custom domain in Render's service settings under **Settings > Custom Domains**. Render provides free TLS certificates automatically.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails with "pnpm not found" | Make sure the build command starts with `npm install -g pnpm &&` |
| Database connection error | Verify `DATABASE_URL` is correct and includes the SSL parameter |
| App loads but shows blank page | Check that `NODE_ENV=production` is set in environment variables |
| WebSocket not connecting | Ensure your Render service URL uses `https://` (Render provides this by default) |
| Cold start too slow | Consider upgrading to Render's paid tier ($7/month) to keep the service always on |
| "Table doesn't exist" errors | Run the SQL from Step 4 Option B in TiDB Cloud's SQL Editor |
