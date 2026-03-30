import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CATS = { Adoration: 'adoration', Louange: 'louange', Combat: 'combat', Victoire: 'victoire', Parvis: 'parvis' }

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

function isNew(dateStr) {
  if (!dateStr) return false
  return (Date.now() - new Date(dateStr)) < 7 * 24 * 60 * 60 * 1000
}

export default function RepertoirePage() {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activecat, setActivecat] = useState('Tous')
  const [categories, setCategories] = useState(['Tous', ...Object.keys(CATS)])
  const navigate = useNavigate()

  useEffect(() => {
    fetchSongs()
  }, [])

  async function fetchSongs() {
    const { data } = await supabase.from('chants').select('*').order('titre')
    setSongs(data || [])
    setLoading(false)
  }

  const filtered = songs.filter(s => {
    const matchSearch = s.titre?.toLowerCase().includes(search.toLowerCase()) ||
                        s.paroles?.toLowerCase().includes(search.toLowerCase())
    const matchCat = activecat === 'Tous' || s.categorie?.toLowerCase() === activecat.toLowerCase()
    return matchSearch && matchCat
  })

  return (
    <>
      {/* Search */}
      <div className="search-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un chant, des paroles…"
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-ter)', fontSize: '1rem' }}>✕</button>
        )}
      </div>

      {/* Category chips */}
      <div className="chips">
        {categories.map(cat => (
          <button
            key={cat}
            className={`chip${activecat === cat ? ' active' : ''}`}
            style={cat !== 'Tous' ? catStyle(cat) : {
              background: activecat === cat ? 'var(--bleu-principal)' : 'var(--card)',
              color: activecat === cat ? '#fff' : 'var(--texte-sec)',
              border: '1px solid var(--border)'
            }}
            onClick={() => setActivecat(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Count */}
      <p style={{ fontSize: '0.78rem', color: 'var(--texte-ter)', marginBottom: 12 }}>
        {filtered.length} chant{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* List */}
      {loading ? (
        <div className="loading">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">🎵</div>
          <p>{search ? 'Aucun chant trouvé pour cette recherche.' : 'Le répertoire est vide.\nAjoutez votre premier chant !'}</p>
        </div>
      ) : (
        filtered.map(song => (
          <Link key={song.id} to={`/repertoire/${song.id}`} className="song-row">
            <div className="song-row-info">
              <div className="song-row-title">
                {song.titre}
                {isNew(song.created_at) && <span className="badge-new">✨ Nouveau</span>}
              </div>
              <div className="song-row-meta">
                {song.tonalite && <span>{song.tonalite}</span>}
                {song.bpm && <span> · {song.bpm} BPM</span>}
                {song.lead && <span> · {song.lead}</span>}
              </div>
            </div>
            {song.categorie && (
              <span className="cat-badge" style={catStyle(song.categorie)}>{song.categorie}</span>
            )}
          </Link>
        ))
      )}

      {/* FAB add */}
      <button className="fab" onClick={() => navigate('/repertoire/ajouter')}>＋</button>
    </>
  )
}
