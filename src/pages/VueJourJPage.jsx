import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'

export default function VueJourJPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { cycleTheme, icon } = useTheme()
  const [event, setEvent] = useState(null)
  const [setlist, setSetlist] = useState([])
  const [showAccords, setShowAccords] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    const [{ data: ev }, { data: sl }] = await Promise.all([
      supabase.from('evenements').select('*').eq('id', id).single(),
      supabase.from('evenement_chants')
        .select('*, chants(*)')
        .eq('evenement_id', id)
        .order('ordre'),
    ])
    setEvent(ev)
    setSetlist(sl || [])
    setLoading(false)
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

  return (
    <div style={{ minHeight: '100vh', background: night.bg, color: night.text, fontFamily: 'DM Sans, sans-serif' }}>
      {/* Header */}
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

      {/* Setlist */}
      <div style={{ padding: '0 0 40px' }}>
        {setlist.map((ec, i) => (
          <SongBlock key={ec.id} ec={ec} index={i} showAccords={showAccords} night={night} />
        ))}
      </div>

      {/* Legend */}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, background: night.bg, borderTop: `1px solid ${night.border}`, padding: '8px 20px', display: 'flex', gap: 16, justifyContent: 'center' }}>
        <LegendItem color="#B8972A" label="Modulation" />
        <LegendItem color="#4BBFE8" label="Harmonie" />
        <LegendItem color="#4a9a5a" label="Note" />
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

function SongBlock({ ec, index, showAccords, night }) {
  const [openAnnotations, setOpenAnnotations] = useState(new Set())
  const song = ec.chants || {}
  const lines = (song.paroles || '').split('\n')

  function toggleAnnotation(lineIdx) {
    setOpenAnnotations(prev => {
      const next = new Set(prev)
      next.has(lineIdx) ? next.delete(lineIdx) : next.add(lineIdx)
      return next
    })
  }

  return (
    <div style={{ borderBottom: `1px solid ${night.border}`, padding: '24px 20px' }}>
      {/* Song header */}
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

      {/* Accords */}
      {showAccords && song.accords && (
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, border: `1px solid ${night.border}` }}>
          <p style={{ fontSize: '0.65rem', color: night.textTer, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Accords</p>
          <pre style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.82rem', color: night.text, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{song.accords}</pre>
        </div>
      )}
      {showAccords && !song.accords && (
        <p style={{ fontSize: '0.78rem', color: night.textTer, fontStyle: 'italic', marginBottom: 16 }}>Aucune grille renseignée — allez compléter la fiche.</p>
      )}

      {/* Paroles */}
      {song.paroles ? (
        <div>
          {lines.map((line, lineIdx) => (
            <div key={lineIdx} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <p style={{
                flex: 1,
                fontFamily: 'Cormorant Garamond, serif',
                fontSize: '1.25rem',
                lineHeight: 2,
                color: line.trim() === '' ? 'transparent' : night.text,
                minHeight: '2rem',
                userSelect: 'text',
              }}>
                {line || '\u00A0'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: night.textTer, fontStyle: 'italic', fontSize: '0.85rem' }}>Aucune parole enregistrée.</p>
      )}
    </div>
  )
}
