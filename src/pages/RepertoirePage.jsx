import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const DEFAULT_CATS = {
  Adoration: { bg: '#E0F4FC', tx: '#1A7BAF' },
  Louange:   { bg: '#EAF3DE', tx: '#3B6D11' },
  Combat:    { bg: '#FEF0E6', tx: '#A0521A' },
  Victoire:  { bg: '#EAF4FA', tx: '#1A5E8A' },
  Parvis:    { bg: '#FDF5E6', tx: '#7A5A1A' },
}

const COLOR_OPTIONS = [
  { bg: '#E0F4FC', tx: '#1A7BAF' },
  { bg: '#EAF3DE', tx: '#3B6D11' },
  { bg: '#FEF0E6', tx: '#A0521A' },
  { bg: '#EAF4FA', tx: '#1A5E8A' },
  { bg: '#FDF5E6', tx: '#7A5A1A' },
  { bg: '#F3E8FF', tx: '#7C3AED' },
  { bg: '#FFE8E8', tx: '#B91C1C' },
  { bg: '#E8FFF0', tx: '#15803D' },
]

function catStyle(cat, catMap) {
  const k = (cat || '').toLowerCase()
  const found = Object.entries(catMap).find(([name]) => name.toLowerCase() === k)
  if (found) return { background: found[1].bg, color: found[1].tx }
  return { background: 'var(--perle)', color: 'var(--texte-sec)' }
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
  const [catMap, setCatMap] = useState(DEFAULT_CATS)
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState(COLOR_OPTIONS[5])
  const [savingCat, setSavingCat] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchSongs()
    fetchCategories()
  }, [])

  async function fetchSongs() {
    const { data } = await supabase.from('chants').select('*').order('titre')
    setSongs(data || [])
    setLoading(false)
  }

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('*')
    if (data && data.length > 0) {
      const map = {}
      data.forEach(c => { map[c.nom] = { bg: c.couleur_fond, tx: c.couleur_texte } })
      setCatMap(map)
    }
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) return
    setSavingCat(true)
    const { error } = await supabase.from('categories').insert({
      nom: newCatName.trim(),
      couleur_fond: newCatColor.bg,
      couleur_texte: newCatColor.tx,
    })
    if (!error) {
      setCatMap(prev => ({ ...prev, [newCatName.trim()]: newCatColor }))
      setNewCatName('')
      setNewCatColor(COLOR_OPTIONS[5])
      setShowNewCat(false)
    }
    setSavingCat(false)
  }

  const categories = ['Tous', ...Object.keys(catMap)]

  const filtered = songs.filter(s => {
    const matchSearch = s.titre?.toLowerCase().includes(search.toLowerCase()) ||
                        s.paroles?.toLowerCase().includes(search.toLowerCase())
    const matchCat = activecat === 'Tous' || s.categorie?.toLowerCase() === activecat.toLowerCase()
    return matchSearch && matchCat
  })

  return (
    <>
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

<div className="chips" style={{ flexWrap: 'nowrap', overflowX: 'auto', gap: 6, paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>        {categories.map(cat => (
          <button
            key={cat}
            className={`chip${activecat === cat ? ' active' : ''}`}
            style={cat !== 'Tous' ? catStyle(cat, catMap) : {
              background: activecat === cat ? 'var(--bleu-principal)' : 'var(--card)',
              color: activecat === cat ? '#fff' : 'var(--texte-sec)',
              border: '1px solid var(--border)'
            }}
            onClick={() => setActivecat(cat)}
          >
            {cat}
          </button>
        ))}
        <button
          onClick={() => setShowNewCat(v => !v)}
          style={{
            background: 'none',
            border: '1.5px dashed var(--bleu-principal)',
            color: 'var(--bleu-principal)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: '0.82rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          + catégorie
        </button>
      </div>

      {showNewCat && (
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <input
            autoFocus
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="Nom de la catégorie…"
            style={{
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: '0.9rem',
              background: 'var(--fond)',
              color: 'var(--texte)',
            }}
            onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--texte-sec)' }}>Couleur :</span>
            {COLOR_OPTIONS.map((c, i) => (
              <button
                key={i}
                onClick={() => setNewCatColor(c)}
                style={{
                  width: 24, height: 24,
                  borderRadius: '50%',
                  background: c.bg,
                  border: newCatColor === c ? `2.5px solid ${c.tx}` : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          {newCatName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--texte-sec)' }}>Aperçu :</span>
              <span style={{
                background: newCatColor.bg,
                color: newCatColor.tx,
                borderRadius: 20,
                padding: '3px 12px',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}>{newCatName}</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAddCategory}
              disabled={!newCatName.trim() || savingCat}
              style={{
                background: 'var(--bleu-principal)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {savingCat ? 'Enregistrement…' : 'Créer'}
            </button>
            <button
              onClick={() => { setShowNewCat(false); setNewCatName('') }}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                color: 'var(--texte-sec)',
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      <p style={{ fontSize: '0.78rem', color: 'var(--texte-ter)', marginBottom: 12 }}>
        {filtered.length} chant{filtered.length !== 1 ? 's' : ''}
      </p>

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
              <span className="cat-badge" style={catStyle(song.categorie, catMap)}>{song.categorie}</span>
            )}
          </Link>
        ))
      )}

      <button className="fab" onClick={() => navigate('/repertoire/ajouter')}>＋</button>
    </>
  )
}
