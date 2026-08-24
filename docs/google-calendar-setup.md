# Google Calendar Setup Guide

## Step 1: Create a Google Cloud Project

1. Go to: https://console.cloud.google.com
2. Click **New Project** → Name it "Medicare Platform" → Create

## Step 2: Enable the Calendar API

1. In your project, go to **APIs & Services → Library**
2. Search for **Google Calendar API**
3. Click **Enable**

## Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. Configure consent screen first if prompted:
   - User Type: **External**
   - App name: Medicare Health Platform
   - Add your email as a test user
4. Application type: **Web application**
5. Authorized redirect URIs:
   - Development: `http://localhost:5000/api/calendar/callback`
   - Production: `https://your-backend-url.onrender.com/api/calendar/callback`
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

## Step 4: Set Environment Variables

In your `backend/.env`:
```
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/calendar/callback
```

On Render, set the same variables in the environment settings panel.

## Step 5: How It Works

1. Patient clicks "Connect Google Calendar" in the frontend
2. Frontend calls `GET /api/calendar/connect`
3. User is redirected to Google consent screen
4. After consent, Google calls your callback URL
5. Your app receives tokens and creates calendar events for appointments

## Notes

- On the **free Render plan**, the backend may sleep after inactivity. Calendar OAuth redirects may time out if the backend is asleep.
- Tokens are currently passed via redirect. In production, store tokens server-side (encrypted in the database) linked to the user ID.
- The `googleapis` package is already installed in `backend/package.json`.
