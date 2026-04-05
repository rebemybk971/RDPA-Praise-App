import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function InscriptionPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [invitationValide, setInvitationValide] = useState(false)
  const [invitationData, setInvitationData] = useState(null)
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    async function verifierInvitation() {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', token)
        .eq('utilise', false)
        .gt('expire_le', new Date().toISOString())
        .single()
      if (error || !data) {
        setError("Ce lien d'invitation est invalide ou expiré.")
      } else {
        setInvitationValide(true)
        setInvitationData(data)
        if (data.email) setEmail(data.email)
      }
    }
    verifierInvitation()
  }, [token])

  async function handleInscription(e) {
    e.preventDefault()
    if (!nom.trim()) { setError('Veuillez entrer votre nom.'); return }
    if (!email.trim()) { setError('Veuillez entrer votre email.'); return }
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    setLoading(true)
    setError('')
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      if (authError) throw authError
      const { error: membreError } = await supabase.from('membres').insert({
        id: authData.user.id,
        nom: nom.trim(),
        email: email.trim(),
        role: invitationData.role || 'lecteur',
        actif: true,
      })
      if (membreError) throw membreError
      await supabase.from('invitations').update({ utilise: true }).eq('token', token)
      navigate('/repertoire')
    } catch (err) {
      setError(err.message || "Une erreur est survenue.")
    } finally {
      setLoading(false)
    }
  }

  if (!token || (!invitationValide && !error)) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Vérification du lien…</div>
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 24
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: 'var(--surface)',
        borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{
          fontFamily: 'var(--font-title)', fontSize: '1.6rem',
          color: 'var(--bleu-principal)', marginBottom: 8, textAlign: 'center'
        }}>
          Rejoindre RDPA
        </h2>

        {error ? (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <div style={{
              background: '#fee', color: '#c00', borderRadius: 8,
              padding: '12px 16px', marginBottom: 16
            }}>
              {error}
            </div>
            <button
              onClick={() => {
                console.log('CLIC BOUTON RETOUR')
                navigate('/login')
              }}
              style={{
                background: 'var(--bleu-principal)', color: '#fff',
                border: 'none', borderRadius: 8,
                padding: '12px 24px', fontSize: '1rem',
                cursor: 'pointer', width: '100%'
              }}
            >
              Retour à la connexion
            </button>
          </div>
        ) : (
          <form onSubmit={handleInscription}>
            <p style={{ color: 'var(--texte-sec)', fontSize: '0.9rem', textAlign: 'center', marginBottom: 24 }}>
              Créez votre compte pour rejoindre l'équipe
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--texte-sec)', marginBottom: 6 }}>
                Votre nom
              </label>
              <input
                type="text"
                value={nom}
                onChange={e => setNom(e.target.value)}
                placeholder="Ex : Marie Dupont"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--texte)', fontSize: '1rem', boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--texte-sec)', marginBottom: 6 }}>
                Votre email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Ex : marie@email.com"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 10,
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--texte)', fontSize: '1rem', boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: 24, position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--texte-sec)', marginBottom: 6 }}>
                Mot de passe
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 caractères"
                style={{
                  width: '100%', padding: '12px 44px 12px 14px', borderRadius: 10,
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--texte)', fontSize: '1rem', boxSizing: 'border-box'
                }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                position: 'absolute', right: 12, top: 36,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--texte-sec)', fontSize: '1.1rem'
              }}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {error && (
              <div style={{ color: '#c00', fontSize: '0.85rem', marginBottom: 12 }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px', borderRadius: 10,
              background: 'var(--bleu-principal)', color: '#fff',
              border: 'none', fontSize: '1rem', fontWeight: 600, cursor: 'pointer'
            }}>
              {loading ? 'Création du compte…' : 'Créer mon compte'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
