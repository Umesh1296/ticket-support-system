import { useState } from 'react'
import { Eye, EyeOff, Zap } from 'lucide-react'
import { firebaseEmailLogin, firebaseGoogleLogin, firebaseSendPasswordReset } from '../lib/firebase.js'
import { getFriendlyErrorMessage } from '../lib/api.js'


export default function LoginPage({ API, addToast, onFirebaseLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  const doServerLogin = async (idToken) => {
    const { data } = await API.post('/auth/firebase-login', { idToken })
    if (!data.success) throw new Error(data.error || 'Login failed')
    localStorage.setItem('ticketflow_user_role', data.data.user.role)
    await onFirebaseLogin(data.data)
  }

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) { addToast('Email and password required', 'error'); return }
    setLoading(true)
    try {
      const fbUser = await firebaseEmailLogin(email, password)
      const idToken = await fbUser.getIdToken()
      await doServerLogin(idToken)
    } catch (fbErr) {
      // Firebase failed — try local fallback
      try {
        const { data } = await API.post('/auth/local-login', { email, password })
        if (!data.success) throw new Error(data.error)
        localStorage.setItem('ticketflow_user_role', data.data.user.role)
        await onFirebaseLogin(data.data)
      } catch (localErr) {
        addToast(getFriendlyErrorMessage(localErr, 'Invalid credentials'), 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      const fbUser = await firebaseGoogleLogin()
      const idToken = await fbUser.getIdToken()
      await doServerLogin(idToken)
    } catch (err) {
      addToast(getFriendlyErrorMessage(err, 'Google sign-in failed'), 'error')
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    if (!forgotEmail) { addToast('Enter your email', 'error'); return }
    setForgotLoading(true)
    try {
      await firebaseSendPasswordReset(forgotEmail)
      addToast('Password reset email sent', 'success')
      setForgotMode(false)
    } catch {
      addToast('Could not send reset email', 'error')
    } finally {
      setForgotLoading(false)
    }
  }

  if (forgotMode) {
    return (
      <div className="auth-shell">
        <div className="auth-wrap">
          <div className="auth-brand">
            <div className="auth-logo-mark"><Zap size={24} color="#fff" fill="#fff" /></div>
            <div className="auth-title">Reset Password</div>
            <div className="auth-subtitle">We'll send a reset link to your email</div>
          </div>
          <div className="auth-card">
            <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="input" type="email" placeholder="you@company.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={forgotLoading} style={{ justifyContent: 'center' }}>
                {forgotLoading ? <span className="spinner-sm spinner" /> : 'Send Reset Link'}
              </button>
              <button type="button" className="auth-link" onClick={() => setForgotMode(false)} style={{ textAlign: 'center' }}>
                ← Back to Sign In
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell">
      <div className="auth-wrap">
        <div className="auth-brand">
          <div className="auth-logo-mark"><Zap size={24} color="#fff" fill="#fff" /></div>
          <div className="auth-title">Sign in to TicketFlow</div>
          <div className="auth-subtitle">Your workspace and role are resolved automatically.</div>
        </div>

        {/* Auth Form */}
        <div className="auth-card">
          <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input className="input" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPw ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" style={{ paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Provisioned accounts only</span>
              <button type="button" className="auth-link" style={{ fontSize: 12 }} onClick={() => setForgotMode(true)}>
                Forgot password?
              </button>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ justifyContent: 'center', padding: '10px' }}>
              {loading ? <><span className="spinner spinner-sm" />Signing in...</> : 'Continue'}
            </button>
          </form>

          <>
            <div className="auth-divider">or</div>
            <button className="google-btn" onClick={handleGoogle} disabled={googleLoading} type="button">
              {googleLoading ? <span className="spinner spinner-sm" /> : (
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
                </svg>
              )}
              Continue with Google
            </button>
          </>

          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-2)' }}>Note:</strong> Accounts are provisioned by administrators. Your role is detected automatically from your credentials.
          </div>
        </div>
      </div>
    </div>
  )
}
