# Deploying PG Manager

The app ships as one Node service: the Express API also serves the built React
site, so a host needs a single web service plus a PostgreSQL database.

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
