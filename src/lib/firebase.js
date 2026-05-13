import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Safe initialization: never crash the app if Firebase config is missing
let app = null
let auth = null
const googleProvider = new GoogleAuthProvider()

try {
  if (!firebaseConfig.apiKey) {
    console.warn('[TicketFlow] Firebase env vars not set. Running without Firebase Auth. Local login only.')
  } else {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
    auth = getAuth(app)
  }
} catch (err) {
  console.warn('[TicketFlow] Firebase init failed:', err.message)
}

function getAuthSafe() {
  if (!auth) throw new Error('Firebase Auth not initialized. Check your VITE_FIREBASE_* environment variables.')
  return auth
}

export async function firebaseEmailLogin(email, password) {
  const credential = await signInWithEmailAndPassword(getAuthSafe(), email, password)
  return credential.user
}

export async function firebaseEmailRegister(email, password, name) {
  const credential = await createUserWithEmailAndPassword(getAuthSafe(), email, password)
  if (name) await updateProfile(credential.user, { displayName: name })
  return credential.user
}

export async function firebaseGoogleLogin() {
  const result = await signInWithPopup(getAuthSafe(), googleProvider)
  return result.user
}

export async function firebaseSignOut() {
  if (!auth) return
  await signOut(auth)
}

export async function getFirebaseIdToken() {
  if (!auth?.currentUser) return null
  return auth.currentUser.getIdToken()
}

export async function firebaseSendPasswordReset(email) {
  await sendPasswordResetEmail(getAuthSafe(), email)
}

export function onFirebaseAuthChange(callback) {
  if (!auth) return () => {}
  return onAuthStateChanged(auth, callback)
}

export { auth }
