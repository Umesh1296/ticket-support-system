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
   * Firebase Login — verify Firebase ID token, look up role in MongoDB, return profile.
   * If the user doesn't exist in MongoDB yet, auto-register them.
   */
  router.post('/firebase-login', async (req, res) => {
    try {
      const { idToken, role } = req.body
      if (!idToken) return res.status(400).json({ success: false, error: 'Firebase ID token is required' })
      if (!role || !isValidRole(role)) return res.status(400).json({ success: false, error: 'Valid role is required' })

      // Verify the Firebase token
      const decoded = await verifyFirebaseToken(idToken)
      if (!decoded || !decoded.email) {
        return res.status(401).json({ success: false, error: 'Invalid Firebase token' })
      }

      const email = decoded.email.toLowerCase()

      // Super Admin check — only the configured email can be super_admin
      if (role === ROLES.super_admin) {
        if (!SUPER_ADMIN_EMAIL || email !== SUPER_ADMIN_EMAIL) {
          return res.status(403).json({ success: false, error: 'You are not authorized as Super Admin' })
        }

        const superAdmin = await ensureSuperAdminAccount(store, {
          email,
          name: decoded.name || 'Super Admin',
          firebase_uid: decoded.uid,
          provider: decoded.provider === 'google.com' ? 'google' : 'firebase',
        })

        const token = createAuthToken(superAdmin)
        return res.json({
          success: true,
          data: { token, user: sanitizeUser(superAdmin) },
          message: 'Super Admin login successful',
        })
      }

      // Check if user already exists in the target role
      let user = null
      if (role === ROLES.manager) user = await store.findManagerByEmail(email)
      else if (role === ROLES.operator) user = await store.findOperatorByEmail(email)
      else if (role === ROLES.employee) user = await store.findEmployeeByEmail(email)

      if (user) {
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

      // ---- User doesn't exist in this role — auto-register for employee, restrict others ----

      // Employees — disabled self-registration
      if (role === ROLES.employee) {
        return res.status(403).json({
          success: false,
          error: 'End User accounts are created by an Admin. Contact your administrator.',
        })
      }

      // Managers — only Super Admin can create them
      if (role === ROLES.manager) {
        return res.status(403).json({
          success: false,
          error: 'Admin accounts are created by the Super Admin only. Contact your system administrator.',
        })
      }

      // Operators — only Manager/Super Admin can create them
      if (role === ROLES.operator) {
        return res.status(403).json({
          success: false,
          error: 'Support Agent accounts are created by an Admin. Contact your administrator.',
        })
      }

      return res.status(400).json({ success: false, error: 'Unable to login' })
    } catch (err) {
      console.error('[Auth] Firebase login error:', err.message)
      res.status(500).json({ success: false, error: err.message })
    }
  })

  /**
   * Local Login Fallback — Check credentials directly against DB if Firebase Auth fails
   */
  router.post('/local-login', async (req, res) => {
    try {
      const { email, password, role } = req.body
      if (!email || !password || !role) {
        return res.status(400).json({ success: false, error: 'Email, password, and role are required' })
      }

      const normalizedEmail = email.toLowerCase()

      if (role === ROLES.super_admin) {
        if (!SUPER_ADMIN_EMAIL || normalizedEmail !== SUPER_ADMIN_EMAIL) {
          return res.status(401).json({ success: false, error: 'Invalid email or password' })
        }

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
          data: { token, user: sanitizeUser(superAdmin, role) },
          message: 'Super Admin login successful via local password',
        })
      }

      let user = null
      if (role === ROLES.manager) user = await store.findManagerByEmail(normalizedEmail)
      else if (role === ROLES.operator) user = await store.findOperatorByEmail(normalizedEmail)
      else if (role === ROLES.employee) user = await store.findEmployeeByEmail(normalizedEmail)

      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' })
      }

      if (!verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' })
      }

      const token = createAuthToken(user)
      return res.json({
        success: true,
        data: { token, user: sanitizeUser(user, role) },
        message: 'Login successful via local fallback',
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

      // Look up across all roles
      const [superAdmin, manager, operator, employee] = await Promise.all([
        store.findSuperAdminByEmail(email),
        store.findManagerByEmail(email),
        store.findOperatorByEmail(email),
        store.findEmployeeByEmail(email),
      ])

      const found = superAdmin || manager || operator || employee
      if (!found) {
        return res.status(401).json({ success: false, error: 'Account not found. Please register first.' })
      }

      res.json({
        success: true,
        data: { user: sanitizeUser(found) },
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
