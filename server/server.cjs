require('dotenv').config()

const express = require('express')
const cors = require('cors')
const path = require('path')
const { requireAuth, requireRole, ROLES, requireProfileResolution } = require('./auth.cjs')
const { initializeDatabase } = require('./database.cjs')
const { initializeFirebase } = require('./firebase.cjs')

const app = express()
const db = initializeDatabase()
initializeFirebase()

// CORS — allow Vercel frontend + localhost dev
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.CORS_ORIGIN, // set to your Vercel URL in production
  'https://ticket-support-system-eosin.vercel.app',
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    console.warn(`[CORS] Blocked origin: ${origin}`)
    cb(null, false)
  },
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`)
  next()
})

app.use('/api/auth', require('./routes/auth.cjs')(db))
app.use('/api/superadmin', require('./routes/superadmin.cjs')(db))
app.use('/api/tickets', requireAuth, requireProfileResolution(db), require('./routes/tickets.cjs')(db))
app.use('/api/employees', requireAuth, requireProfileResolution(db), require('./routes/employees.cjs')(db))
app.use('/api/operators', requireAuth, requireProfileResolution(db), require('./routes/operators.cjs')(db))
app.use('/api/dashboard', requireAuth, requireProfileResolution(db), requireRole(ROLES.manager, ROLES.super_admin), require('./routes/dashboard.cjs')(db))
app.use('/api/chat', requireAuth, requireProfileResolution(db), require('./routes/chat.cjs')(db))
app.use('/api/audit', requireAuth, requireProfileResolution(db), require('./routes/audit.cjs')(db))
app.use('/api/settings', requireAuth, requireProfileResolution(db), require('./routes/settings.cjs')(db))

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'TicketFlow API is running',
    timestamp: new Date().toISOString(),
    database: 'connected',
  })
})

app.use((err, req, res, next) => {
  console.error('Server Error:', err.message)
  res.status(500).json({ success: false, error: 'Internal server error' })
})

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))

  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'))
  })
} else {
  // Fallback for API routes when not in production
  app.use((req, res) => {
    res.status(404).json({ success: false, error: `Route ${req.path} not found` })
  })
}

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`TicketFlow API running on http://localhost:${PORT}`)
})

module.exports = app
