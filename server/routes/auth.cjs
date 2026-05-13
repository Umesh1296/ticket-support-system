const express = require('express')
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const {
  ROLES,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  createAuthToken,
  createUserAccount,
  emailExistsAcrossRoles,
  getAuthConfig,
  getStoredUserProfile,
  isValidRole,
  requireAuth,
  sanitizeUser,
  hashPassword,
  verifyPassword,
} = require('../auth.cjs')
const { verifyFirebaseToken, createFirebaseAuthUser } = require('../firebase.cjs')

function canAccessTicket(user, ticket) {
  if (user.role === ROLES.super_admin) return true
  if (user.role === ROLES.manager) return true
  if (user.role === ROLES.operator) return ticket.assigned_to === user.id
  if (ticket.reporter_user_id) return ticket.reporter_user_id === user.id
  return ticket.reporter_email?.toLowerCase() === user.email.toLowerCase()
}

function timingSafeTextEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
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
  if ((!superAdmin.name || superAdmin.name === 'Super Admin') && name && superAdmin.name !== name) updates.name = name

  if (Object.keys(updates).length > 0) {
    superAdmin = await store.updateSuperAdmin(superAdmin.id, updates)
  }

  return superAdmin
}

/**
 * Helper: find a user across all role collections and return { user, role }.
 */
async function findUserAcrossRoles(store, email) {
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

  /**
   * Firebase Login — verify Firebase ID token, auto-detect role from MongoDB.
   * Role parameter is no longer required — the system finds the user automatically.
   */
  router.post('/firebase-login', async (req, res) => {
    try {
      const { idToken } = req.body
      if (!idToken) return res.status(400).json({ success: false, error: 'Firebase ID token is required' })

      // Verify the Firebase token
      const decoded = await verifyFirebaseToken(idToken)
      if (!decoded || !decoded.email) {
        return res.status(401).json({ success: false, error: 'Invalid Firebase token' })
      }

      const email = decoded.email.toLowerCase()

      // Super Admin check — if this email matches the configured super admin
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

      // Auto-detect role by searching across all collections
      const found = await findUserAcrossRoles(store, email)

      if (found) {
        let { user, role } = found

        // Update firebase_uid if missing
        if (!user.firebase_uid) {
          const methods = require('../auth.cjs').getRoleMethods(store, role)
          await methods.update(user.id, { firebase_uid: decoded.uid, provider: decoded.provider === 'google.com' ? 'google' : 'firebase' })
          user = await methods.findById(user.id)
        }

        const token = createAuthToken(user)
        return res.json({
          success: true,
          data: { token, user: sanitizeUser(user, role) },
          message: 'Login successful',
        })
      }

      // User not found in any collection
      return res.status(403).json({
        success: false,
        error: 'No account found for this email. Accounts are provisioned by administrators.',
      })
    } catch (err) {
      console.error('[Auth] Firebase login error:', err.message)
      res.status(500).json({ success: false, error: err.message })
    }
  })

  /**
   * Local Login — auto-detect role, verify password against the matched account.
   * Role parameter is no longer required.
   */
  router.post('/local-login', async (req, res) => {
    try {
      const { email, password } = req.body
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required' })
      }

      const normalizedEmail = email.toLowerCase()

      // Super Admin check first
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
          message: 'Super Admin login successful',
        })
      }

      // Auto-detect role by searching across all collections
      const found = await findUserAcrossRoles(store, normalizedEmail)

      if (!found) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' })
      }

      const { user, role } = found

      if (!verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' })
      }

      const token = createAuthToken(user)
      return res.json({
        success: true,
        data: { token, user: sanitizeUser(user, role) },
        message: 'Login successful',
      })
    } catch (err) {
      console.error('[Auth] Local login error:', err.message)
      res.status(500).json({ success: false, error: 'Internal server error during login' })
    }
  })

  /**
   * Get current user profile
   */
  router.get('/me', requireAuth, async (req, res) => {
    try {
      const email = req.user.email
      if (!email) return res.status(401).json({ success: false, error: 'No email found' })

      const found = await findUserAcrossRoles(store, email)
      if (!found) {
        return res.status(401).json({ success: false, error: 'Account not found. Please register first.' })
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
