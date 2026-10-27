# المزين / Almozayen: barber booking prototype

One repo, one deployment:
- `app/`: React Native (Expo) app for Android, iOS and web, Arabic and English
- `backend/`: Node.js + Express + PostgreSQL API and the admin dashboard (`/admin`)
- `api/index.js` + `vercel.json`: put both behind a single Vercel project (website at `/`, API at `/api`, dashboard at `/admin`)

## Deploy (one Vercel project + free Neon database)
1. Neon: create a free project and copy its connection string.
2. Push this repo to GitHub, then in Vercel: Add New, Project, import it. Leave Root Directory empty and Framework "Other". The build settings come from `vercel.json`.
3. Environment variables: DATABASE_URL, PGSSL=1, JWT_SECRET (32+ random chars), ADMIN_EMAIL, ADMIN_PASSWORD. Do NOT set EXPO_PUBLIC_API_URL for the web build.
4. Deploy, then open `/health`, `/admin` and `/`.

## Run locally
- Backend: `cd backend && cp .env.example .env`, fill it in, `npm install`, `npm start`
- App: `cd app && npm install`, set `EXPO_PUBLIC_API_URL=http://localhost:3000`, `npx expo start`

## Security notes (prototype)
Per-IP rate limits, bcrypt passwords, JWT roles, a signed one-time anti-bot challenge plus a honeypot field, and a unique database index that stops two people booking the same slot. On serverless the rate limits and replay check are per instance, not global.
