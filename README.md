# Medicare — AI-Powered Healthcare Appointment & Follow-up Manager

A full-stack clinic management platform with **role-based portals** (Patient, Doctor, Admin), **AI-generated visit summaries** (Google Gemini), **email notifications** (Gmail + Nodemailer), and **Google Calendar integration**.

---

## Features

| Feature | Status |
|---|---|
| Patient booking with symptom intake | ✅ |
| Dynamic slot generation from working hours | ✅ |
| Double-booking prevention (DB-level index) | ✅ |
| 5-minute slot hold mechanism | ✅ |
| AI pre-visit summary (Gemini 1.5 Flash) | ✅ |
| AI post-visit patient-friendly summary | ✅ |
| Email confirmations & reminders (Nodemailer) | ✅ |
| Doctor leave management with patient notification | ✅ |
| Background jobs (slot cleanup, reminders, email retry) | ✅ |
| Google Calendar event creation | ✅ |
| Disease Predictor (ML) — preserved | ✅ |
| Admin dashboard with full control | ✅ |

---

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd DOCTOR_MEDS-main

# Install backend
cd backend && npm install

# Install frontend
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
# In /backend, create .env from example
cp ../.env.example backend/.env
# Fill in your values (see below)
```

### 3. Required `.env` Values

| Variable | Where to Get |
|---|---|
| `MONGODB_URI` | [MongoDB Atlas](https://mongodb.com/atlas) → Free cluster |
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com) → Get API Key (Free) |
| `EMAIL_USER` | Your Gmail address |
| `EMAIL_PASSWORD` | [Gmail App Password](https://myaccount.google.com/apppasswords) |
| `GOOGLE_CLIENT_*` | [Google Cloud Console](https://console.cloud.google.com) → See `docs/google-calendar-setup.md` |

### 4. Run Locally

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

Backend: `http://localhost:5000`  
Frontend: `http://localhost:5173`

---

## Architecture

```
DOCTOR_MEDS-main/
├── backend/
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express route handlers
│   ├── services/        # Business logic (AI, Email, Calendar, Slots)
│   ├── middleware/       # JWT auth middleware
│   ├── jobs/            # node-cron background jobs
│   └── server.js
│
├── frontend/
│   └── src/
│       └── components/   # React components (Patient, Doctor, Admin dashboards)
│
├── docs/                 # Setup guides
├── .env.example
└── render.yaml           # Render deployment config
```

---

## Deployment (Render)

1. Push code to GitHub
2. Create a Render account at [render.com](https://render.com)
3. New → Blueprint → Connect your GitHub repo
4. Render will auto-detect `render.yaml`
5. Set all environment variables in the Render dashboard
6. Deploy

---

## API Overview

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/signup` | Register patient |
| `POST` | `/api/login` | Login (all roles) |
| `GET`  | `/api/appointments/slots` | Get available slots |
| `POST` | `/api/appointments/hold` | Hold a slot (5 min) |
| `POST` | `/api/appointments` | Book appointment |
| `POST` | `/api/appointments/:id/notes` | Doctor: submit clinical notes |
| `POST` | `/api/appointments/:id/reschedule` | Reschedule |
| `DELETE` | `/api/appointments/:id` | Cancel |
| `POST` | `/api/ai/pre-visit-summary` | Generate AI pre-visit |
| `POST` | `/api/ai/post-visit-summary` | Generate AI post-visit |
| `GET`  | `/api/calendar/connect` | Initiate Google OAuth |
| `GET`  | `/api/calendar/callback` | Google OAuth callback |
| `GET`  | `/api/admin/doctors/:id/leave` | Get leave days |
| `POST` | `/api/admin/doctors/:id/leave` | Add leave + notify patients |

---

## Disease Predictor

The existing ML-based disease predictor is preserved unchanged. It connects to a separate Python FastAPI service at `http://localhost:8000/predict`.

---

## Notes

- **AI failures** are graceful — appointments never fail if Gemini is unavailable
- **Email failures** are queued for retry (up to 3 attempts every 5 minutes)
- **Calendar failures** are logged but never block the core booking flow
- **Double booking** is protected by a MongoDB unique partial index
