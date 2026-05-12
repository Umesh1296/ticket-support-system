const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const { verifyFirebaseToken } = require('./firebase.cjs')

const ROLES = {
  super_admin: 'super_admin',
  manager: 'manager',
  employee: 'employee',
  operator: 'operator',
}

const DEFAULT_EMPLOYEE_PASSWORD = process.env.EMPLOYEE_DEFAULT_PASSWORD || 'Employee@123'
const DEFAULT_OPERATOR_PASSWORD = process.env.OPERATOR_DEFAULT_PASSWORD || 'Operator@123'
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase()
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || ''

function isValidRole(role) {
  return Object.values(ROLES).includes(role)
}

function sanitizeUser(user, fallbackRole = null) {
  // If user is a Mongoose document, use get('id') to get our custom UUID field
  // instead of the default 'id' virtual which aliases '_id'.
  const id = (user.get && typeof user.get === 'function') ? user.get('id') : (user.id || user._id)
  
  return {
    id,
    name: user.name,
    email: user.email,
    role: user.role || fallbackRole || null,
    provider: user.provider || 'firebase',
    firebase_uid: user.firebase_uid || null,
    manager_id: user.manager_id || null,
  }
}

function getRoleMethods(store, role) {
  if (role === ROLES.super_admin) {
    return {
      all: store.getSuperAdmins.bind(store),
      findByEmail: store.findSuperAdminByEmail.bind(store),
      findById: store.findSuperAdminById.bind(store),
      insert: store.insertSuperAdmin.bind(store),
      update: store.updateSuperAdmin.bind(store),
    }
  }

  if (role === ROLES.manager) {
    return {
      all: store.getManagers.bind(store),
      findByEmail: store.findManagerByEmail.bind(store),
      findById: store.findManagerById.bind(store),
      insert: store.insertManager.bind(store),
      update: store.updateManager.bind(store),
    }
  }

  if (role === ROLES.operator) {
    return {
      all: store.getOperators.bind(store),
      findByEmail: store.findOperatorByEmail.bind(store),
      findById: store.findOperatorById.bind(store),
      insert: store.insertOperator.bind(store),
      update: store.updateOperator.bind(store),
    }
  }

  return {
    all: store.getEmployees.bind(store),
    findByEmail: store.findEmployeeByEmail.bind(store),
    findById: store.findEmployeeById.bind(store),
    insert: store.insertEmployee.bind(store),
    update: store.updateEmployee.bind(store),
  }
}

function getRoleCollection(role) {
  if (role === ROLES.super_admin) return 'SuperAdmins'
  if (role === ROLES.manager) return 'Managers'
  if (role === ROLES.operator) return 'Operators'
  return 'Employees'
}

// ====== Legacy HMAC tokens (kept for backward compat during migration) ======
const AUTH_SECRET = process.env.TICKETFLOW_AUTH_SECRET || 'ticketflow-local-secret'

function sign(value) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(value).digest('base64url')
}

