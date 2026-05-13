const express = require('express')
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const {
  ROLES,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  createAuthToken,
  getAuthConfig,
  getRoleMethods,
  requireAuth,
  sanitizeUser,
  verifyPassword,
} = require('../auth.cjs')
const { verifyFirebaseToken } = require('../firebase.cjs')

function timingSafeTextEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

async function findProvisionedAccountByEmail(store, email) {
  const [superAdmin, manager, operator, employee] = await Promise.all([
    store.findSuperAdminByEmail(email),
    store.findManagerByEmail(email),
    store.findOperatorByEmail(email),
    store.findEmployeeByEmail(email),
  ])

  if (superAdmin) return { user: superAdmin, role: ROLES.super_admin }
  if (manager) return { user: manager, role: ROLES.manager }
  if (operator) return { user: operator, role: ROLES.operator }
  if (employee) return { user: employee, role: ROLES.employee }
  return null
}

async function ensureSuperAdminAccount(store, { email, name = 'Super Admin', firebase_uid = null, provider = 'local' }) {
  let superAdmin = await store.findSuperAdminByEmail(email)
  if (!superAdmin) {
    superAdmin = {
      id: uuidv4(),
      name,
      email,
      role: ROLES.super_admin,
      firebase_uid,
      provider,
      created_at: new Date().toISOString(),
    }
    await store.insertSuperAdmin(superAdmin)
    return superAdmin
  }

  const updates = {}
  if (firebase_uid && !superAdmin.firebase_uid) updates.firebase_uid = firebase_uid
  if (provider && superAdmin.provider !== provider && (firebase_uid || !superAdmin.provider || superAdmin.provider === 'local')) {
    updates.provider = provider
  }
  if ((!superAdmin.name || superAdmin.name === 'Super Admin') && name && superAdmin.name !== name) {
    updates.name = name
  }

  if (Object.keys(updates).length > 0) {
    superAdmin = await store.updateSuperAdmin(superAdmin.id, updates)
  }

  return superAdmin
}

async function bindFirebaseProfile(store, account, decoded) {
  const provider = decoded.provider === 'google.com' ? 'google' : 'firebase'
  const updates = {}
  if (decoded.uid && !account.user.firebase_uid) updates.firebase_uid = decoded.uid
  if (provider && account.user.provider !== provider) updates.provider = provider

  if (!Object.keys(updates).length) return account.user

  const methods = getRoleMethods(store, account.role)
  const updated = await methods.update(account.user.id, updates)
  return updated || account.user
}

module.exports = (store) => {
  const router = express.Router()

  router.get('/config', async (req, res) => {
    try {
      const config = await getAuthConfig(store)
      res.json({ success: true, data: config })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/firebase-login', async (req, res) => {
    try {
      const { idToken } = req.body
      if (!idToken) {
        return res.status(400).json({ success: false, error: 'Firebase ID token is required' })
      }

      const decoded = await verifyFirebaseToken(idToken)
      if (!decoded || !decoded.email) {
        return res.status(401).json({ success: false, error: 'Invalid Firebase token' })
      }

      const email = decoded.email.toLowerCase()

      if (SUPER_ADMIN_EMAIL && email === SUPER_ADMIN_EMAIL) {
        const superAdmin = await ensureSuperAdminAccount(store, {
          email,
          name: decoded.name || 'Super Admin',
          firebase_uid: decoded.uid,
          provider: decoded.provider === 'google.com' ? 'google' : 'firebase',
        })

        const token = createAuthToken(superAdmin)
        return res.json({
          success: true,
          data: { token, user: sanitizeUser(superAdmin, ROLES.super_admin) },
          message: 'Super Admin login successful',
        })
      }

      const account = await findProvisionedAccountByEmail(store, email)
      if (!account) {
        return res.status(403).json({
          success: false,
          error: 'This account is not provisioned in TicketFlow. Contact your administrator.',
        })
      }

      const user = await bindFirebaseProfile(store, account, decoded)
      const token = createAuthToken(user)
      return res.json({
        success: true,
        data: { token, user: sanitizeUser(user, account.role) },
        message: 'Login successful',
      })
    } catch (err) {
      console.error('[Auth] Firebase login error:', err.message)
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/local-login', async (req, res) => {
    try {
      const { email, password } = req.body
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' })
      }

      const normalizedEmail = email.toLowerCase()

      if (SUPER_ADMIN_EMAIL && normalizedEmail === SUPER_ADMIN_EMAIL) {
        if (!SUPER_ADMIN_PASSWORD) {
          return res.status(403).json({
            success: false,
            error: 'Super Admin password login is not configured. Set SUPER_ADMIN_PASSWORD in the server environment.',
          })
        }

        if (!timingSafeTextEqual(password, SUPER_ADMIN_PASSWORD)) {
          return res.status(401).json({ success: false, error: 'Invalid email or password' })
        }

        const superAdmin = await ensureSuperAdminAccount(store, {
          email: normalizedEmail,
          name: 'Super Admin',
          provider: 'local',
        })

        const token = createAuthToken(superAdmin)
        return res.json({
          success: true,
          data: { token, user: sanitizeUser(superAdmin, ROLES.super_admin) },
          message: 'Super Admin login successful via local password',
        })
      }

      const account = await findProvisionedAccountByEmail(store, normalizedEmail)
      if (!account || !verifyPassword(password, account.user.password_hash)) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' })
      }

      const token = createAuthToken(account.user)
      return res.json({
        success: true,
        data: { token, user: sanitizeUser(account.user, account.role) },
        message: 'Login successful via local fallback',
      })
    } catch (err) {
      console.error('[Auth] Local login error:', err.message)
      res.status(500).json({ success: false, error: 'Internal server error during login' })
    }
  })

  router.get('/me', requireAuth, async (req, res) => {
    try {
      const email = req.user.email
      if (!email) return res.status(401).json({ success: false, error: 'No email found' })

      const found = await findProvisionedAccountByEmail(store, email.toLowerCase())
      if (!found) {
        return res.status(401).json({ success: false, error: 'Account not found. Contact your administrator.' })
      }

      res.json({
        success: true,
        data: { user: sanitizeUser(found.user, found.role) },
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/logout', requireAuth, (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' })
  })

  return router
}
