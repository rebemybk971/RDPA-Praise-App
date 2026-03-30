import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const ROLES = { admin: 'Admin', editeur: 'Éditeur', lecteur: 'Lecteur' }
const ROLE_COLORS = {
  admin:   { background: 'rgba(75,191,232,0.15)', color: '#1A7BAF' },
  editeur: { background: 'rgba(59,109,17,0.12)', color: '#3B6D11' },
  lecteur: { background: 'var(--perle)', color: 'var(--texte-sec)' },
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

  function toast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2500) }

  const canManage = profile?.role === 'admin' || profile?.role === 'editeur'
  const canDeactivate = profile?.role === 'admin'

  const visible = membres.filter(m => showInactifs ? !m.actif : m.actif !== false)

  async function toggleActive(m) {
    await supabase.from('membres').update({ actif: !m.actif }).eq('id', m.id)
    fetchMembres()
    toast(m.actif ? `${m.nom} désactivé` : `${m.nom} réactivé`)
  }

  if (loading) return <div className="loading">Chargement…</div>

  return (
    <>
      {toastMsg && <div className="toast">{toastMsg}</div>}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onSaved={() => { setShowInvite(false); toast('Invitation envoyée !') }} />}

      {/* Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--texte-ter)' }}>{visible.length} membre{visible.length !== 1 ? 's' : ''}</p>
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
          <div key={m.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Avatar */}
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bleu-ciel)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: 'var(--bleu-profond)', fontWeight: 600, flexShrink: 0 }}>
              {(m.nom || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 500, fontSize: '0.9rem', color: 'var(--texte)' }}>{m.nom}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--texte-sec)', marginTop: 1 }}>{m.email}</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <span style={{ fontSize: '0.7rem', padding: '3px 9px', borderRadius: 10, ...ROLE_COLORS[m.role] }}>{ROLES[m.role] || m.role}</span>
              {canDeactivate && m.id !== profile?.id && (
                <button
                  onClick={() => toggleActive(m)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.68rem', color: m.actif !== false ? '#e05a2b' : 'var(--bleu-principal)', fontFamily: 'var(--font-ui)', padding: 0 }}
                >
                  {m.actif !== false ? 'Désactiver' : 'Réactiver'}
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {canManage && (
        <button className="fab" onClick={() => setShowInvite(true)}>＋</button>
      )}
    </>
  )
}

function InviteModal({ onClose, onSaved }) {
  const [email, setEmail] = useState('')
  const [nom, setNom] = useState('')
  const [role, setRole] = useState('lecteur')
  const [saving, setSaving] = useState(false)

  async function invite() {
    if (!email.trim() || !nom.trim()) return
    setSaving(true)
    // Create member record (auth account created separately when they sign up)
    const { error } = await supabase.from('membres').insert([{ nom, email, role, actif: true }])
    setSaving(false)
    if (!error) onSaved()
    else alert('Erreur : ' + error.message)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 430, margin: '0 auto' }}>
        <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 20px' }} />
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', marginBottom: 16 }}>Inviter un membre</h3>

        <div className="form-group">
          <label className="form-label">Nom</label>
          <input className="form-input" value={nom} onChange={e => setNom(e.target.value)} placeholder="Prénom Nom" />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="membre@email.com" />
        </div>
        <div className="form-group">
          <label className="form-label">Rôle</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(ROLES).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setRole(k)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: '0.8rem',
                background: role === k ? 'var(--bleu-principal)' : 'var(--card)',
                color: role === k ? '#fff' : 'var(--texte)',
              }}>{v}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={invite} disabled={saving || !email.trim() || !nom.trim()}>
            {saving ? 'Invitation…' : 'Inviter'}
          </button>
        </div>
      </div>
    </div>
  )
}
