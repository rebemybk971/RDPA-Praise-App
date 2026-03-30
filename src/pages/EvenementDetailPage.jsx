import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

function catStyle(cat) {
  const k = (cat || '').toLowerCase()
  const map = {
    adoration: { background: 'var(--cat-adoration-bg)', color: 'var(--cat-adoration-tx)' },
    louange:   { background: 'var(--cat-louange-bg)',   color: 'var(--cat-louange-tx)' },
    combat:    { background: 'var(--cat-combat-bg)',     color: 'var(--cat-combat-tx)' },
    victoire:  { background: 'var(--cat-victoire-bg)',   color: 'var(--cat-victoire-tx)' },
    parvis:    { background: 'var(--cat-parvis-bg)',     color: 'var(--cat-parvis-tx)' },
  }
  return map[k] || { background: 'var(--perle)', color: 'var(--texte-sec)' }
}

export default function EvenementDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [event, setEvent] = useState(null)
  const [setlist, setSetlist] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddSong, setShowAddSong] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    const [{ data: ev }, { data: sl }] = await Promise.all([
      supabase.from('evenements').select('*').eq('id', id).single(),
      supabase.from('evenement_chants').select('*, chants(*)').eq('evenement_id', id).order('ordre'),
    ])
    setEvent(ev)
    setSetlist(sl || [])
    setLoading(false)
  }

  function toast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2500) }

  async function removeSong(ecId) {
    await supabase.from('evenement_chants').delete().eq('id', ecId)
    setSetlist(s => s.filter(x => x.id !== ecId))
  }

  function shareWhatsApp() {
    const lines = [
      `🎵 *${event.nom}*`,
      event.date ? `📅 ${new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}` : '',
      event.lead ? `🎤 Lead : ${event.lead}` : '',
      '',
      ...setlist.map((s, i) => `${i + 1}. ${s.chants?.titre}${s.tonalite_jour ? ` (${s.tonalite_jour})` : ''}`),
    ].filter(l => l !== undefined).join('\n')
    setShowShare(false)
    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank')
  }

  function copyShare() {
    const lines = [
      `🎵 ${event?.nom}`,
      event?.date ? `📅 ${new Date(event.date).toLocaleDateString('fr-FR')}` : '',
      event?.lead ? `🎤 ${event.lead}` : '',
      ...setlist.map((s, i) => `${i + 1}. ${s.chants?.titre}${s.tonalite_jour ? ` (${s.tonalite_jour})` : ''}`),
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(lines)
    toast('Message copié !')
    setShowShare(false)
  }

  if (loading) return <div className="loading">Chargement…</div>
  if (!event) return <div className="empty-state"><p>Événement introuvable.</p></div>

  const canEdit = profile?.role === 'admin' || profile?.role === 'editeur'

  return (
    <>
      {toastMsg && <div className="toast">{toastMsg}</div>}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-sec)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-ui)', fontSize: '0.85rem', marginBottom: 12 }}>
          ← Événements
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 600 }}>{event.nom}</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--texte-sec)', marginTop: 4 }}>
              {event.date && new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {event.lead && ` · ${event.lead}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowShare(true)} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: '1rem' }} title="Partager">📤</button>
            <button onClick={() => navigate(`/evenements/${id}/jour-j`)} style={{ background: 'var(--bleu-principal)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-ui)' }}>🎤 Jour J</button>
          </div>
        </div>
      </div>

      {/* Setlist */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--texte-ter)' }}>{setlist.length} chant{setlist.length !== 1 ? 's' : ''}</p>
      </div>

      {setlist.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🎶</div>
          <p>Aucun chant dans cette setlist.<br/>Appuyez sur ＋ pour en ajouter.</p>
        </div>
      ) : (
        setlist.map((ec, i) => (
          <div key={ec.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--texte-ter)', minWidth: 20, textAlign: 'center' }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', fontWeight: 600, color: 'var(--texte)' }}>{ec.chants?.titre}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                {ec.chants?.categorie && <span className="cat-badge" style={{ ...catStyle(ec.chants.categorie), fontSize: '0.65rem', padding: '2px 8px' }}>{ec.chants.categorie}</span>}
                {ec.tonalite_jour && <span style={{ fontSize: '0.75rem', color: 'var(--bleu-principal)', fontWeight: 500 }}>{ec.tonalite_jour}</span>}
              </div>
            </div>
            {canEdit && (
              <button onClick={() => removeSong(ec.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-ter)', fontSize: '1rem', padding: 4 }}>✕</button>
            )}
          </div>
        ))
      )}

      {canEdit && (
        <button className="fab" onClick={() => setShowAddSong(true)}>＋</button>
      )}

      {/* Add song modal */}
      {showAddSong && (
        <AddSongModal
          eventId={id}
          existingIds={setlist.map(s => s.chant_id)}
          onClose={() => setShowAddSong(false)}
          onSaved={() => { setShowAddSong(false); fetchAll() }}
          nextOrdre={setlist.length + 1}
        />
      )}

      {/* Share modal */}
      {showShare && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 430, margin: '0 auto' }}>
            <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 20px' }} />
            <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', marginBottom: 20 }}>Partager la setlist</h3>
            <button className="btn btn-full" onClick={shareWhatsApp} style={{ background: '#25D366', color: '#fff', marginBottom: 12 }}>
              📱 Partager sur WhatsApp
            </button>
            <button className="btn btn-outline btn-full" onClick={copyShare} style={{ marginBottom: 12 }}>
              📋 Copier le message
            </button>
            <button className="btn btn-outline btn-full" onClick={() => setShowShare(false)}>Annuler</button>
          </div>
        </div>
      )}
    </>
  )
}

function AddSongModal({ eventId, existingIds, onClose, onSaved, nextOrdre }) {
  const [songs, setSongs] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('chants').select('id, titre, categorie, tonalite').order('titre').then(({ data }) => {
      setSongs(data || [])
      setLoading(false)
    })
  }, [])

  async function addSong(song) {
    await supabase.from('evenement_chants').insert([{ evenement_id: eventId, chant_id: song.id, ordre: nextOrdre, tonalite_jour: song.tonalite }])
    onSaved()
  }

  const filtered = songs.filter(s => s.titre.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 430, margin: '0 auto', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', marginBottom: 14 }}>Ajouter un chant</h3>
        <div className="search-bar" style={{ marginBottom: 12 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" autoFocus />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? <div className="loading">Chargement…</div> : filtered.map(song => {
            const already = existingIds.includes(song.id)
            return (
              <div key={song.id} onClick={() => !already && addSong(song)}
                style={{ padding: '12px 4px', borderBottom: '1px solid var(--border)', cursor: already ? 'default' : 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: already ? 0.5 : 1 }}>
                <span style={{ fontFamily: 'var(--font-title)', fontSize: '1rem', color: 'var(--texte)' }}>{song.titre}</span>
                {already ? <span style={{ fontSize: '0.75rem', color: 'var(--texte-ter)' }}>✓ Déjà présent</span> : <span style={{ fontSize: '0.8rem', color: 'var(--bleu-principal)' }}>＋</span>}
              </div>
            )
          })}
        </div>
        <button className="btn btn-outline btn-full" onClick={onClose} style={{ marginTop: 12 }}>Fermer</button>
      </div>
    </div>
  )
}
