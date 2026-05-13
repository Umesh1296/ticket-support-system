import axios from 'axios'
import { getFirebaseIdToken } from './firebase.js'

export const AUTH_TOKEN_KEY = 'ticketflow_auth_token'
const LEGACY_AUTH_TOKEN_KEY = 'ticketflow_manager_token'
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export const API = axios.create({ baseURL: API_BASE_URL })

let unauthorizedHandler = null

function isPublicAuthRequest(config) {
  const url = config?.url || ''
  return url.includes('/auth/firebase-login') || url.includes('/auth/local-login') || url.includes('/auth/config')
}

API.interceptors.request.use(async (config) => {
  // Try Firebase ID token first
  try {
    const firebaseToken = await getFirebaseIdToken()
    if (firebaseToken) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${firebaseToken}`
      // Also send the stored role for the auth middleware
      const storedRole = typeof window !== 'undefined' ? window.localStorage.getItem('ticketflow_user_role') : null
      if (storedRole) {
        config.headers['X-User-Role'] = storedRole
      }
      return config
    }
  } catch (e) {
    // Firebase not ready, fall through
  }

  // Fallback to localStorage token (legacy/server-issued)
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY) || window.localStorage.getItem(LEGACY_AUTH_TOKEN_KEY)
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
  }

  return config
})

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && unauthorizedHandler && !isPublicAuthRequest(error.config)) {
      unauthorizedHandler(error)
    }

    return Promise.reject(error)
  },
)

export function clearStoredAuthToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
  }
}

export function getFriendlyErrorMessage(error, fallbackMessage) {
  if (error.response?.status === 401) {
    return error.response?.data?.error || 'Your session has expired. Please sign in again.'
  }

  if (error.response?.data?.error) {
    return error.response.data.error
  }

  if (error.code === 'ERR_NETWORK' || !error.response) {
    return 'Cannot reach the TicketFlow server. Start it with "npm run dev".'
  }

  return fallbackMessage
}

export function getStoredAuthToken() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY) || window.localStorage.getItem(LEGACY_AUTH_TOKEN_KEY)
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

export function storeAuthToken(token) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
  }
}

/**
 * createAPI returns an axios instance bound to a specific auth token
 * and optionally scoped to a manager (for Super Admin impersonation).
 */
export function createAPI(token, managerId = null) {
  const baseURL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
  const instance = axios.create({ baseURL })

  instance.interceptors.request.use(async (config) => {
    // 1. Try to attach a fresh Firebase ID token
    try {
      const firebaseToken = await getFirebaseIdToken()
      if (firebaseToken) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${firebaseToken}`
        const storedRole = localStorage.getItem('ticketflow_user_role')
        if (storedRole) config.headers['X-User-Role'] = storedRole
        if (managerId) {
          config.params = config.params ? { ...config.params, manager_id: managerId } : { manager_id: managerId }
        }
        return config
      }
    } catch { /* Firebase not ready */ }

    // 2. Fall back to the server-issued HMAC token
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    if (managerId) {
      config.params = config.params ? { ...config.params, manager_id: managerId } : { manager_id: managerId }
    }
    return config
  })

  instance.interceptors.response.use(
    res => res,
    err => Promise.reject(err),
  )

  return instance
}
