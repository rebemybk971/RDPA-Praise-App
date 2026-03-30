import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

const PUPITRES = ['Soprano', 'Alto', 'Ténor', 'Basse', 'Clavier', 'Guitare', 'Batterie']

export default function SongDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [song, setSong] = useState(null)
  const [tab, setTab] = useState('paroles')
  const [historique, setHistorique] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSong()
    fetchHistorique()
  }, [id])

  async function fetchSong() {
    const { data } = await supabase.from('chants').select('*').eq('id', id).single()
    setSong(data)
    setLoading(false)
  }

  async function fetchHistorique() {
    const { data } = await supabase
      .from('evenement_chants')
      .select('*, evenements(nom, date, lead)')
      .eq('chant_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
    setHistorique(data || [])
  }

  async function deleteSong() {
    if (!confirm('Supprimer ce chant définitivement ?')) return
    await supabase.from('chants').delete().eq('id', id)
    navigate('/repertoire')
  }

  if (loading) return <div className="loading">Chargement…</div>
  if (!song) return <div className="empty-state"><p>Chant introuvable.</p></div>

  const canEdit = profile?.role === 'admin' || profile?.role === 'editeur'
  const canDelete = profile?.role === 'admin'

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-sec)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-ui)', fontSize: '0.85rem' }}>
          ← Retour
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.6rem', fontWeight: 600, color: 'var(--texte)', lineHeight: 1.2 }}>{song.titre}</h2>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {song.categorie && <span className="cat-badge" style={catStyle(song.categorie)}>{song.categorie}</span>}
              {song.tonalite && <span style={{ fontSize: '0.8rem', color: 'var(--texte-sec)' }}>🎵 {song.tonalite}</span>}
              {song.bpm && <span style={{ fontSize: '0.8rem', color: 'var(--texte-sec)' }}>⏱ {song.bpm} BPM</span>}
            </div>
          </div>
          {canEdit && (
            <button
              onClick={() => navigate(`/repertoire/${id}/modifier`)}
              style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--texte-sec)', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' }}
            >
              ✏️ Modifier
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {['paroles', 'pupitres', 'historique'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, background: 'none', border: 'none', padding: '10px 4px',
              cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '0.85rem',
              color: tab === t ? 'var(--bleu-principal)' : 'var(--texte-sec)',
              borderBottom: tab === t ? '2px solid var(--bleu-principal)' : '2px solid transparent',
              fontWeight: tab === t ? 500 : 300, textTransform: 'capitalize',
              transition: 'all 0.2s',
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'paroles' && (
        <div>
          {song.accords && (
            <div className="card" style={{ marginBottom: 16 }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--texte-ter)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accords</p>
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--texte)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{song.accords}</pre>
            </div>
          )}
          {song.paroles ? (
            <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', lineHeight: 2, color: 'var(--texte)', whiteSpace: 'pre-wrap' }}>
              {song.paroles}
            </div>
          ) : (
            <div className="empty-state">
              <div className="emoji">📄</div>
              <p>Aucune parole enregistrée.<br/>Appuyez sur ✏️ Modifier pour en ajouter.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'pupitres' && (
        <div>
          {PUPITRES.map(p => {
            const key = p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            const url = song[`pupitre_${key}`]
            return (
              <div key={p} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{p}</span>
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--bleu-principal)', textDecoration: 'none' }}>
                    ✓ Écouter →
                  </a>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--texte-ter)' }}>— vide</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'historique' && (
        <div>
          {historique.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">📅</div>
              <p>Ce chant n'a pas encore été utilisé dans un événement.</p>
            </div>
          ) : (
            historique.map((h, i) => (
              <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 500, fontSize: '0.9rem' }}>{h.evenements?.nom}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--texte-sec)', marginTop: 2 }}>
                    {h.evenements?.date && new Date(h.evenements.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {h.evenements?.lead && ` · ${h.evenements.lead}`}
                  </p>
                </div>
                {h.tonalite_jour && <span style={{ fontSize: '0.85rem', color: 'var(--bleu-principal)', fontWeight: 500 }}>{h.tonalite_jour}</span>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Delete */}
      {canDelete && (
        <button
          onClick={deleteSong}
          style={{ marginTop: 32, background: 'none', border: '1px solid #e05a2b', color: '#e05a2b', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '0.85rem', display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
        >
          Supprimer ce chant
        </button>
      )}
    </>
  )
}
