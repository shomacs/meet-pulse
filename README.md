# SHOMACS MeetPulse

A meeting Q&A and live-polling app. Members submit questions before/during a meeting, vote them up or down to surface the most important ones, and admins run live pulse polls to gauge the room — all in real time.

**Stack:** FastAPI · SQLite · React · Tailwind CSS · Vite

---

## Features

| Area | Details |
|---|---|
| **Auth** | Passwordless email OTP login & signup · JWT in `httponly` cookies · Admin approval flow for new users |
| **Questions** | Add questions per meeting · Upvote / downvote (non-anonymous; hover to see who voted) · Vote toggling · Can't vote on your own question |
| **Live Pulse** | Admin starts a poll per meeting (optionally tied to a question) · Custom options · Auto-refreshes every 5 s · Progress bars |
| **Admin panel** | Tabs: Users · Meetings · Questions · Pulse · Grant/revoke admin · Delete users · Show/hide meetings |
| **Security** | OTP brute-force lockout (5 attempts) · `Secure` / `SameSite` cookie flags · Security response headers · Docs disabled in production |
| **Logging** | Rotating log file (`data/app.log`) — every request + key operations with user identity |

---

## Quick start

### 1 — Python backend

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2 — Environment

```bash
cp .env.example .env
```

| Variable | Required | Notes |
|---|---|---|
| `SECRET_KEY` | ✅ | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `BREVO_API_KEY` | one of | Brevo free tier — 300 emails/day |
| `RESEND_API_KEY` | one of | Resend free tier — 100 emails/day |
| `FROM_EMAIL` | ✅ | e.g. `App Name <noreply@yourdomain.com>` |
| `AUTO_APPROVE_FIRST_USER` | optional | Set `1` to auto-approve & admin the first signup |
| `APP_ENV` | optional | Set `development` to enable `/docs` |

### 3 — React frontend

```bash
cd frontend && npm install
```

---

## Running

### Development (two terminals)

```bash
# Terminal 1 — backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend dev server  (http://localhost:3000)
cd frontend && npm run dev
```

> Vite proxies all `/api/*` requests to `localhost:8000` automatically.

### Production (single process)

```bash
cd frontend && npm run build      # outputs to frontend/dist/
cd ..
uvicorn main:app --host 0.0.0.0 --port 8000
```

Open **http://localhost:8000** — FastAPI serves the React build.

### Public access via ngrok

```bash
ngrok http 8000
```

Share the HTTPS URL. The `Secure` cookie flag activates automatically over HTTPS.

> **Note:** Free ngrok plan = ~50 req/min. Free uvicorn = handles 50+ concurrent users comfortably.

---

## Logs

```bash
tail -f data/app.log
```

All requests (method · path · user · status · duration) and key operations (login, vote, pulse start, admin actions) are logged to `data/app.log` with 5 MB rotation and 7 backups.

---

## Project structure

```
voting-app/
├── main.py              # App entry point, middleware, SPA fallback
├── models.py            # SQLAlchemy ORM models
├── database.py          # DB init & auto-migrations
├── auth.py              # JWT encode/decode, OTP helpers
├── config.py            # Env var loading
├── email_service.py     # Brevo / Resend integration
├── routes/
│   └── api.py           # All REST endpoints  (/api/*)
├── frontend/
│   ├── src/
│   │   ├── pages/       # Login · Signup · Dashboard · Questions · Pulse · Profile · Admin
│   │   ├── components/  # Layout, shared UI
│   │   ├── context/     # AuthContext (auth state + user)
│   │   └── api.js       # Typed API client (fetch + credentials)
│   └── dist/            # Production build — git-ignored
└── data/
    ├── voting.db        # SQLite database — git-ignored
    └── app.log          # Rotating application log — git-ignored
```

---

## First-time setup checklist

- [ ] `SECRET_KEY` set to a strong random value
- [ ] Email provider configured (`BREVO_API_KEY` or `RESEND_API_KEY`)
- [ ] `FROM_EMAIL` set to a verified sender address
- [ ] `AUTO_APPROVE_FIRST_USER=1` for the initial admin account
- [ ] Frontend built (`npm run build`) before running in production
