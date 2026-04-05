import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setErreur('')
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      setErreur('Email ou mot de passe incorrect.')
      setLoading(false)
    } else {
      navigate('/repertoire')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--fond)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>💎</div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '1.6rem', color: 'var(--bleu-principal)', marginBottom: 4 }}>Louange RDPA</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--texte-sec)' }}>Révélation Du Premier Amour</p>
        </div>

        <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', marginBottom: 20, textAlign: 'center' }}>Connexion</h2>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ton@email.com"
                autoFocus
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
                  placeholder="Ton mot de passe"
                  style={{ paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--texte-sec)' }}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {erreur && (
              <p style={{ fontSize: '0.8rem', color: '#e05a2b', marginBottom: 12, textAlign: 'center' }}>{erreur}</p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading || !email.trim() || !password}
              style={{ marginTop: 8 }}
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--bleu-principal)' }}>
              Mot de passe oublié ?
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
