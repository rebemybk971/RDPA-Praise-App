import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { supabase } from '../lib/supabase'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'

const ANNOTATION_TYPES = {
  unisson:    { label: 'Unisson',    icon: '═', color: '#A78BD9', niveau: 'equipe' },
  harmonie:   { label: 'Harmonie',   icon: '♬', color: '#4BBFE8', niveau: 'equipe' },
  modulation: { label: 'Modulation', icon: '𝄞', color: '#B8972A', niveau: 'equipe' },
  rythmique:  { label: 'Rythmique',  icon: '♩', color: '#E8924B', niveau: 'equipe' },
  note_libre: { label: 'Note libre', icon: '✎', color: '#4a9a5a', niveau: 'equipe' },
  perso:      { label: 'Note pour moi', icon: '✎', color: '#7a8a95', niveau: 'perso' },
}

function formatDateLocale(dateStr, options = { weekday: 'long', day: 'numeric', month: 'long' }) {
  if (!dateStr) return ''
  const ymd = String(dateStr).slice(0, 10)
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ''
  return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString('fr-FR', options)
}

// Parse les paroles en blocs avec les indices de lignes originaux
function parseParolesBlocs(texte) {
  if (!texte || !texte.trim()) return []
  const lines = texte.split('\n')
  const blocs = []
  let current = null

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\[(.+)\]$/)
    if (m) {
      if (current) blocs.push(current)
      current = { nom: m[1].trim(), lignes: [] }
    } else if (current) {
      current.lignes.push({ text: lines[i], originalIdx: i })
    }
  }
  if (current) blocs.push(current)

  // Fallback : pas de marqueurs, un seul bloc
  if (blocs.length === 0 && texte.trim()) {
    return [{ nom: 'Paroles', lignes: lines.map((text, i) => ({ text, originalIdx: i })) }]
  }
  return blocs
}

// Construit les blocs d'affichage depuis blocs_custom (JSON) ou les blocs originaux
// Enrichit chaque bloc avec ses lignes d'accords (pour l'affichage syllabique)
function buildDisplayBlocs(song, blocsCustomJson) {
  const originaux = parseParolesBlocs(song?.paroles || '')
  const accordsOriginaux = parseParolesBlocs(song?.accords || '')

  let blocs
  if (!blocsCustomJson) {
    blocs = originaux.map((b, i) => ({ ...b, srcIdx: i, uid: `orig-${i}` }))
  } else {
    try {
      const custom = JSON.parse(blocsCustomJson)
      blocs = custom.map((c, pos) => {
        const src = originaux[c.blockIdx]
        if (!src) return null
        return { ...src, nom: c.label || src.nom, srcIdx: c.blockIdx, uid: `custom-${pos}-${c.blockIdx}` }
      }).filter(Boolean)
      // Références périmées (paroles modifiées depuis) : revenir aux paroles actuelles
      if (blocs.length === 0 && originaux.length > 0) {
        blocs = originaux.map((b, i) => ({ ...b, srcIdx: i, uid: `orig-${i}` }))
      }
    } catch {
      blocs = originaux.map((b, i) => ({ ...b, srcIdx: i, uid: `orig-${i}` }))
    }
  }

  return blocs.map(b => ({
    ...b,
    accordsLignes: accordsOriginaux[b.srcIdx]?.lignes || [],
  }))
}

const MEDLEY_COLORS = ['#4BBFE8', '#A78BD9', '#4a9a5a', '#E8924B', '#B8972A', '#E05A7A']

function buildInitialMedleyBlocs(setlist, blocsEtat) {
  const result = []
  let pos = 0
  for (const ec of setlist) {
    const blocs = blocsEtat[ec.id]?.blocs || []
    for (const bloc of blocs) {
      result.push({
        ec_id: ec.id,
        srcIdx: bloc.srcIdx,
        label: bloc.nom,
        uid: `med-${pos++}-${ec.id}-${bloc.srcIdx}`,
        lignes: bloc.lignes,
        chantTitre: ec.chants?.titre || '—',
      })
    }
  }
  return result
}

// Résout les blocs médley : reprend le médley enregistré s'il contient des blocs valides,
// sinon reconstruit depuis les blocs actuels de la setlist
function resolveMedleyBlocs(eventMedleyJson, setlist, blocsEtat) {
  if (eventMedleyJson) {
    const blocs = buildMedleyBlocsFromJson(eventMedleyJson, setlist)
    if (blocs && blocs.length > 0) return blocs
  }
  return buildInitialMedleyBlocs(setlist, blocsEtat)
}

