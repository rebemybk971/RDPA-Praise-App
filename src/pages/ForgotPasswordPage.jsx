import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'

export default function ForgotPasswordPage({ onBack }) {
  const { cycleTheme, icon } = useTheme()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://rdpa-praises-app.vercel.app/reset-password'
    })
    if (error) {
      setError('Une erreur est survenue. Vérifiez votre email.')
      setLoading(false)
    } else {
      setSent(true)
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
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔑</div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '2rem', color: 'var(--texte)', marginBottom: 4 }}>
            Mot de passe <em style={{ color: 'var(--bleu-principal)', fontStyle: 'italic' }}>oublié</em>
          </h1>
          <p style={{ color: 'var(--texte-sec)', fontSize: '0.85rem' }}>
            {sent ? 'Email envoyé ! Vérifiez votre boîte mail.' : 'Entrez votre email pour recevoir un lien de réinitialisation.'}
          </p>
        </div>

        {!sent ? (
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

            {error && (
              <p style={{ color: '#e05a2b', fontSize: '0.85rem', marginBottom: 12, textAlign: 'center' }}>{error}</p>
            )}

            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? 'Envoi…' : 'Envoyer le lien'}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>📬</div>
            <p style={{ color: 'var(--texte-sec)', fontSize: '0.9rem', marginBottom: 24 }}>
              Un lien vous a été envoyé à <strong>{email}</strong>. Cliquez dessus pour choisir un nouveau mot de passe.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onBack}
          style={{ marginTop: 24, background: 'none', border: 'none', color: 'var(--bleu-principal)', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          ← Retour à la connexion
        </button>
      </div>
    </div>
  )
}
