import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'

export default function ResetPasswordPage() {
  const { cycleTheme, icon } = useTheme()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('Une erreur est survenue. Réessayez.')
      setLoading(false)
    } else {
      setDone(true)
      setLoading(false)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--blanc)', maxWidth: 430, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 20px' }}>
        <button className="theme-btn" onClick={cycleTheme}>{icon}</button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔐</div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', color: 'var(--texte)', marginBottom: 4 }}>
            Nouveau <em style={{ color: 'var(--bleu-principal)', fontStyle: 'italic' }}>mot de passe</em>
          </h1>
          <p style={{ color: 'var(--texte-sec)', fontSize: '0.85rem' }}>
            {done ? 'Mot de passe mis à jour !' : 'Choisissez un nouveau mot de passe.'}
          </p>
        </div>

        {!done ? (
          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <div className="form-group">
              <label className="form-label">Nouveau mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--texte-sec)', padding: 4 }}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirmer le mot de passe</label>
              <input
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p style={{ color: '#e05a2b', fontSize: '0.85rem', marginBottom: 12, textAlign: 'center' }}>{error}</p>
            )}

            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? 'Mise à jour…' : 'Mettre à jour'}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>✅</div>
            <p style={{ color: 'var(--texte-sec)', fontSize: '0.9rem', marginBottom: 24 }}>
              Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.
            </p>
            <a href="/login" className="btn btn-primary" style={{ display: 'inline-block' }}>
              Se connecter
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