function buildMedleyBlocsFromJson(json, setlist) {
  try {
    const saved = JSON.parse(json)
    return saved.map((item, pos) => {
      const ec = setlist.find(e => e.id === item.ec_id)
      if (!ec) return null
      const originaux = parseParolesBlocs(ec.chants?.paroles || '')
      const src = originaux[item.srcIdx]
      if (!src) return null
      return {
        ec_id: item.ec_id,
        srcIdx: item.srcIdx,
        label: item.label || src.nom,
        uid: `med-${pos}-${item.ec_id}-${item.srcIdx}`,
        lignes: src.lignes,
        chantTitre: ec.chants?.titre || '—',
      }
    }).filter(Boolean)
  } catch {
    return null
  }
}

export default function VueJourJPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { cycleTheme, icon } = useTheme()
  const { user, profile } = useAuth()
  const [event, setEvent] = useState(null)
  const [setlist, setSetlist] = useState([])
  const [annotations, setAnnotations] = useState({})
  const [showAccords, setShowAccords] = useState(false)
  const [loading, setLoading] = useState(true)
  const [contextMenu, setContextMenu] = useState(null)
  const [openBubbles, setOpenBubbles] = useState({})
  const [readingMode, setReadingMode] = useState(false)
  const [blocsEtat, setBlocsEtat] = useState({}) // { [ecId]: { blocs, history, modifie, saving } }
  const [confirmSave, setConfirmSave] = useState(null) // ecId | 'medley' | null
  const [toastMsg, setToastMsg] = useState('')
  const [medleyMode, setMedleyMode] = useState(false)
  const [medleyBlocs, setMedleyBlocs] = useState([])
  const [medleyModifie, setMedleyModifie] = useState(false)
  const [medleySaving, setMedleySaving] = useState(false)
  const [medleyHistory, setMedleyHistory] = useState([])

  function toast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000) }

  useEffect(() => { fetchAll() }, [id])

  useEffect(() => {
    document.body.classList.add('jour-j')
    return () => document.body.classList.remove('jour-j')
  }, [])

  useEffect(() => {
    if (!contextMenu) return
    function handleClickOutside(e) {
      if (!e.target.closest('[data-context-menu]')) setContextMenu(null)
    }
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
      const [{ data: ev }, { data: sl }] = await Promise.all([
        supabase.from('evenements').select('*').eq('id', id).single(),
        supabase.from('evenement_chants')
          .select('*, chants(*)')
          .eq('evenement_id', id)
          .order('ordre'),
      ])
      setEvent(ev)
      setSetlist(sl || [])

      if (sl && sl.length > 0) {
        // Initialiser l'état des blocs pour chaque chant
        const nouvelEtat = {}
        for (const ec of sl) {
          nouvelEtat[ec.id] = {
            blocs: buildDisplayBlocs(ec.chants, ec.blocs_custom),
            history: [],
            modifie: false,
            saving: false,
          }
        }
        setBlocsEtat(nouvelEtat)

        // Si un médley est enregistré, ouvrir directement en mode médley
        if (ev?.medley_blocs) {
          const blocs = buildMedleyBlocsFromJson(ev.medley_blocs, sl)
          if (blocs && blocs.length > 0) {
            setMedleyBlocs(blocs)
            setMedleyMode(true)
          }
        }

        // Charger les annotations
        const ecIds = sl.map(ec => ec.id)
        const { data: ann, error: annError } = await supabase
          .from('annotations')
          .select('*')
          .in('evenement_chant_id', ecIds)
          .order('created_at', { ascending: true })

        if (!annError) {
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

  function handleBlocsChange(ecId, newBlocs) {
    setBlocsEtat(prev => {
      const cur = prev[ecId]
      const history = [...(cur.history || []), cur.blocs].slice(-20)
      return { ...prev, [ecId]: { ...cur, blocs: newBlocs, history, modifie: true } }
    })
  }

  function handleBlocsUndo(ecId) {
    setBlocsEtat(prev => {
      const cur = prev[ecId]
      if (!cur.history?.length) return prev
      const history = [...cur.history]
      const blocs = history.pop()
      return { ...prev, [ecId]: { ...cur, blocs, history, modifie: history.length > 0 } }
    })
  }

  function handleBlocsReset(ecId) {
    const ec = setlist.find(e => e.id === ecId)
    if (!ec) return
    setBlocsEtat(prev => {
      const cur = prev[ecId]
      const history = [...(cur.history || []), cur.blocs].slice(-20)
      return { ...prev, [ecId]: { blocs: buildDisplayBlocs(ec.chants, null), history, modifie: true, saving: false } }
    })
  }

  async function handleSaveBlocs(ecId) {
    setBlocsEtat(prev => ({ ...prev, [ecId]: { ...prev[ecId], saving: true } }))

    const blocs = blocsEtat[ecId]?.blocs || []
    const custom = blocs.map(b => ({ blockIdx: b.srcIdx, label: b.nom }))

    const { error } = await supabase
      .from('evenement_chants')
      .update({ blocs_custom: JSON.stringify(custom) })
      .eq('id', ecId)

    if (error) {
      console.error('Erreur save blocs:', error)
      toast('⚠️ Erreur lors de la sauvegarde')
      setBlocsEtat(prev => ({ ...prev, [ecId]: { ...prev[ecId], saving: false } }))
    } else {
      toast('Ordre des blocs enregistré ✓')
      setBlocsEtat(prev => ({ ...prev, [ecId]: { ...prev[ecId], history: [], modifie: false, saving: false } }))
    }
    setConfirmSave(null)
  }

  function toggleMedleyMode() {
    if (!medleyMode) {
      const blocs = resolveMedleyBlocs(event?.medley_blocs, setlist, blocsEtat)
      setMedleyBlocs(blocs)
      setMedleyModifie(false)
      setMedleyHistory([])
    }
    setMedleyMode(v => !v)
  }

  function handleMedleyChange(newBlocs) {
    setMedleyHistory(h => [...h, medleyBlocs].slice(-20))
    setMedleyBlocs(newBlocs)
    setMedleyModifie(true)
  }

  function handleMedleyUndo() {
    if (!medleyHistory.length) return
    const newHistory = [...medleyHistory]
    const prev = newHistory.pop()
    setMedleyHistory(newHistory)
    setMedleyBlocs(prev)
    setMedleyModifie(newHistory.length > 0)
  }

  function handleMedleyReset() {
    setMedleyHistory(h => [...h, medleyBlocs].slice(-20))
    const blocs = resolveMedleyBlocs(event?.medley_blocs, setlist, blocsEtat)
    setMedleyBlocs(blocs)
    setMedleyModifie(true)
  }

  async function handleMedleySave() {
    setMedleySaving(true)
    const toSave = medleyBlocs.map(b => ({ ec_id: b.ec_id, srcIdx: b.srcIdx, label: b.label }))
    const { error } = await supabase
      .from('evenements')
      .update({ medley_blocs: JSON.stringify(toSave) })
      .eq('id', id)
    if (error) {
      toast('⚠️ Erreur lors de la sauvegarde')
    } else {
      toast('Médley enregistré ✓')
      setEvent(ev => ({ ...ev, medley_blocs: JSON.stringify(toSave) }))
      setMedleyHistory([])
      setMedleyModifie(false)
    }
    setMedleySaving(false)
    setConfirmSave(null)
  }

  async function saveAnnotation(ecId, lineIdx, niveau, type, contenu) {
    if (!user || !contenu.trim()) return
    try {
      const { data, error } = await supabase
        .from('annotations')
        .insert({ evenement_chant_id: ecId, ligne_index: lineIdx, niveau, type, contenu: contenu.trim(), auteur_id: user.id })
        .select()
        .single()
      if (error) { alert('Erreur : ' + error.message); return }
      setAnnotations(prev => {
        const next = { ...prev }
        if (!next[ecId]) next[ecId] = []
        next[ecId] = [...next[ecId], data]
        return next
      })
      setContextMenu(null)
    } catch (err) {
      alert('Erreur réseau : ' + err.message)
    }
  }

  async function deleteAnnotation(annotationId, ecId) {
    if (!confirm('Supprimer cette annotation ?')) return
    const { error } = await supabase.from('annotations').delete().eq('id', annotationId)
    if (error) { alert('Erreur : ' + error.message); return }
    setAnnotations(prev => {
      const next = { ...prev }
      if (next[ecId]) next[ecId] = next[ecId].filter(a => a.id !== annotationId)
      return next
    })
    setOpenBubbles(prev => { const n = { ...prev }; delete n[annotationId]; return n })
  }

  function toggleBubble(annotationId) {
    setOpenBubbles(prev => {
      const next = { ...prev }
      next[annotationId] ? delete next[annotationId] : (next[annotationId] = true)
      return next
    })
  }

  if (loading) return (
    <div style={{ height: '100vh', background: '#0D1820', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(228,243,250,0.55)', fontFamily: 'DM Sans, sans-serif' }}>
      Chargement…
    </div>
  )

  const night = {
    bg: '#0D1820', surface: '#192840', text: '#E4F3FA',
    textSec: 'rgba(228,243,250,0.55)', textTer: 'rgba(228,243,250,0.35)',
    border: 'rgba(75,191,232,0.15)', accent: '#4BBFE8',
  }

  const canAnnotateTeam = profile?.role === 'admin' || profile?.role === 'editeur'
  const canEdit = profile?.role === 'admin' || profile?.role === 'editeur'

  return (
    <div style={{ minHeight: '100vh', background: night.bg, color: night.text, fontFamily: 'DM Sans, sans-serif' }}>
      {toastMsg && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', background: '#192840', color: '#E4F3FA', border: '1px solid rgba(75,191,232,0.3)', borderRadius: 10, padding: '10px 20px', fontSize: '0.85rem', zIndex: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, background: night.bg, borderBottom: `1px solid ${night.border}`, padding: '14px 20px', zIndex: 50, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: night.textSec, fontSize: '1.1rem', padding: '4px 8px 4px 0' }}>←</button>
        <div style={{ flex: 1 }}>
          <p style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, color: night.text }}>{event?.nom}</p>
          <p style={{ fontSize: '0.72rem', color: night.textSec, marginTop: 1 }}>
            {formatDateLocale(event?.date)}
            {` · ${setlist.length} chant${setlist.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => setReadingMode(r => !r)}
          style={{ background: readingMode ? night.accent : night.surface, color: readingMode ? '#fff' : night.textSec, border: `1px solid ${night.border}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s' }}
          title={readingMode ? 'Afficher les annotations' : 'Masquer les annotations'}
        >
          {readingMode ? '👁️‍🗨️' : '👁️'}
        </button>
        <button
          onClick={() => setShowAccords(a => !a)}
          style={{ background: showAccords ? night.accent : night.surface, color: showAccords ? '#fff' : night.textSec, border: `1px solid ${night.border}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s' }}
        >
          ♩ Accords
        </button>
        <button
          onClick={toggleMedleyMode}
          title={medleyMode ? 'Revenir à la vue normale' : 'Mode médley'}
          style={{ background: medleyMode ? '#A78BD9' : night.surface, color: medleyMode ? '#fff' : night.textSec, border: `1px solid ${night.border}`, borderRadius: 8, padding: '7px 10px', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'DM Sans, sans-serif', transition: 'all 0.2s', flexShrink: 0 }}
        >
          {medleyMode ? '≡ Normal' : '∞ Médley'}
        </button>
        <button onClick={cycleTheme} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>{icon}</button>
      </div>

      {/* Setlist */}
      <div style={{ padding: '0 0 140px' }}>
        {medleyMode ? (
          <MedleyView
            blocs={medleyBlocs}
            setlist={setlist}
            night={night}
            canEdit={canEdit}
            showAccords={showAccords}
            onDragEnd={(result) => {
              if (!result.destination || result.destination.index === result.source.index) return
              const newBlocs = Array.from(medleyBlocs)
              const [moved] = newBlocs.splice(result.source.index, 1)
              newBlocs.splice(result.destination.index, 0, moved)
              handleMedleyChange(newBlocs)
            }}
            onDuplique={(bi) => {
              const bloc = medleyBlocs[bi]
              const copie = { ...bloc, label: `${bloc.label} (répétition)`, uid: `dup-med-${Date.now()}-${bi}` }
              handleMedleyChange([...medleyBlocs.slice(0, bi + 1), copie, ...medleyBlocs.slice(bi + 1)])
            }}
            onRetirer={(bi) => handleMedleyChange(medleyBlocs.filter((_, i) => i !== bi))}
            onReset={handleMedleyReset}
          />
        ) : setlist.map((ec, i) => (
          <SongBlock
            key={ec.id}
            ec={ec}
            index={i}
            showAccords={showAccords}
            night={night}
            songAnnotations={annotations[ec.id] || []}
            onLineLongPress={(lineIdx, x, y) => setContextMenu({ ecId: ec.id, lineIdx, x, y, mode: 'menu' })}
            openBubbles={openBubbles}
            onToggleBubble={toggleBubble}
            onDeleteAnnotation={deleteAnnotation}
            currentUserId={user?.id}
            readingMode={readingMode}
            blocs={blocsEtat[ec.id]?.blocs || []}
            canEdit={canEdit}
            onBlocsChange={(newBlocs) => handleBlocsChange(ec.id, newBlocs)}
          />
        ))}
      </div>

      {contextMenu && (
        <ContextMenu
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          night={night}
          canAnnotateTeam={canAnnotateTeam}
          onSave={saveAnnotation}
        />
      )}

      {/* Modale de confirmation sauvegarde */}
      {confirmSave && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: night.surface, borderRadius: 16, padding: 24, maxWidth: 340, width: '100%', border: `1px solid ${night.border}` }}>
            <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', marginBottom: 10, color: night.text }}>
              {confirmSave === 'medley' ? 'Enregistrer le médley ?' : "Enregistrer l'ordre des blocs ?"}
            </h3>
            <p style={{ fontSize: '0.85rem', color: night.textSec, lineHeight: 1.5, marginBottom: 20 }}>
              {confirmSave === 'medley'
                ? "Cet ordre de médley sera utilisé pour cet événement. Les chants originaux ne seront pas modifiés."
                : "Cet ordre sera utilisé pour cet événement uniquement. Le chant original ne sera pas modifié."
              }
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmSave(null)}
                style={{ flex: 1, background: 'none', border: `1px solid ${night.border}`, color: night.textSec, borderRadius: 10, padding: '10px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem' }}
              >
                Annuler
              </button>
              <button
                onClick={() => confirmSave === 'medley' ? handleMedleySave() : handleSaveBlocs(confirmSave)}
                style={{ flex: 1, background: confirmSave === 'medley' ? '#A78BD9' : night.accent, border: 'none', color: '#fff', borderRadius: 10, padding: '10px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', fontWeight: 600 }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barres de sauvegarde fixes (au-dessus de la légende) */}
      {canEdit && Object.entries(blocsEtat)
        .filter(([, e]) => e.modifie)
        .map(([ecId, etat], idx) => {
          const ec = setlist.find(e => e.id === ecId)
          const canUndo = (etat.history?.length || 0) > 0
          return (
            <div key={ecId} style={{
              position: 'fixed',
              bottom: 48 + idx * 52,
              left: 0, right: 0,
              background: night.surface,
              borderTop: `1px solid ${night.accent}`,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              zIndex: 60,
              boxShadow: '0 -4px 16px rgba(0,0,0,0.35)',
            }}>
              <span style={{ flex: 1, fontSize: '0.78rem', color: night.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ec?.chants?.titre}
              </span>
              {canUndo && (
                <button
                  onClick={() => handleBlocsUndo(ecId)}
                  title="Annuler le dernier mouvement"
                  style={{ background: 'none', border: `1px solid ${night.border}`, color: night.textSec, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: '1rem', fontFamily: 'DM Sans, sans-serif', flexShrink: 0, lineHeight: 1 }}
                >
                  ↩
                </button>
              )}
              <button
                onClick={() => handleBlocsReset(ecId)}
                title="Réinitialiser l'ordre d'origine"
                style={{ background: 'none', border: `1px solid ${night.border}`, color: night.textSec, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}
              >
                ⟳
              </button>
              <button
                onClick={() => setConfirmSave(ecId)}
                disabled={etat.saving}
                style={{ background: night.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: etat.saving ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, opacity: etat.saving ? 0.6 : 1, flexShrink: 0 }}
              >
                {etat.saving ? '…' : '💾 Enregistrer'}
              </button>
            </div>
          )
        })
      }

      {/* Barre fixe médley */}
      {canEdit && medleyMode && medleyModifie && (
        <div style={{
          position: 'fixed', bottom: 48, left: 0, right: 0,
          background: '#1e1a30', borderTop: '1px solid #A78BD9',
          padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, zIndex: 60,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.35)',
        }}>
          <span style={{ flex: 1, fontSize: '0.78rem', color: night.textSec }}>Médley</span>
          {medleyHistory.length > 0 && (
            <button onClick={handleMedleyUndo} title="Annuler le dernier mouvement"
              style={{ background: 'none', border: `1px solid ${night.border}`, color: night.textSec, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: '1rem', flexShrink: 0, lineHeight: 1 }}>
              ↩
            </button>
          )}
          <button onClick={handleMedleyReset} title="Réinitialiser"
            style={{ background: 'none', border: `1px solid ${night.border}`, color: night.textSec, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>
            ⟳
          </button>
          <button onClick={() => setConfirmSave('medley')} disabled={medleySaving}
            style={{ background: '#A78BD9', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: medleySaving ? 'not-allowed' : 'pointer', fontSize: '0.75rem', fontFamily: 'DM Sans, sans-serif', fontWeight: 600, opacity: medleySaving ? 0.6 : 1, flexShrink: 0 }}>
            {medleySaving ? '…' : '💾 Enregistrer'}
          </button>
        </div>
      )}

      {/* Légende */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: night.bg, borderTop: `1px solid ${night.border}`, padding: '8px 20px', display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {Object.entries(ANNOTATION_TYPES).map(([key, t]) => (
          <LegendItem key={key} icon={t.icon} color={t.color} label={t.label} />
        ))}
      </div>
    </div>
  )
}

function LegendItem({ icon, color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: 'rgba(228,243,250,0.45)' }}>
      <span style={{ color, fontSize: '0.85rem' }}>{icon}</span>
      {label}
    </div>
  )
}

function SongBlock({ ec, index, showAccords, night, songAnnotations, onLineLongPress, openBubbles, onToggleBubble, onDeleteAnnotation, currentUserId, readingMode, blocs, canEdit, onBlocsChange }) {
  const song = ec.chants || {}

  function onDragEnd(result) {
    if (!result.destination || result.destination.index === result.source.index) return
    const newBlocs = Array.from(blocs)
    const [moved] = newBlocs.splice(result.source.index, 1)
    newBlocs.splice(result.destination.index, 0, moved)
    onBlocsChange(newBlocs)
  }

  function dupliquerBloc(bi) {
    const bloc = blocs[bi]
    const copie = { ...bloc, nom: `${bloc.nom} (répétition)`, uid: `dup-${Date.now()}-${bi}` }
    const newBlocs = [
      ...blocs.slice(0, bi + 1),
      copie,
      ...blocs.slice(bi + 1),
    ]
    onBlocsChange(newBlocs)
  }

  return (
    <div style={{ borderBottom: `1px solid ${night.border}`, padding: '24px 20px' }}>
      {/* En-tête du chant */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.75rem', color: night.textTer }}>{index + 1}</span>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.6rem', fontWeight: 600, color: night.text, lineHeight: 1.2 }}>{song.titre || '—'}</h2>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {ec.tonalite_jour && <span style={{ background: 'rgba(75,191,232,0.15)', color: night.accent, padding: '3px 10px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 500 }}>{ec.tonalite_jour}</span>}
          {ec.bpm_jour && <span style={{ fontSize: '0.75rem', color: night.textSec }}>{ec.bpm_jour} BPM</span>}
          {song.categorie && <span style={{ fontSize: '0.75rem', color: night.textSec }}>{song.categorie}</span>}
          {ec.lead && <span style={{ fontSize: '0.8rem', color: night.accent, fontWeight: 500 }}>🎤 {ec.lead}</span>}
        </div>
        {ec.notes && (
          <p style={{ marginTop: 8, fontSize: '0.8rem', color: night.textSec, fontStyle: 'italic', background: 'rgba(75,191,232,0.07)', padding: '6px 10px', borderRadius: 8, borderLeft: `2px solid ${night.accent}` }}>
            {ec.notes}
          </p>
        )}
      </div>

      {showAccords && !song.accords && (
        <p style={{ fontSize: '0.78rem', color: night.textTer, fontStyle: 'italic', marginBottom: 16 }}>Aucune grille renseignée.</p>
      )}

      {/* Blocs de paroles */}
      {blocs.length === 0 ? (
        <p style={{ color: night.textTer, fontStyle: 'italic', fontSize: '0.85rem' }}>Aucune parole enregistrée.</p>
      ) : (
        <DragDropContext onDragEnd={canEdit ? onDragEnd : () => {}}>
          <Droppable droppableId={`blocs-${ec.id}`}>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {blocs.map((bloc, bi) => (
                  <Draggable key={bloc.uid} draggableId={bloc.uid} index={bi} isDragDisabled={!canEdit}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={{
                          marginBottom: 20,
                          opacity: snapshot.isDragging ? 0.75 : 1,
                          ...provided.draggableProps.style,
                        }}
                      >
                        {/* En-tête du bloc */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          {canEdit && (
                            <span
                              {...provided.dragHandleProps}
                              style={{ cursor: 'grab', color: night.textTer, fontSize: '0.9rem', userSelect: 'none', lineHeight: 1, flexShrink: 0 }}
                              title="Déplacer ce bloc"
                            >⠿</span>
                          )}
                          <span style={{ fontSize: '0.65rem', color: night.accent, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                            {bloc.nom}
                          </span>
                          {canEdit && (
                            <button
                              onClick={() => dupliquerBloc(bi)}
                              style={{ background: 'none', border: `1px solid ${night.border}`, cursor: 'pointer', color: night.textTer, fontSize: '0.72rem', padding: '1px 7px', borderRadius: 6, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6 }}
                              title="Dupliquer ce bloc"
                            >
                              ⊕
                            </button>
                          )}
                        </div>

                        {/* Lignes du bloc */}
                        {bloc.lignes.map((ligne, li) => {
                          const accordLigne = bloc.accordsLignes?.[li]?.text || ''
                          return (
                            <div key={li}>
                              {showAccords && accordLigne.trim() && (
                                <p style={{
                                  fontFamily: 'DM Mono, monospace',
                                  fontSize: '0.9rem',
                                  color: night.accent,
                                  whiteSpace: 'pre',
                                  lineHeight: 1.2,
                                  marginBottom: 1,
                                  userSelect: 'text',
                                }}>
                                  {accordLigne}
                                </p>
                              )}
                              <ParolesLine
                                line={ligne.text}
                                lineIdx={ligne.originalIdx}
                                lineAnnotations={songAnnotations.filter(a => a.ligne_index === ligne.originalIdx)}
                                night={night}
                                onLongPress={onLineLongPress}
                                openBubbles={openBubbles}
                                onToggleBubble={onToggleBubble}
                                onDeleteAnnotation={onDeleteAnnotation}
                                currentUserId={currentUserId}
                                ecId={ec.id}
                                readingMode={readingMode}
                                monoFont={showAccords}
                              />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

    </div>
  )
}

function ParolesLine({ line, lineIdx, lineAnnotations, night, onLongPress, openBubbles, onToggleBubble, onDeleteAnnotation, currentUserId, ecId, readingMode, monoFont }) {
  const [longPressTimer, setLongPressTimer] = useState(null)

  function handleTouchStart(e) {
    const touch = e.touches[0]
    const timer = setTimeout(() => onLongPress(lineIdx, touch.clientX, touch.clientY), 500)
    setLongPressTimer(timer)
  }

  function handleTouchEnd() {
    if (longPressTimer) { clearTimeout(longPressTimer); setLongPressTimer(null) }
  }

  function handleContextMenu(e) {
    e.preventDefault()
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
        fontFamily: monoFont ? 'DM Mono, monospace' : 'Cormorant Garamond, serif',
        fontSize: monoFont ? '0.9rem' : '1.5rem',
        lineHeight: 1.5,
        whiteSpace: monoFont ? 'pre' : 'normal',
        color: line.trim() === '' ? 'transparent' : night.text,
        minHeight: monoFont ? '0.9rem' : '1.5rem',
        userSelect: 'text',
      }}>
        {line || '\u00A0'}
      </p>
      {!readingMode && lineAnnotations.length > 0 && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, marginTop: 6, position: 'relative' }}>
          {lineAnnotations.map(a => {
            const config = ANNOTATION_TYPES[a.type]
            if (!config) return null
            const isOpen = openBubbles[a.id]
            return (
              <div key={a.id} style={{ position: 'relative' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleBubble(a.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: config.color, fontSize: '1.1rem', padding: '0 2px', lineHeight: 1, fontFamily: 'serif' }}
                  title={config.label}
                >
                  {config.icon}
                </button>
                {isOpen && (
                  <AnnotationBubble
                    annotation={a}
                    config={config}
                    night={night}
                    isAuthor={a.auteur_id === currentUserId}
                    onClose={() => onToggleBubble(a.id)}
                    onDelete={() => onDeleteAnnotation(a.id, ecId)}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AnnotationBubble({ annotation, config, night, isAuthor, onClose, onDelete }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, background: night.surface, border: `1px solid ${config.color}`, borderRadius: 10, padding: '10px 12px', minWidth: 180, maxWidth: 280, boxShadow: '0 6px 20px rgba(0,0,0,0.4)', zIndex: 80, fontFamily: 'DM Sans, sans-serif' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: config.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <span style={{ fontSize: '0.95rem' }}>{config.icon}</span>
          {config.label}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: night.textSec, cursor: 'pointer', fontSize: '0.95rem', padding: 0, lineHeight: 1 }}>×</button>
      </div>
      <p style={{ fontSize: '0.85rem', color: night.text, margin: 0, lineHeight: 1.4 }}>{annotation.contenu}</p>
      {isAuthor && (
        <button onClick={onDelete} style={{ marginTop: 8, background: 'none', border: 'none', color: night.textTer, cursor: 'pointer', fontSize: '0.7rem', padding: 0, fontFamily: 'DM Sans, sans-serif' }}>
          🗑️ Supprimer
        </button>
      )}
    </div>
  )
}

function ContextMenu({ contextMenu, setContextMenu, night, canAnnotateTeam, onSave }) {
  const { ecId, lineIdx, x, y, mode, selectedType } = contextMenu
  const [contenu, setContenu] = useState('')

  const teamTypes = ['unisson', 'harmonie', 'modulation', 'rythmique', 'note_libre']

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
    const selected = ANNOTATION_TYPES[selectedType]
    return (
      <div style={menuStyle} data-context-menu>
        <p style={{ fontSize: '0.7rem', color: night.textSec, marginBottom: 6, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: selected.color, fontSize: '0.9rem' }}>{selected.icon}</span>
          {selected.label}
        </p>
        <input
          autoFocus
          type="text"
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && contenu.trim()) onSave(ecId, lineIdx, selected.niveau, selectedType, contenu)
            else if (e.key === 'Escape') setContextMenu(null)
          }}
          placeholder="Tapez votre annotation…"
          style={{ width: '100%', background: night.bg, color: night.text, border: `1px solid ${selected.color}`, borderRadius: 8, padding: '8px 10px', fontSize: '0.85rem', fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box' }}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setContextMenu(null)} style={{ background: 'none', border: 'none', color: night.textSec, cursor: 'pointer', fontSize: '0.78rem', padding: '4px 8px' }}>Annuler</button>
          <button
            onClick={() => contenu.trim() && onSave(ecId, lineIdx, selected.niveau, selectedType, contenu)}
            disabled={!contenu.trim()}
            style={{ background: selected.color, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: contenu.trim() ? 'pointer' : 'not-allowed', opacity: contenu.trim() ? 1 : 0.4, fontSize: '0.78rem' }}
          >
            ✓ Valider
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={menuStyle} data-context-menu>
      {canAnnotateTeam && (
        <>
          <p style={{ fontSize: '0.65rem', color: night.textTer, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 8px 4px' }}>Pour l'équipe</p>
          {teamTypes.map(typeKey => {
            const t = ANNOTATION_TYPES[typeKey]
            return <MenuButton key={typeKey} icon={t.icon} label={t.label} color={t.color} onClick={() => setContextMenu({ ...contextMenu, mode: 'saisie', selectedType: typeKey })} />
          })}
          <div style={{ height: 1, background: night.border, margin: '6px 0' }} />
        </>
      )}
      <p style={{ fontSize: '0.65rem', color: night.textTer, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '6px 8px 4px' }}>Pour moi</p>
      <MenuButton
        icon={ANNOTATION_TYPES.perso.icon}
        label={ANNOTATION_TYPES.perso.label}
        color={ANNOTATION_TYPES.perso.color}
        onClick={() => setContextMenu({ ...contextMenu, mode: 'saisie', selectedType: 'perso' })}
      />
    </div>
  )
}

function MenuButton({ icon, label, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 10px', color: '#E4F3FA', fontSize: '0.85rem', textAlign: 'left', fontFamily: 'DM Sans, sans-serif', borderRadius: 6, transition: 'background 0.15s' }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
    >
      <span style={{ color, fontSize: '1rem', width: 16, textAlign: 'center' }}>{icon}</span>
      {label}
    </button>
  )
}

function MedleyView({ blocs, setlist, night, canEdit, showAccords, onDragEnd, onDuplique, onRetirer, onReset }) {
  const songColorMap = {}
  setlist.forEach((ec, i) => { songColorMap[ec.id] = MEDLEY_COLORS[i % MEDLEY_COLORS.length] })

  if (blocs.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: night.textTer, fontSize: '0.9rem' }}>
        <p style={{ marginBottom: 16 }}>Aucun bloc — réinitialisez pour recharger les blocs de la setlist.</p>
        {canEdit && (
          <button
            onClick={onReset}
            style={{ background: night.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}
          >
            ⟳ Réinitialiser
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 0' }}>
      <p style={{ padding: '0 20px 12px', fontSize: '0.72rem', color: night.textTer, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {blocs.length} bloc{blocs.length !== 1 ? 's' : ''} — glissez pour réorganiser entre les chants
      </p>
      <DragDropContext onDragEnd={canEdit ? onDragEnd : () => {}}>
        <Droppable droppableId="medley">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {blocs.map((bloc, bi) => {
                const color = songColorMap[bloc.ec_id] || night.accent
                return (
                  <Draggable key={bloc.uid} draggableId={bloc.uid} index={bi} isDragDisabled={!canEdit}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={{
                          borderBottom: `1px solid ${night.border}`,
                          padding: '16px 20px',
                          opacity: snapshot.isDragging ? 0.75 : 1,
                          background: snapshot.isDragging ? night.surface : 'transparent',
                          ...provided.draggableProps.style,
                        }}
                      >
                        {/* En-tête bloc médley */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          {canEdit && (
                            <span
                              {...provided.dragHandleProps}
                              style={{ cursor: 'grab', color: night.textTer, fontSize: '0.9rem', userSelect: 'none', flexShrink: 0 }}
                            >⠿</span>
                          )}
                          <span style={{ fontSize: '0.6rem', color, background: `${color}22`, border: `1px solid ${color}55`, borderRadius: 6, padding: '2px 7px', fontWeight: 600, letterSpacing: '0.04em', flexShrink: 0, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {bloc.chantTitre}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: night.accent, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                            {bloc.label}
                          </span>
                          {canEdit && (
                            <>
                              <button
                                onClick={() => onDuplique(bi)}
                                style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${night.border}`, cursor: 'pointer', color: night.textTer, fontSize: '0.72rem', padding: '1px 7px', borderRadius: 6, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6, flexShrink: 0 }}
                                title="Dupliquer ce bloc"
                              >⊕</button>
                              <button
                                onClick={() => onRetirer(bi)}
                                style={{ background: 'none', border: `1px solid ${night.border}`, cursor: 'pointer', color: '#e05a7a', fontSize: '0.72rem', padding: '1px 7px', borderRadius: 6, fontFamily: 'DM Sans, sans-serif', lineHeight: 1.6, flexShrink: 0 }}
                                title="Retirer ce bloc du médley"
                              >✕</button>
                            </>
                          )}
                        </div>
                        {/* Paroles */}
                        {bloc.lignes?.map((ligne, li) => (
                          <p key={li} style={{
                            fontFamily: 'Cormorant Garamond, serif',
                            fontSize: '1.4rem',
                            lineHeight: 1.5,
                            color: ligne.text.trim() === '' ? 'transparent' : night.text,
                            minHeight: '1.4rem',
                          }}>
                            {ligne.text || '\u00A0'}
                          </p>
                        ))}
                      </div>
                    )}
                  </Draggable>
                )
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  )
}
