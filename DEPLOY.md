# Deploying PG Manager

The app ships as one Node service: the Express API also serves the built React
site, so a host needs a single web service plus a PostgreSQL database.

## Fastest route: Render blueprint

The repo contains `render.yaml`. On [render.com](https://render.com):

1. Sign in with GitHub (free).
2. **New → Blueprint**, pick the `liveforlife` repository, click **Apply**.
3. Fill the four values Render asks for: `PUBLIC_URL` and `CLIENT_ORIGIN` (the
   address Render gives the service, e.g. `https://pg-manager.onrender.com`),
   plus `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` for your first login.
4. Wait for the first build. Open the service URL and sign in with that admin.

Render creates the PostgreSQL database and connects `DATABASE_URL` for you. The
first boot creates the super admin because the database is empty.

Free-tier caveats: the web service sleeps after inactivity (first load takes
~30s) and Render's free PostgreSQL instance is time-limited, so move to a small
paid database or another provider before real use. Files in `UPLOADS_DIR` are
lost when the service redeploys; use an object store for production uploads.

## Host settings

| Setting | Value |
| --- | --- |
| Install command | `npm install --prefix server --include=dev && npm install --prefix client --include=dev` |
| Build command | `npm run build` |
| Start command | `npm start` |
| Node version | 20 or newer |

`npm run build` compiles the API (`server/dist`) and the site (`client/dist`).
`npm start` syncs the database schema, then serves the API and the site from one
port.

## Environment variables

Copy `server/.env.example` and fill it in on the host:

- `DATABASE_URL` — PostgreSQL connection string (add `?sslmode=require` for hosted databases)
- `JWT_SECRET` — long random string, e.g. `openssl rand -hex 32`
- `PORT` — usually provided by the host
- `NODE_ENV=production`
- `PUBLIC_URL` and `CLIENT_ORIGIN` — the public address of the deployed site
- `UPLOADS_DIR` — writable folder for documents, e.g. `uploads`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `TEAM_INBOX` — optional; without them email is recorded but not sent

## First run

The schema is applied automatically on boot. To create the demo accounts and
sample data once, run locally against the hosted database:

```bash
DATABASE_URL="postgresql://..." npm run db:seed
```

## Local production check

```bash
npm install --prefix server && npm install --prefix client
npm run build
PORT=4300 npm start
# open http://localhost:4300
```
