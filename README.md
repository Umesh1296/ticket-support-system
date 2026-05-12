 # ⚡ TicketFlow — Internal IT Support Desk

A production-grade full-stack helpdesk platform with role-based access, intelligent auto-assignment, real-time chat, SLA enforcement, and a full audit trail.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite, Lucide React, Recharts |
| Backend | Express 5, Node.js |
| Database | MongoDB + Mongoose 9 |
| Auth | Firebase (email/password + Google) + HMAC tokens |
| Deploy | Vercel (frontend) + Render (backend) |

---

## 🚀 Quick Start (Local)

### 1. Clone & Install
```bash
git clone <your-repo>
cd ticketflow
npm install
```

### 2. Firebase Setup
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Email/Password** and **Google** sign-in providers under Authentication
3. Go to **Project Settings → Service Accounts → Generate new private key**
4. Save the downloaded file as `firebase-service-account.json` in the project root

### 3. Configure Environment
```bash
cp .env.example .env
```
Fill in your `.env`:
```env
MONGO_URI=mongodb+srv://...
TICKETFLOW_AUTH_SECRET=any-random-string-here
SUPER_ADMIN_EMAIL=your@email.com
SUPER_ADMIN_PASSWORD=change-this-super-admin-password
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

VITE_API_BASE_URL=http://localhost:5000/api
```

### 4. Run
```bash
npm run dev
```
Open **http://localhost:3000**

### 5. First Login
Sign in as `Super Admin` using either:
1. Google with your `SUPER_ADMIN_EMAIL`
2. Email/password with `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`

The system will auto-create your Super Admin account on first successful login. Then:
1. Create Manager accounts via the Super Admin console
2. Managers create Support Agents and End Users
3. End Users submit tickets, Auto-Assignment routes them to agents

---

## 🌐 Deployment: Vercel + Render

### Backend → Render

1. Push your project to GitHub
2. Create a new **Web Service** on [render.com](https://render.com)
   - **Build Command:** `npm install`
   - **Start Command:** `node server/server.cjs`
3. Add environment variables in Render dashboard:
   ```
   MONGO_URI=...
   TICKETFLOW_AUTH_SECRET=...
   SUPER_ADMIN_EMAIL=...
   SUPER_ADMIN_PASSWORD=...
   FIREBASE_SERVICE_ACCOUNT_PATH=/etc/secrets/firebase-service-account.json
   NODE_ENV=production
   ```
4. Upload a secret file named `firebase-service-account.json`
5. Note your Render URL: `https://ticketflow-backend.onrender.com`

### Frontend → Vercel

1. Create a new project on [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set **Framework Preset** to `Vite`
4. Add environment variables:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_API_BASE_URL=https://ticketflow-backend.onrender.com/api
   ```
5. Deploy!

### Firebase CORS (Add Vercel domain to Firebase)
1. Go to Firebase Console → Authentication → Settings → Authorized domains
2. Add your Vercel domain: `ticketflow.vercel.app`

---

## 👥 Roles & Access

| Role | Created By | Can Do |
|---|---|---|
| **Super Admin** | System (env var) | Manage managers, system-wide view, impersonate |
| **Manager** | Super Admin | Manage agents & users, full ticket view, settings |
| **Support Agent** | Manager | Handle assigned tickets, chat, file service reports |
| **End User** | Manager | Submit tickets, chat, provide feedback |

---

## 🤖 Smart Features

- **Auto-Assignment Engine** — Scores agents on skill match (0-50pts), workload (0-30pts), availability (0-20pts), priority boost (0-15pts)
- **NLP Category/Priority Detection** — Auto-classifies tickets from description using keyword scoring
- **SLA Enforcement** — Critical: 1h | High: 4h | Medium: 24h | Low: 72h (configurable)
- **Mandatory Work Logs** — Agents must file a structured service report before resolving
- **Real-time Chat** — Bidirectional chat between agents and customers (polls every 5s)
- **Audit Trail** — Every agent action logged with timestamps and CSAT tracking

---

## 📁 Project Structure

```
ticketflow/
├── src/                      # React frontend
│   ├── components/           # Reusable UI components
│   ├── pages/                # Page components per role
│   ├── lib/                  # API client, Firebase, taxonomy
│   ├── App.jsx               # Auth shell & routing
│   └── index.css             # Complete design system
├── server/                   # Express backend
│   ├── server.cjs            # App bootstrap
│   ├── auth.cjs              # Auth middleware & HMAC tokens
│   ├── database.cjs          # MongoDB adapter
│   ├── autoAssign.cjs        # Smart assignment algorithm
│   ├── models/               # Extended Mongoose schemas
│   └── routes/               # API route handlers
├── vercel.json               # Vercel SPA config
├── render.yaml               # Render deployment config
└── .env.example              # Environment variable template
```

---

## 📋 Submission Checklist

- [x] Full-stack project (React + Express + MongoDB)
- [x] Firebase Authentication (email/password + Google)
- [x] Role-based access control (4 roles)
- [x] Intelligent auto-assignment with scoring algorithm
- [x] NLP-lite category and priority detection
- [x] SLA enforcement with configurable rules
- [x] Real-time bidirectional chat (polling)
- [x] Mandatory work log / service reports
- [x] Customer feedback (1-5 stars)
- [x] Comprehensive audit trail
- [x] Dark/Light theme toggle
- [x] Responsive design
- [x] Vercel + Render split deployment ready
- [x] Environment variables configured
- [x] Health endpoint at `/api/health`
