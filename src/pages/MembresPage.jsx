import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const ROLES = { admin: 'Admin', editeur: 'Éditeur', lecteur: 'Lecteur' }
const ROLE_COLORS = {
  admin:   { background: 'rgba(75,191,232,0.15)', color: '#1A7BAF' },
  editeur: { background: 'rgba(59,109,17,0.12)',  color: '#3B6D11' },
  lecteur: { background: 'var(--perle)',           color: 'var(--texte-sec)' },
}

function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function MembresPage() {
  const { profile } = useAuth()
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInactifs, setShowInactifs] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => { fetchMembres() }, [])

  async function fetchMembres() {
    const { data } = await supabase.from('membres').select('*').order('nom')
    setMembres(data || [])
    setLoading(false)
  }

  function toast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000) }

  const isAdmin = profile?.role === 'admin'
  const visible = membres.filter(m => showInactifs ? m.actif === false : m.actif !== false)

  async function toggleActive(m) {
    const newRole = m.actif === false ? 'lecteur' : m.role
    await supabase.from('membres').update({ actif: !m.actif, role: newRole }).eq('id', m.id)
    fetchMembres()
    toast(m.actif !== false ? `${m.nom} désactivé` : `${m.nom} réactivé en Lecteur`)
  }

  async function changeRole(m, newRole) {
    await supabase.from('membres').update({ role: newRole }).eq('id', m.id)
    fetchMembres()
    toast(`Rôle de ${m.nom} mis à jour`)
  }

  if (loading) return <div className="loading">Chargement…</div>

  return (
    <>
      {toastMsg && <div className="toast">{toastMsg}</div>}
      {showInvite && (
        <InviteModal
          currentUserId={profile?.id}
          onClose={() => setShowInvite(false)}
          onSaved={(msg) => { setShowInvite(false); toast(msg) }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--texte-ter)' }}>
          {visible.length} membre{visible.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowInactifs(s => !s)}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: '0.75rem', color: showInactifs ? 'var(--bleu-principal)' : 'var(--texte-sec)', fontFamily: 'var(--font-ui)' }}
        >
          {showInactifs ? '← Actifs' : 'Inactifs'}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">👥</div>
          <p>{showInactifs ? 'Aucun membre inactif.' : 'Aucun membre pour l\'instant.'}</p>
        </div>
      ) : (
        visible.map(m => (
          <div key={m.id} className="card" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bleu-ciel)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: 'var(--bleu-profond)', fontWeight: 600, flexShrink: 0 }}>
                {(m.nom || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--texte)' }}>{m.nom}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--texte-sec)', marginTop: 1 }}>{m.email || 'Sans email'}</p>
              </div>
              <span style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: 10, flexShrink: 0, ...ROLE_COLORS[m.role] }}>
                {ROLES[m.role] || m.role}
              </span>
            </div>

            {isAdmin && m.id !== profile?.id && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <select
                  value={m.role}
                  onChange={e => changeRole(m, e.target.value)}
                  style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', fontSize: '0.78rem', background: 'var(--fond)', color: 'var(--texte)', fontFamily: 'var(--font-ui)', cursor: 'pointer' }}
                >
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button
                  onClick={() => toggleActive(m)}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: '0.75rem', color: m.actif !== false ? '#e05a2b' : 'var(--bleu-principal)', fontFamily: 'var(--font-ui)' }}
                >
                  {m.actif !== false ? 'Désactiver' : 'Réactiver'}
                </button>
              </div>
            )}
          </div>
        ))
      )}

      {isAdmin && (
        <button className="fab" onClick={() => setShowInvite(true)}>＋</button>
      )}
    </>
  )
}

function InviteModal({ currentUserId, onClose, onSaved }) {
  const [role, setRole] = useState('lecteur')
  const [generating, setGenerating] = useState(false)
  const [lien, setLien] = useState('')
  const [copied, setCopied] = useState(false)

  async function genererLien() {
    setGenerating(true)
    const token = generateToken()
    cons expireLe = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
const { error } = await supabase.from('invitations').insert({
  token,
  role,
  expire_le: expireLe,
  created_by: currentUserId,
    })
    setGenerating(false)
    if (error) { alert('Erreur : ' + error.message); return }
    setLien(`${window.location.origin}/inscription?token=${token}`)
  }

  function copier() {
    navigator.clipboard.writeText(lien)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function envoyerWhatsApp() {
    const msg = encodeURIComponent(
      `Bonjour ! Tu es invité(e) à rejoindre l'app Louange RDPA.\n\nClique sur ce lien pour créer ton compte :\n${lien}\n\n_Ce lien est valable 7 jours._`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 430, margin: '0 auto' }}>
        <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 20px' }} />
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', marginBottom: 6 }}>Inviter un membre</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--texte-sec)', marginBottom: 20 }}>
          Génère un lien d'inscription valable 7 jours à envoyer via WhatsApp.
        </p>

        {!lien ? (
          <>
            <div className="form-group">
              <label className="form-label">Rôle attribué</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {Object.entries(ROLES).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setRole(k)} style={{
                    flex: 1, padding: '8px 4px', borderRadius: 10,
                    border: '1px solid var(--border)', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontSize: '0.8rem',
                    background: role === k ? 'var(--bleu-principal)' : 'var(--card)',
                    color: role === k ? '#fff' : 'var(--texte)',
                  }}>{v}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>Annuler</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={genererLien} disabled={generating}>
                {generating ? 'Génération…' : '🔗 Générer le lien'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: 'var(--fond)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', marginBottom: 16, fontSize: '0.75rem', color: 'var(--texte-sec)', wordBreak: 'break-all', lineHeight: 1.6 }}>
              {lien}
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--texte-ter)', marginBottom: 16, textAlign: 'center' }}>
              ⏱ Ce lien expire dans 7 jours · Rôle : {ROLES[role]}
            </p>

            <button
              onClick={envoyerWhatsApp}
              style={{ width: '100%', background: '#25D366', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', marginBottom: 10, fontFamily: 'var(--font-ui)' }}
            >
              📲 Envoyer via WhatsApp
            </button>

            <button
              onClick={copier}
              style={{ width: '100%', background: 'var(--card)', color: copied ? 'var(--bleu-principal)' : 'var(--texte)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px', fontSize: '0.9rem', cursor: 'pointer', marginBottom: 10, fontFamily: 'var(--font-ui)' }}
            >
              {copied ? '✓ Lien copié !' : 'Copier le lien'}
            </button>

            <button onClick={onClose} style={{ width: '100%', background: 'none', border: 'none', color: 'var(--texte-sec)', fontSize: '0.85rem', cursor: 'pointer', padding: '8px', fontFamily: 'var(--font-ui)' }}>
              Fermer
            </button>
          </>
        )}
      </div>
    </div>
  )
}