function createAuthToken(user) {
  const payload = {
    ...sanitizeUser(user),
    exp: Date.now() + 1000 * 60 * 60 * 12,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${sign(encodedPayload)}`
}

function verifyLegacyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [encodedPayload, signature] = parts
  if (!encodedPayload || !signature || sign(encodedPayload) !== signature) return null
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp < Date.now()) return null
    return sanitizeUser(payload, ROLES.manager)
  } catch { return null }
}

// ====== Password hashing (still needed for admin-created accounts) ======
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, storedPasswordHash) {
  if (!storedPasswordHash || !storedPasswordHash.includes(':')) return false
  const [salt, storedHash] = storedPasswordHash.split(':')
  const derivedHash = crypto.scryptSync(password, salt, 64)
  const storedBuffer = Buffer.from(storedHash, 'hex')
  return storedBuffer.length === derivedHash.length && crypto.timingSafeEqual(storedBuffer, derivedHash)
}

// ====== Firebase-first auth middleware ======
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' })
  }

  // Try Firebase token first (eyJ... JWT format)
  if (token.startsWith('eyJ')) {
    verifyFirebaseToken(token)
      .then(decoded => {
        if (decoded) {
          // Firebase token verified — set minimal user info, 
          // the route handler will look up the full profile from MongoDB
          req.user = {
            firebase_uid: decoded.uid,
            email: decoded.email,
            name: decoded.name,
            provider: decoded.provider,
            // Role will be resolved from the X-User-Role header or MongoDB lookup
            role: req.headers['x-user-role'] || null,
          }
          return next()
        }
        // Firebase verification failed — try legacy
        const legacyUser = verifyLegacyToken(token)
        if (legacyUser) {
          req.user = legacyUser
          return next()
        }
        return res.status(401).json({ success: false, error: 'Invalid or expired token' })
      })
      .catch(() => {
        return res.status(401).json({ success: false, error: 'Authentication failed' })
      })
  } else {
    // Legacy HMAC token
    const legacyUser = verifyLegacyToken(token)
    if (legacyUser) {
      req.user = legacyUser
      return next()
    }
    return res.status(401).json({ success: false, error: 'Invalid or expired token' })
  }
}

/**
 * Middleware: resolve the full user profile from MongoDB after Firebase auth.
 * This sets req.user with the complete profile including role.
 */
function requireProfileResolution(store) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' })
      }

      // If already resolved (legacy token), skip
      if (req.user.id && req.user.role) {
        return next()
      }

      const email = req.user.email
      if (!email) {
        return res.status(401).json({ success: false, error: 'No email in token' })
      }

      // Look up user across all role collections
      const [superAdmin, manager, operator, employee] = await Promise.all([
        store.findSuperAdminByEmail(email),
        store.findManagerByEmail(email),
        store.findOperatorByEmail(email),
        store.findEmployeeByEmail(email),
      ])

      if (superAdmin) {
        req.user = sanitizeUser(superAdmin, ROLES.super_admin)
        return next()
      }
      if (manager) {
        req.user = sanitizeUser(manager, ROLES.manager)
        return next()
      }
      if (operator) {
        req.user = sanitizeUser(operator, ROLES.operator)
        return next()
      }
      if (employee) {
        req.user = sanitizeUser(employee, ROLES.employee)
        return next()
      }

      // User exists in Firebase but not in MongoDB — possible new user
      // Let them through with minimal info so the auth routes can handle registration
      return next()
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Profile resolution failed' })
    }
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' })

    // Super admin can access everything
    if (req.user.role === ROLES.super_admin) return next()

    if (!allowedRoles.includes(req.user.role)) {
      const roleLabel = req.user.role || 'This account'
      return res.status(403).json({ success: false, error: `${roleLabel} access is not allowed here` })
    }

    next()
  }
}

async function emailExistsAcrossRoles(store, email) {
  const [superAdmin, manager, employee, operator] = await Promise.all([
    store.findSuperAdminByEmail(email),
    store.findManagerByEmail(email),
    store.findEmployeeByEmail(email),
    store.findOperatorByEmail(email)
  ])
  return Boolean(superAdmin || manager || employee || operator)
}

async function getAuthConfig(store) {
  const [superAdmins, managers, employees, operators] = await Promise.all([
    store.getSuperAdmins(),
    store.getManagers(),
    store.getEmployees(),
    store.getOperators()
  ])

  return {
    firebaseEnabled: true,
    superAdminConfigured: Boolean(SUPER_ADMIN_EMAIL),
    superAdminPasswordConfigured: Boolean(SUPER_ADMIN_PASSWORD),
    superAdminCount: superAdmins.length,
    managerCount: managers.length,
    employeeCount: employees.length,
    operatorCount: operators.length,
    roles: Object.values(ROLES),
  }
}

async function getStoredUserProfile(store, role, email) {
  if (!isValidRole(role)) return null
  const methods = getRoleMethods(store, role)
  const user = await methods.findByEmail(email)
  if (!user) return null
  return sanitizeUser(user, role)
}

async function createUserAccount(store, { role, name, email, firebase_uid, provider = 'firebase', manager_id }) {
  const methods = getRoleMethods(store, role)
  const user = {
    id: uuidv4(),
    name,
    email: email.toLowerCase(),
    firebase_uid,
    provider,
    role,
    manager_id,
    created_at: new Date().toISOString(),
  }

  await methods.insert(user)
  return sanitizeUser(user, role)
}

function isLegacyManagerUser() {
  return false // Legacy mode no longer supported
}

function canBootstrapManagerAccount() {
  return false // Managers are now created by Super Admin only
}

module.exports = {
  DEFAULT_EMPLOYEE_PASSWORD,
  DEFAULT_OPERATOR_PASSWORD,
  ROLES,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  createAuthToken,
  createUserAccount,
  emailExistsAcrossRoles,
  getAuthConfig,
  getRoleCollection,
  getRoleMethods,
  getStoredUserProfile,
  hashPassword,
  verifyPassword,
  canBootstrapManagerAccount,
  isLegacyManagerUser,
  isValidRole,
  requireAuth,
  requireProfileResolution,
  requireRole,
  sanitizeUser,
}
