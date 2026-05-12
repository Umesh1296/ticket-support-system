const admin = require('firebase-admin')
const path = require('path')

let firebaseApp = null

function initializeFirebase() {
  if (firebaseApp) return firebaseApp

  // Priority 1: Inline JSON from env var (easiest for Render / cloud deploys)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson)
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
      console.log('[Firebase] Admin SDK initialized from FIREBASE_SERVICE_ACCOUNT_JSON env var')
      return firebaseApp
    } catch (err) {
      console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', err.message)
      return null
    }
  }

  // Priority 2: File path (local dev / Render Secret Files)
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (!serviceAccountPath) {
    console.warn('[Firebase] Neither FIREBASE_SERVICE_ACCOUNT_JSON nor FIREBASE_SERVICE_ACCOUNT_PATH is set — Firebase Admin SDK disabled')
    return null
  }

  try {
    const resolvedPath = path.resolve(serviceAccountPath)
    const serviceAccount = require(resolvedPath)
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
    console.log('[Firebase] Admin SDK initialized from file:', resolvedPath)
    return firebaseApp
  } catch (err) {
    console.error('[Firebase] Failed to initialize Admin SDK:', err.message)
    return null
  }
}

/**
 * Verify a Firebase ID token from the frontend.
 * Returns the decoded token payload (uid, email, name, etc.) or null.
 */
async function verifyFirebaseToken(idToken) {
  if (!firebaseApp) return null
  try {
    const decoded = await admin.auth().verifyIdToken(idToken)
    return {
      uid: decoded.uid,
      email: decoded.email?.toLowerCase() || null,
      name: decoded.name || decoded.email?.split('@')[0] || 'User',
      picture: decoded.picture || null,
      provider: decoded.firebase?.sign_in_provider || 'unknown',
      email_verified: decoded.email_verified || false,
    }
  } catch (err) {
    // Token expired, invalid, or revoked
    return null
  }
}

/**
 * Create a Firebase Auth user (for admin-created accounts).
 */
async function createFirebaseAuthUser(email, password, displayName) {
  if (!firebaseApp) throw new Error('Firebase not initialized')
  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    })
    return userRecord
  } catch (err) {
    // If user already exists in Firebase Auth, return existing
    if (err.code === 'auth/email-already-exists') {
      let existing = await admin.auth().getUserByEmail(email)
      if (password) {
        existing = await admin.auth().updateUser(existing.uid, { password })
      }
      return existing
    }
    throw err
  }
}

/**
 * Delete a Firebase Auth user.
 */
async function deleteFirebaseAuthUser(uid) {
  if (!firebaseApp) return
  try {
    await admin.auth().deleteUser(uid)
  } catch (err) {
    if (err.code !== 'auth/user-not-found') {
      console.error('[Firebase] Failed to delete auth user:', err.message)
    }
  }
}

/**
 * Get Firebase Auth user by email.
 */
async function getFirebaseUserByEmail(email) {
  if (!firebaseApp) return null
  try {
    return await admin.auth().getUserByEmail(email)
  } catch (err) {
    if (err.code === 'auth/user-not-found') return null
    throw err
  }
}

module.exports = {
  initializeFirebase,
  verifyFirebaseToken,
  createFirebaseAuthUser,
  deleteFirebaseAuthUser,
  getFirebaseUserByEmail,
}
