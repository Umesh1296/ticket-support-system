import { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MessageSquare,
  Network,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Workflow,
} from 'lucide-react'
import { TicketFlowLogo, TicketFlowMark } from './Brand.jsx'
import { firebaseEmailLogin, firebaseGoogleLogin, firebaseSendPasswordReset } from '../lib/firebase.js'
import { getFriendlyErrorMessage } from '../lib/api.js'

const workflowItems = [
  { icon: MessageSquare, label: 'Conversation-first intake', value: '2m avg triage' },
  { icon: TimerReset, label: 'Live SLA risk prediction', value: '94% on-time' },
  { icon: Network, label: 'Skill and load assignment', value: '38% faster' },
  { icon: BarChart3, label: 'Operational analytics', value: 'live' },
]

const lifecycle = ['New', 'Classified', 'Assigned', 'In progress', 'Resolved']

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
    await onFirebaseLogin(data.data)
  }

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      addToast('Email and password required', 'error')
      return
    }

    setLoading(true)
    try {
      const fbUser = await firebaseEmailLogin(email, password)
      const idToken = await fbUser.getIdToken()
      await doServerLogin(idToken)
    } catch {
      try {
        const { data } = await API.post('/auth/local-login', { email, password })
        if (!data.success) throw new Error(data.error)
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
    if (!forgotEmail) {
      addToast('Enter your email', 'error')
      return
    }

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

  return (
    <div className="auth-shell">
      <header className="marketing-nav">
        <TicketFlowLogo subtitle="Support operations" />
        <div className="marketing-nav-actions">
          <a href="#workflow">Workflow</a>
          <a href="#analytics">Analytics</a>
          <a href="#enterprise">Enterprise</a>
          <a className="marketing-signin" href="#login">Sign in</a>
        </div>
      </header>

      <main className="marketing-main">
        <section className="marketing-hero">
          <div className="hero-copy">
            <div className="hero-kicker">
              <Sparkles size={14} />
              AI-assisted support operations
            </div>
            <h1>Resolve every support queue with clarity, speed, and control.</h1>
            <p>
              TicketFlow unifies intake, SLA risk, smart assignment, chat, work logs, and performance intelligence for teams that run support as an operation.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary btn-lg" href="#login">
                Enter workspace <ArrowRight size={16} />
              </a>
              <a className="btn btn-glass btn-lg" href="#preview">
                View platform
              </a>
            </div>
            <div className="hero-trust-strip" aria-label="Platform capabilities">
              <span><ShieldCheck size={14} />Role-aware access</span>
              <span><TimerReset size={14} />SLA automation</span>
              <span><Bot size={14} />AI summaries</span>
            </div>
          </div>

          <aside className="auth-panel" id="login" aria-label="TicketFlow sign in">
            <div className="auth-card-premium">
              <div className="auth-card-top">
                <TicketFlowMark size={42} />
                <div>
                  <div className="auth-form-title">{forgotMode ? 'Reset password' : 'Sign in to TicketFlow'}</div>
                  <div className="auth-form-subtitle">
                    {forgotMode ? 'A secure reset link will be sent to your email.' : 'Your workspace and role are resolved automatically.'}
                  </div>
                </div>
              </div>

              {forgotMode ? (
                <form onSubmit={handleForgot} className="auth-form">
                  <label className="field-shell">
                    <span>Email address</span>
                    <div className="field-control">
                      <Mail size={16} />
                      <input
                        type="email"
                        placeholder="you@company.com"
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        autoComplete="email"
                        required
                      />
                    </div>
                  </label>
                  <button className="btn btn-primary btn-block" type="submit" disabled={forgotLoading}>
                    {forgotLoading ? <span className="spinner spinner-sm" /> : <LockKeyhole size={15} />}
                    Send reset link
                  </button>
                  <button type="button" className="auth-link" onClick={() => setForgotMode(false)}>
                    Back to sign in
                  </button>
                </form>
              ) : (
                <>
                  <form onSubmit={handleEmailLogin} className="auth-form">
                    <label className="field-shell">
                      <span>Email address</span>
                      <div className="field-control">
                        <Mail size={16} />
                        <input
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          autoComplete="email"
                          required
                        />
                      </div>
                    </label>

                    <label className="field-shell">
                      <span>Password</span>
                      <div className="field-control">
                        <LockKeyhole size={16} />
                        <input
                          type={showPw ? 'text' : 'password'}
                          placeholder="Password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          autoComplete="current-password"
                          required
                        />
                        <button
                          type="button"
                          className="icon-btn ghost"
                          onClick={() => setShowPw(v => !v)}
                          aria-label={showPw ? 'Hide password' : 'Show password'}
                        >
                          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </label>

                    <div className="auth-form-row">
                      <span className="auth-provision-note">Provisioned accounts only</span>
                      <button type="button" className="auth-link" onClick={() => setForgotMode(true)}>
                        Forgot password?
                      </button>
                    </div>

                    <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
                      {loading ? <span className="spinner spinner-sm" /> : <ArrowRight size={15} />}
                      Continue
                    </button>
                  </form>

                  <div className="auth-divider"><span>or</span></div>

                  <button className="google-btn" onClick={handleGoogle} disabled={googleLoading} type="button">
                    {googleLoading ? <span className="spinner spinner-sm" /> : (
                      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                        <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
                      </svg>
                    )}
                    Continue with Google
                  </button>
                </>
              )}
            </div>
          </aside>
        </section>

        <section className="product-preview-section" id="preview">
          <div className="platform-window">
            <div className="platform-window-top">
              <div>
                <div className="preview-eyebrow">Live operations</div>
                <div className="preview-title">Support queue command center</div>
              </div>
              <div className="preview-status"><span /> SLA risk watched</div>
            </div>
            <div className="platform-grid">
              <div className="preview-queue">
                {['VPN access blocked', 'Billing export failed', 'Laptop thermal alert'].map((title, index) => (
                  <div className={`preview-ticket ${index === 0 ? 'active critical' : ''}`} key={title}>
                    <div>
                      <strong>{title}</strong>
                      <span>{index === 0 ? '8m to breach' : index === 1 ? '42m left' : '2h left'}</span>
                    </div>
                    <span className={index === 0 ? 'risk-dot critical' : 'risk-dot'} />
                  </div>
                ))}
              </div>
              <div className="preview-conversation">
                <div className="preview-message incoming">I cannot connect to the VPN and payroll closes in 20 minutes.</div>
                <div className="preview-activity"><Bot size={14} /> AI summary drafted with likely category: Network access</div>
                <div className="preview-message outgoing">I am checking your access policy now. I will keep this ticket inside the SLA window.</div>
              </div>
              <div className="preview-context">
                <div className="context-mini-card">
                  <TimerReset size={16} />
                  <div><strong>08:12</strong><span>SLA remaining</span></div>
                </div>
                <div className="context-mini-card">
                  <Network size={16} />
                  <div><strong>Routed to Maya</strong><span>Skill match 97</span></div>
                </div>
                <div className="preview-resolution">
                  <CheckCircle2 size={15} />
                  Suggested response ready
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="workflow-section" id="workflow">
          <div className="marketing-section-copy">
            <span className="section-kicker">Workflow clarity</span>
            <h2>Every role gets the workspace it needs.</h2>
            <p>Employees submit requests, agents work queues, managers monitor health, and super admins govern the platform from a system control surface.</p>
          </div>
          <div className="workflow-card-grid">
            {workflowItems.map(item => {
              const Icon = item.icon
              return (
                <div className="workflow-card" key={item.label}>
                  <Icon size={18} />
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="lifecycle-section">
          <div className="marketing-section-copy">
            <span className="section-kicker">Ticket lifecycle</span>
            <h2>From intake to resolution without losing context.</h2>
          </div>
          <div className="lifecycle-rail">
            {lifecycle.map((step, index) => (
              <div className="lifecycle-node" key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="analytics-section" id="analytics">
          <div className="analytics-panel">
            <div className="marketing-section-copy">
              <span className="section-kicker">SLA intelligence</span>
              <h2>Urgency is visible before it becomes a breach.</h2>
              <p>Risk signals, assignment quality, workload, and response health stay close to the work so leaders can act early.</p>
            </div>
            <div className="analytics-bars" aria-label="Analytics preview">
              {[92, 76, 64, 88, 71, 96, 82].map((value, index) => (
                <span key={index} style={{ height: `${value}%` }} />
              ))}
            </div>
          </div>
        </section>

        <section className="testimonial-section" id="enterprise">
          <div className="testimonial-card">
            <Building2 size={20} />
            <p>"TicketFlow gives our support floor the same calm precision we expect from our engineering tools."</p>
            <span>VP Operations, enterprise IT services</span>
          </div>
          <div className="enterprise-trust">
            <span>SSO-ready</span>
            <span>Audit trails</span>
            <span>Role governance</span>
            <span>Realtime queues</span>
          </div>
        </section>
      </main>
    </div>
  )
}
