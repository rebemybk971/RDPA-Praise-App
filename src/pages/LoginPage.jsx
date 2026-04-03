import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import ForgotPasswordPage from './ForgotPasswordPage'

export default function LoginPage() {
  const { signIn } = useAuth()
  const { cycleTheme, icon } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgot, setShowForgot] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) { setError('Email ou mot de passe incorrect'); setLoading(false) }
  }

  if (showForgot) return <ForgotPasswordPage onBack={() => setShowForgot(false)} />

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--blanc)', maxWidth: 430, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px' }}>
        <button className="theme-btn" onClick={cycleTheme}>{icon}</button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>💎</div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', color: 'var(--texte)', marginBottom: 4 }}>
            Louange <em style={{ color: 'var(--bleu-principal)', fontStyle: 'italic' }}>RDPA</em>
          </h1>
          <p style={{ color: 'var(--texte-sec)', fontSize: '0.85rem' }}>Révélation Du Premier Amour</p>
        </div>

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--texte-sec)', padding: 4 }}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--bleu-principal)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>
              Mot de passe oublié ?
            </button>
          </div>

          {error && (
            <p style={{ color: '#e05a2b', fontSize: '0.85rem', marginBottom: 12, textAlign: 'center' }}>{error}</p>
          )}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
