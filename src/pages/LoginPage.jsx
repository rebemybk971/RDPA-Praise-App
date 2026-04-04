import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function InscriptionPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [step, setStep] = useState('verification') // verification | formulaire | succes | erreur
  const [invitation, setInvitation] = useState(null)
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')

  useEffect(() => { verifierToken() }, [])

  async function verifierToken() {
    if (!token) { setStep('erreur'); setErreur('Lien invalide.'); return }
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single()
    if (error || !data) { setStep('erreur'); setErreur('Ce lien est invalide ou a déjà été utilisé.'); return }
    if (new Date(data.expires_at) < new Date()) { setStep('erreur'); setErreur('Ce lien a expiré. Demande un nouveau lien à un administrateur.'); return }
    if (data.used_at) { setStep('erreur'); setErreur('Ce lien a déjà été utilisé.'); return }
    setInvitation(data)
    setStep('formulaire')
  }

  async function creerCompte() {
    if (!nom.trim() || !email.trim() || password.length < 6) return
    setSaving(true)
    setErreur('')

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })

    if (authError) {
      setSaving(false)
      setErreur(authError.message === 'User already registered'
        ? 'Cet email est déjà utilisé.'
        : 'Erreur : ' + authError.message)
      return
    }

    const userId = authData.user?.id
    if (userId) {
      await supabase.from('membres').insert({
        id: userId,
        nom: nom.trim(),
        email: email.trim(),
        role: invitation.role,
        actif: true,
      })
      await supabase.from('invitations').update({ used_at: new Date().toISOString() }).eq('token', token)
    }

    setSaving(false)
    setStep('succes')
  }

  async function retourConnexion() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const ROLES = { admin: 'Admin', editeur: 'Éditeur', lecteur: 'Lecteur' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--fond)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>💎</div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '1.6rem', color: 'var(--bleu-principal)', marginBottom: 4 }}>Louange RDPA</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--texte-sec)' }}>Révélation Du Premier Amour</p>
        </div>

        {step === 'verification' && (
          <div style={{ textAlign: 'center', color: 'var(--texte-sec)' }}>
            <div className="loading">Vérification du lien…</div>
          </div>
        )}

        {step === 'erreur' && (
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠️</div>
            <p style={{ color: 'var(--texte)', fontWeight: 500, marginBottom: 8 }}>Lien invalide</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--texte-sec)', marginBottom: 20 }}>{erreur}</p>
            <button onClick={retourConnexion} className="btn btn-primary" style={{ width: '100%' }}>
              Retour à la connexion
            </button>
          </div>
        )}

        {step === 'formulaire' && (
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', marginBottom: 4 }}>Créer ton compte</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--texte-sec)', marginBottom: 20 }}>
              Tu rejoins l'équipe en tant que <strong>{ROLES[invitation?.role]}</strong>
            </p>

            <div className="form-group">
              <label className="form-label">Ton prénom et nom</label>
              <input className="form-input" value={nom} onChange={e => setNom(e.target.value)} placeholder="Prénom Nom" autoFocus />
            </div>

            <div className="form-group">
              <label className="form-label">Ton email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ton@email.com" />
            </div>

            <div className="form-group">
              <label className="form-label">Choisis un mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="6 caractères minimum"
                  style={{ paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--texte-sec)' }}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {password.length > 0 && password.length < 6 && (
                <p style={{ fontSize: '0.72rem', color: '#e05a2b', marginTop: 4 }}>Minimum 6 caractères</p>
              )}
            </div>

            {erreur && (
              <p style={{ fontSize: '0.8rem', color: '#e05a2b', marginBottom: 12, textAlign: 'center' }}>{erreur}</p>
            )}

            <button
              className="btn btn-primary btn-full"
              onClick={creerCompte}
              disabled={saving || !nom.trim() || !email.trim() || password.length < 6}
              style={{ marginTop: 8 }}
            >
              {saving ? 'Création en cours…' : '✓ Créer mon compte'}
            </button>
          </div>
        )}

        {step === 'succes' && (
          <div style={{ background: 'var(--card)', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', marginBottom: 8 }}>Bienvenue dans l'équipe !</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--texte-sec)', marginBottom: 24 }}>
              Ton compte a été créé. Tu peux maintenant te connecter à l'app.
            </p>
            <button onClick={retourConnexion} className="btn btn-primary" style={{ width: '100%' }}>
              Se connecter
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
