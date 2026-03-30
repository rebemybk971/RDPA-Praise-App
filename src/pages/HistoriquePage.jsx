import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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

export default function HistoriquePage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('cultes')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: rows } = await supabase
      .from('evenement_chants')
      .select('*, chants(titre, categorie), evenements(nom, date, lead)')
      .order('created_at', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }

  const filtered = data.filter(r =>
    r.chants?.titre?.toLowerCase().includes(search.toLowerCase()) ||
    r.evenements?.nom?.toLowerCase().includes(search.toLowerCase())
  )

  // Group by event for "cultes" tab
  const grouped = filtered.reduce((acc, row) => {
    const evId = row.evenement_id
    if (!acc[evId]) acc[evId] = { event: row.evenements, songs: [] }
    acc[evId].songs.push(row)
    return acc
  }, {})

  // Frequency for "fréquence" tab
  const freq = Object.values(
    filtered.reduce((acc, row) => {
      const titre = row.chants?.titre
      if (!titre) return acc
      if (!acc[titre]) acc[titre] = { titre, cat: row.chants?.categorie, count: 0 }
      acc[titre].count++
      return acc
    }, {})
  ).sort((a, b) => b.count - a.count)

  const maxFreq = freq[0]?.count || 1

  if (loading) return <div className="loading">Chargement…</div>

  return (
    <>
      {/* Search */}
      <div className="search-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" />
        {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-ter)', fontSize: '1rem' }}>✕</button>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {['cultes', 'fréquence', 'solistes'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, background: 'none', border: 'none', padding: '10px 4px',
            cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '0.82rem',
            color: tab === t ? 'var(--bleu-principal)' : 'var(--texte-sec)',
            borderBottom: tab === t ? '2px solid var(--bleu-principal)' : '2px solid transparent',
            fontWeight: tab === t ? 500 : 300, textTransform: 'capitalize', transition: 'all 0.2s',
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {/* Tab: Cultes */}
      {tab === 'cultes' && (
        Object.keys(grouped).length === 0 ? (
          <div className="empty-state"><div className="emoji">📅</div><p>Aucun historique pour l'instant.</p></div>
        ) : (
          Object.values(grouped).map((group, gi) => (
            <div key={gi} style={{ marginBottom: 24 }}>
              {/* Event header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
                <p style={{ fontFamily: 'var(--font-title)', fontSize: '0.95rem', fontWeight: 600, color: 'var(--texte)' }}>{group.event?.nom}</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--texte-ter)' }}>
                  {group.event?.date && new Date(group.event.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
              {/* Songs in event */}
              {group.songs.map((row, si) => (
                <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--texte-ter)', minWidth: 18 }}>{si + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--texte)', fontFamily: 'var(--font-title)', fontSize: '0.95rem' }}>{row.chants?.titre}</span>
                  {row.tonalite_jour && <span style={{ fontSize: '0.75rem', color: 'var(--bleu-principal)', fontWeight: 500 }}>{row.tonalite_jour}</span>}
                  {row.chants?.categorie && <span className="cat-badge" style={{ ...catStyle(row.chants.categorie), fontSize: '0.62rem', padding: '2px 7px' }}>{row.chants.categorie}</span>}
                </div>
              ))}
            </div>
          ))
        )
      )}

      {/* Tab: Fréquence */}
      {tab === 'fréquence' && (
        freq.length === 0 ? (
          <div className="empty-state"><div className="emoji">📊</div><p>Aucune donnée de fréquence.</p></div>
        ) : (
          freq.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--texte-ter)', minWidth: 24, textAlign: 'right' }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'var(--font-title)', fontSize: '0.95rem', color: 'var(--texte)', marginBottom: 4 }}>{item.titre}</p>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(item.count / maxFreq) * 100}%`, background: 'var(--bleu-principal)', borderRadius: 2, transition: 'width 0.5s ease' }} />
                </div>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--texte-sec)', minWidth: 30, textAlign: 'right' }}>{item.count}×</span>
            </div>
          ))
        )
      )}

      {/* Tab: Solistes */}
      {tab === 'solistes' && (
        <div className="empty-state"><div className="emoji">🎤</div><p>Données des solistes disponibles dès que des leads sont renseignés dans les événements.</p></div>
      )}
    </>
  )
}
