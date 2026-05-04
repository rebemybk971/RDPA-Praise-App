import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'

export default function VueJourJPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { cycleTheme, icon } = useTheme()
  const { user, profile } = useAuth()
  const [event, setEvent] = useState(null)
  const [setlist, setSetlist] = useState([])
  const [annotations, setAnnotations] = useState({}) // V4 : annotations indexées par evenement_chant_id
  const [showAccords, setShowAccords] = useState(false)
  const [loading, setLoading] = useState(true)

  // V4 étape 3 : menu contextuel ouvert (un seul à la fois dans toute la page)
  // Forme : { ecId: '...', lineIdx: 0, x: 100, y: 200, mode: 'menu' | 'saisie', selectedType: '...' }
  const [contextMenu, setContextMenu] = useState(null)

  useEffect(() => { fetchAll() }, [id])

  // V1 : ajoute la classe "jour-j" sur le body pour activer le plein écran (CSS dans index.css)
  useEffect(() => {
    document.body.classList.add('jour-j')
    return () => {
      document.body.classList.remove('jour-j')
    }
  }, [])

  // V4 étape 3 : ferme le menu contextuel si on clique ailleurs
  // Correctif Bug B : on utilise mousedown au lieu de click pour éviter
  // le conflit d'événements quand on clique sur un bouton du menu
  useEffect(() => {
    if (!contextMenu) return
    function handleClickOutside(e) {
      if (!e.target.closest('[data-context-menu]')) {
        setContextMenu(null)
      }
    }
    // setTimeout pour laisser le clic d'ouverture du menu se terminer
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [contextMenu])

  async function fetchAll() {
    try {
      // Étape 1 : récupérer l'événement et la setlist
      const [{ data: ev }, { data: sl }] = await Promise.all([
        supabase.from('evenements').select('*').eq('id', id).single(),
        supabase.from('evenement_chants')
          .select('*, chants(*)')
          .eq('evenement_id', id)
          .order('ordre'),
      ])
      setEvent(ev)
      setSetlist(sl || [])

      // V4 étape 2 : récupérer les annotations pour tous les chants de la setlist
      if (sl && sl.length > 0) {
        const ecIds = sl.map(ec => ec.id)
        const { data: ann, error: annError } = await supabase
          .from('annotations')
          .select('*')
          .in('evenement_chant_id', ecIds)
          .order('created_at', { ascending: true })

        if (annError) {
          console.error('Erreur récupération annotations :', annError)
        } else {
          const annByEc = {}
          for (const a of (ann || [])) {
            if (!annByEc[a.evenement_chant_id]) annByEc[a.evenement_chant_id] = []
            annByEc[a.evenement_chant_id].push(a)
          }
          setAnnotations(annByEc)
        }
      }
    } catch (err) {
      console.error('Erreur fetchAll Vue Jour J :', err)
    } finally {
      setLoading(false)
    }
  }

  // V4 étape 3 : enregistrer une nouvelle annotation
  async function saveAnnotation(ecId, lineIdx, niveau, type, contenu) {
    if (!user || !contenu.trim()) return
    try {
      const { data, error } = await supabase
        .from('annotations')
        .insert({
          evenement_chant_id: ecId,
          ligne_index: lineIdx,
          niveau: niveau,
          type: type,
          contenu: contenu.trim(),
          auteur_id: user.id,
        })
        .select()
        .single()
      if (error) {
        console.error('Erreur enregistrement annotation :', error)
        alert('Erreur lors de l\'enregistrement : ' + error.message)
        return
      }
      // Mise à jour locale de l'état pour réaffichage immédiat
      setAnnotations(prev => {
        const next = { ...prev }
        if (!next[ecId]) next[ecId] = []
        next[ecId] = [...next[ecId], data]
        return next
      })
      setContextMenu(null)
    } catch (err) {
      console.error('Erreur saveAnnotation :', err)
      alert('Erreur réseau : ' + err.message)
    }
  }

  if (loading) return (
    <div style={{ height: '100vh', background: '#0D1820', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(228,243,250,0.55)', fontFamily: 'DM Sans, sans-serif' }}>
      Chargement…
    </div>
  )

  const night = {
    bg: '#0D1820',
    surface: '#192840',
    text: '#E4F3FA',
    textSec: 'rgba(228,243,250,0.55)',
    textTer: 'rgba(228,243,250,0.35)',
    border: 'rgba(75,191,232,0.15)',
    accent: '#4BBFE8',
  }

  // V4 étape 3 : peut-il créer des annotations d'équipe ?
  const canAnnotateTeam = profile?.role === 'admin' || profile?.role === 'editeur'

  return (
    <div style={{ minHeight: '100vh', background: night.bg, color: night.text, fontFamily: 'DM Sans, sans-serif' }}>
      <div style={{ position: 'sticky', top: 0, background: night.bg, borderBottom: `1px solid ${night.border}`, padding: '14px 20px', zIndex: 50, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: night.textSec, fontSize: '1.1rem', padding: '4px 8px 4px 0' }}>←</button>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: night.text }}>{event?.nom}</p>
          <p style={{ fontSize: '0.72rem', color: night.textSec, marginTop: 1 }}>
            {event?.date && new Date(event.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {event?.lead && ` · ${event.lead}`}
            {` · ${setlist.length} chant${setlist.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowAccords(a => !a)}
          style={{
            background: showAccords ? night.accent : night.surface,
            color: showAccords ? '#fff' : night.textSec,
            border: `1px solid ${night.border}`,
            borderRadius: 8, padding: '7px 12px',
            cursor: 'pointer', fontSize: '0.78rem',
            fontFamily: 'DM Sans, sans-serif',
            transition: 'all 0.2s',
          }}
        >
          ♩ Accords
        </button>
        <button onClick={cycleTheme} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>{icon}</button>
      </div>

      <div style={{ padding: '0 0 60px' }}>
        {setlist.map((ec, i) => (
          <SongBlock
            key={ec.id}
            ec={ec}
            index={i}
            showAccords={showAccords}
            night={night}
            songAnnotations={annotations[ec.id] || []}
            onLineLongPress={(lineIdx, x, y) => setContextMenu({ ecId: ec.id, lineIdx, x, y, mode: 'menu' })}
          />
        ))}
      </div>

      {/* V4 étape 3 : menu contextuel flottant */}
      {contextMenu && (
        <ContextMenu
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          night={night}
          canAnnotateTeam={canAnnotateTeam}
          onSave={saveAnnotation}
        />
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: night.bg, borderTop: `1px solid ${night.border}`, padding: '8px 20px', display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <LegendItem color="#A78BD9" label="Unisson" />
        <LegendItem color="#4BBFE8" label="Harmonie" />
        <LegendItem color="#B8972A" label="Modulation" />
        <LegendItem color="#E8924B" label="Rythmique" />
        <LegendItem color="#4a9a5a" label="Note libre" />
        <LegendItem color="#7a8a95" label="Note perso" />
      </div>
    </div>
  )
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.68rem', color: 'rgba(228,243,250,0.45)' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      {label}
    </div>
  )
}

// V4 étape 3 : composant menu contextuel
function ContextMenu({ contextMenu, setContextMenu, night, canAnnotateTeam, onSave }) {
  const { ecId, lineIdx, x, y, mode, selectedType, selectedNiveau } = contextMenu
  const [contenu, setContenu] = useState('')

  // 6 types disponibles + niveau associé
  const teamTypes = [
    { type: 'unisson', label: 'Unisson', color: '#A78BD9', niveau: 'equipe' },
    { type: 'harmonie', label: 'Harmonie', color: '#4BBFE8', niveau: 'equipe' },
    { type: 'modulation', label: 'Modulation', color: '#B8972A', niveau: 'equipe' },
    { type: 'rythmique', label: 'Rythmique', color: '#E8924B', niveau: 'equipe' },
    { type: 'note_libre', label: 'Note libre', color: '#4a9a5a', niveau: 'equipe' },
  ]
  const persoType = { type: 'perso', label: 'Note pour moi', color: '#7a8a95', niveau: 'perso' }

  // Position : on s'assure que le menu reste visible à l'écran
  const menuStyle = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 220),
    top: Math.min(y, window.innerHeight - 320),
    background: night.surface,
    border: `1px solid ${night.border}`,
    borderRadius: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    padding: 8,
    zIndex: 100,
    minWidth: 200,
    fontFamily: 'DM Sans, sans-serif',
  }

  if (mode === 'saisie') {
    const selected = [...teamTypes, persoType].find(t => t.type === selectedType)
    return (
      <div style={menuStyle} data-context-menu>
        <p style={{ fontSize: '0.7rem', color: night.textSec, marginBottom: 6, padding: '4px 8px' }}>
          {selected?.label}
        </p>
        <input
          autoFocus
          type="text"
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && contenu.trim()) {
              onSave(ecId, lineIdx, selected.niveau, selected.type, contenu)
            } else if (e.key === 'Escape') {
              setContextMenu(null)
            }
          }}
          placeholder="Tapez votre annotation…"
          style={{
            width: '100%',
            background: night.bg,
            color: night.text,
            border: `1px solid ${selected?.color || night.border}`,
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: '0.85rem',
            fontFamily: 'DM Sans, sans-serif',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => setContextMenu(null)}
            style={{
              background: 'none', border: 'none', color: night.textSec,
              cursor: 'pointer', fontSize: '0.78rem', padding: '4px 8px',
            }}
          >
            Annuler
          </button>
          <button
            onClick={() => contenu.trim() && onSave(ecId, lineIdx, selected.niveau, selected.type, contenu)}
            disabled={!contenu.trim()}
            style={{
              background: selected?.color || night.accent,
              color: '#fff', border: 'none',
              borderRadius: 6, padding: '4px 12px',
              cursor: contenu.trim() ? 'pointer' : 'not-allowed',
              opacity: contenu.trim() ? 1 : 0.4,
              fontSize: '0.78rem',
            }}
          >
            ✓ Valider
          </button>
        </div>
      </div>
    )
  }

  // Mode menu : choix du type
  return (
    <div style={menuStyle} data-context-menu>
      {canAnnotateTeam && (
        <>
          <p style={{ fontSize: '0.65rem', color: night.textTer, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 8px 4px' }}>
            Pour l'équipe
          </p>
          {teamTypes.map(t => (
            <MenuButton
              key={t.type}
              label={t.label}
              color={t.color}
              onClick={() => setContextMenu({ ...contextMenu, mode: 'saisie', selectedType: t.type, selectedNiveau: t.niveau })}
            />
          ))}
          <div style={{ height: 1, background: night.border, margin: '6px 0' }} />
        </>
      )}
      <p style={{ fontSize: '0.65rem', color: night.textTer, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 8px 4px' }}>
        Pour moi
      </p>
      <MenuButton
        label={persoType.label}
        color={persoType.color}
        onClick={() => setContextMenu({ ...contextMenu, mode: 'saisie', selectedType: persoType.type, selectedNiveau: persoType.niveau })}
      />
    </div>
  )
}

function MenuButton({ label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', background: 'none', border: 'none',
        cursor: 'pointer', padding: '8px 10px',
        color: '#E4F3FA', fontSize: '0.85rem',
        textAlign: 'left',
        fontFamily: 'DM Sans, sans-serif',
        borderRadius: 6,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </button>
  )
}

function SongBlock({ ec, index, showAccords, night, songAnnotations, onLineLongPress }) {
  const song = ec.chants || {}
  const lines = (song.paroles || '').split('\n')

  return (
    <div style={{ borderBottom: `1px solid ${night.border}`, padding: '24px 20px' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.75rem', color: night.textTer }}>{index + 1}</span>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', fontWeight: 600, color: night.text, lineHeight: 1.2 }}>{song.titre || '—'}</h2>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {ec.tonalite_jour && (
            <span style={{ background: 'rgba(75,191,232,0.15)', color: night.accent, padding: '3px 10px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 500 }}>
              {ec.tonalite_jour}
            </span>
          )}
          {ec.bpm_jour && <span style={{ fontSize: '0.75rem', color: night.textSec }}>{ec.bpm_jour} BPM</span>}
          {song.categorie && <span style={{ fontSize: '0.75rem', color: night.textSec }}>{song.categorie}</span>}
          {ec.lead_jour && <span style={{ fontSize: '0.75rem', color: night.textSec }}>Lead : {ec.lead_jour}</span>}
        </div>
        {ec.notes && (
          <p style={{ marginTop: 8, fontSize: '0.8rem', color: night.textSec, fontStyle: 'italic', background: 'rgba(75,191,232,0.07)', padding: '6px 10px', borderRadius: 8, borderLeft: `2px solid ${night.accent}` }}>
            {ec.notes}
          </p>
        )}
      </div>

      {showAccords && song.accords && (
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, border: `1px solid ${night.border}` }}>
          <p style={{ fontSize: '0.65rem', color: night.textTer, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Accords</p>
          <pre style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.82rem', color: night.text, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{song.accords}</pre>
        </div>
      )}
      {showAccords && !song.accords && (
        <p style={{ fontSize: '0.78rem', color: night.textTer, fontStyle: 'italic', marginBottom: 16 }}>Aucune grille renseignée — allez compléter la fiche.</p>
      )}

      {song.paroles ? (
        <div>
          {lines.map((line, lineIdx) => {
            const lineAnnotations = songAnnotations.filter(a => a.ligne_index === lineIdx)
            return (
              <ParolesLine
                key={lineIdx}
                line={line}
                lineIdx={lineIdx}
                lineAnnotations={lineAnnotations}
                night={night}
                onLongPress={onLineLongPress}
              />
            )
          })}
        </div>
      ) : (
        <p style={{ color: night.textTer, fontStyle: 'italic', fontSize: '0.85rem' }}>Aucune parole enregistrée.</p>
      )}
    </div>
  )
}

// V4 étape 3 : ligne de paroles avec gestion tap long / clic-droit
function ParolesLine({ line, lineIdx, lineAnnotations, night, onLongPress }) {
  const [longPressTimer, setLongPressTimer] = useState(null)

  function handleTouchStart(e) {
    const touch = e.touches[0]
    const x = touch.clientX
    const y = touch.clientY
    const timer = setTimeout(() => {
      onLongPress(lineIdx, x, y)
    }, 500) // 500ms = appui prolongé
    setLongPressTimer(timer)
  }

  function handleTouchEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
  }

  function handleContextMenu(e) {
    e.preventDefault() // Empêche le menu natif du navigateur
    onLongPress(lineIdx, e.clientX, e.clientY)
  }

  return (
    <div
      data-line-paroles
      style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 8 }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      <p style={{
        flex: 1,
        fontFamily: 'Cormorant Garamond, serif',
        fontSize: '1.5rem',
        lineHeight: 1.5,
        color: line.trim() === '' ? 'transparent' : night.text,
        minHeight: '1.5rem',
        userSelect: 'text',
      }}>
        {line || '\u00A0'}
      </p>
      {lineAnnotations.length > 0 && (
        <span style={{ fontSize: '0.7rem', color: night.textTer, marginTop: 6 }}>
          [{lineAnnotations.length}]
        </span>
      )}
    </div>
  )
}
