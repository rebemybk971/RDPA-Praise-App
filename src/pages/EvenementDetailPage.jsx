import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
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

// Format une date YYYY-MM-DD (ou ISO) en français, SANS décalage de fuseau horaire
function formatDateLocale(dateStr, options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!dateStr) return ''
  // On prend uniquement YYYY-MM-DD (au cas où Supabase renvoie un timestamp)
  const ymd = String(dateStr).slice(0, 10)
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ''
  // On crée une Date avec l'heure 12h en local pour éviter tout débordement de fuseau
  const localDate = new Date(y, m - 1, d, 12, 0, 0)
  return localDate.toLocaleDateString('fr-FR', options)
}

// Récupère le jour de la semaine en local (0 = dimanche)
function getJourSemaine(dateStr) {
  if (!dateStr) return null
  const ymd = String(dateStr).slice(0, 10)
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 12, 0, 0).getDay()
}

// Heure par défaut selon le jour de la semaine
function defaultHeure(dateStr) {
  if (!dateStr) return '19:00'
  return getJourSemaine(dateStr) === 0 ? '09:30' : '19:00'  // 0 = dimanche
}

// Extrait YYYY-MM-DD pour pré-remplir un input type="date"
function dateForInput(dateStr) {
  if (!dateStr) return ''
  return String(dateStr).slice(0, 10)
}

export default function EvenementDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [event, setEvent] = useState(null)
  const [setlist, setSetlist] = useState([])
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddSong, setShowAddSong] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    try {
      const [evRes, slRes, mbRes] = await Promise.all([
        supabase.from('evenements').select('*').eq('id', id).single(),
        supabase.from('evenement_chants').select('*, chants(*)').eq('evenement_id', id).order('ordre'),
        supabase.from('membres').select('id, nom').eq('actif', true).order('nom'),
      ])

      if (evRes.error) {
        console.error('[fetchAll] Erreur evenements :', evRes.error)
        toast(`⚠️ Erreur événement : ${evRes.error.message}`)
      }
      if (slRes.error) {
        console.error('[fetchAll] Erreur evenement_chants :', slRes.error)
        toast(`⚠️ Erreur setlist : ${slRes.error.message}`)
      }
      if (mbRes.error) {
        console.error('[fetchAll] Erreur membres :', mbRes.error)
        toast(`⚠️ Erreur membres : ${mbRes.error.message}`)
      }

      setEvent(evRes.data)
      setSetlist(slRes.data || [])
      setMembres(mbRes.data || [])
    } catch (err) {
      console.error('[fetchAll] Exception :', err)
      toast(`⚠️ Erreur : ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  function toast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(''), 4000) }

  async function removeSong(ecId) {
    const { error } = await supabase.from('evenement_chants').delete().eq('id', ecId)
    if (error) {
      console.error('[removeSong] Erreur :', error)
      toast(`⚠️ Suppression échouée : ${error.message}`)
      return
    }
    setSetlist(s => s.filter(x => x.id !== ecId))
    toast('Chant retiré ✓')
  }

  async function updateLead(ecId, leadId, leadText) {
    const payload = { lead_id: leadId, lead: leadText }
    const { error } = await supabase
      .from('evenement_chants')
      .update(payload)
      .eq('id', ecId)

    if (error) {
      console.error('[updateLead] Erreur :', error)
      toast(`⚠️ Soliste non enregistré : ${error.message}`)
      return
    }
    setSetlist(s => s.map(x => x.id === ecId ? { ...x, lead_id: leadId, lead: leadText } : x))
    toast('Soliste enregistré ✓')
  }

  async function onDragEnd(result) {
    if (!result.destination) return
    if (result.destination.index === result.source.index) return

    const newSetlist = Array.from(setlist)
    const [moved] = newSetlist.splice(result.source.index, 1)
    newSetlist.splice(result.destination.index, 0, moved)

    setSetlist(newSetlist)

    await Promise.all(
      newSetlist.map((ec, i) =>
        supabase.from('evenement_chants').update({ ordre: i + 1 }).eq('id', ec.id)
      )
    )
  }

  async function saveEvent(updated) {
    try {
      const { error } = await supabase
        .from('evenements')
        .update(updated)
        .eq('id', id)
      if (error) {
        console.error('[saveEvent] Erreur :', error)
        toast(`⚠️ Modification échouée : ${error.message}`)
        return false
      }
      setEvent(prev => ({ ...prev, ...updated }))
      toast('Événement modifié ✓')
      return true
    } catch (err) {
      console.error('[saveEvent] Exception :', err)
      toast(`⚠️ Erreur : ${err.message}`)
      return false
    }
  }

  function shareWhatsApp() {
    const lines = [
      `🎵 *${event.nom}*`,
      event.date ? `📅 ${formatDateLocale(event.date, { weekday: 'long', day: 'numeric', month: 'long' })}` : '',
      '',
      ...setlist.map((s, i) => {
        const t = s.chants?.titre || ''
        const lead = s.lead ? ` — ${s.lead}` : ''
        const ton = s.tonalite_jour ? ` (${s.tonalite_jour})` : ''
        return `${i + 1}. ${t}${lead}${ton}`
      }),
    ].filter(l => l !== undefined).join('\n')
    setShowShare(false)
    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, '_blank')
  }

  function copyShare() {
    const lines = [
      `🎵 ${event?.nom}`,
      event?.date ? `📅 ${formatDateLocale(event.date, { day: 'numeric', month: 'numeric', year: 'numeric' })}` : '',
      ...setlist.map((s, i) => {
        const t = s.chants?.titre || ''
        const lead = s.lead ? ` — ${s.lead}` : ''
        const ton = s.tonalite_jour ? ` (${s.tonalite_jour})` : ''
        return `${i + 1}. ${t}${lead}${ton}`
      }),
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(lines)
    toast('Message copié !')
    setShowShare(false)
  }

  if (loading) return <div className="loading">Chargement…</div>
  if (!event) return <div className="empty-state"><p>Événement introuvable.</p></div>

  const canEdit = profile?.role === 'admin' || profile?.role === 'editeur'

  // Heure affichée dans l'en-tête (auto si vide)
  const heureAffichee = event.heure || defaultHeure(event.date)

  return (
    <>
      {toastMsg && <div className="toast">{toastMsg}</div>}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-sec)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-ui)', fontSize: '0.85rem', marginBottom: 12 }}>
          ← Événements
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', fontWeight: 600 }}>{event.nom}</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--texte-sec)', marginTop: 4 }}>
              {formatDateLocale(event.date)}
              {heureAffichee && ` · ${heureAffichee}`}
              {event.type_culte && ` · ${event.type_culte}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {canEdit && (
              <button onClick={() => setShowEdit(true)} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: '1rem' }} title="Modifier">✏️</button>
            )}
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
        <DragDropContext onDragEnd={canEdit ? onDragEnd : () => {}}>
          <Droppable droppableId="setlist">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {setlist.map((ec, i) => (
                  <Draggable key={ec.id} draggableId={ec.id} index={i} isDragDisabled={!canEdit}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="card"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          opacity: snapshot.isDragging ? 0.7 : 1,
                          boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : undefined,
                          ...provided.draggableProps.style,
                        }}
                      >
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {/* Poignée drag */}
                          {canEdit && (
                            <span
                              {...provided.dragHandleProps}
                              style={{ cursor: 'grab', color: 'var(--texte-ter)', fontSize: '1rem', padding: '0 2px', lineHeight: 1, userSelect: 'none' }}
                              title="Déplacer"
                            >⠿</span>
                          )}
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

                        {/* Sélecteur soliste inline */}
                        <SoloistePicker
                          ec={ec}
                          membres={membres}
                          canEdit={canEdit}
                          onChange={updateLead}
                        />
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

      {canEdit && (
        <button className="fab" onClick={() => setShowAddSong(true)}>＋</button>
      )}

      {/* Add song modal */}
      {showAddSong && (
        <AddSongModal
          eventId={id}
          existingIds={setlist.map(s => s.chant_id)}
          onClose={() => setShowAddSong(false)}
          onSaved={() => { setShowAddSong(false); fetchAll(); toast('Chant ajouté ✓') }}
          onError={(msg) => toast(`⚠️ ${msg}`)}
          nextOrdre={setlist.length + 1}
        />
      )}

      {/* Edit event modal */}
      {showEdit && (
        <EditEventModal
          event={event}
          onClose={() => setShowEdit(false)}
          onSave={async (updated) => {
            const ok = await saveEvent(updated)
            if (ok) setShowEdit(false)
          }}
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

function SoloistePicker({ ec, membres, canEdit, onChange }) {
  const [mode, setMode] = useState(() => {
    if (ec.lead_id) return 'membre'
    if (ec.lead) return 'libre'
    return 'aucun'
  })
  const [texteLibre, setTexteLibre] = useState(ec.lead || '')

  if (!canEdit) {
    if (!ec.lead) return null
    return (
      <div style={{ paddingLeft: 32, fontSize: '0.8rem', color: 'var(--texte-sec)' }}>
        🎤 {ec.lead}
      </div>
    )
  }

  function handleSelectChange(e) {
    const value = e.target.value
    if (value === '') {
      setMode('aucun')
      setTexteLibre('')
      onChange(ec.id, null, null)
    } else if (value === '__autre__') {
      setMode('libre')
      setTexteLibre('')
    } else {
      const m = membres.find(x => x.id === value)
      if (m) {
        setMode('membre')
        setTexteLibre('')
        onChange(ec.id, m.id, m.nom)
      }
    }
  }

  function handleTexteBlur() {
    const t = texteLibre.trim()
    if (t === '') {
      setMode('aucun')
      onChange(ec.id, null, null)
    } else {
      onChange(ec.id, null, t)
    }
  }

  return (
    <div style={{ paddingLeft: 32, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--texte-sec)' }}>🎤 Soliste :</span>

      {mode !== 'libre' ? (
        <select
          value={ec.lead_id || ''}
          onChange={handleSelectChange}
          style={{
            fontSize: '0.8rem',
            padding: '4px 8px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--card)',
            color: 'var(--texte)',
            fontFamily: 'var(--font-ui)',
            cursor: 'pointer',
            flex: 1,
            minWidth: 120,
          }}
        >
          <option value="">— Aucun —</option>
          {membres.map(m => (
            <option key={m.id} value={m.id}>{m.nom}</option>
          ))}
          <option value="__autre__">✏️ Autre (saisir un nom)…</option>
        </select>
      ) : (
        <>
          <input
            type="text"
            value={texteLibre}
            onChange={e => setTexteLibre(e.target.value)}
            onBlur={handleTexteBlur}
            placeholder="Nom du soliste"
            autoFocus
            style={{
              fontSize: '0.8rem',
              padding: '4px 8px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--card)',
              color: 'var(--texte)',
              fontFamily: 'var(--font-ui)',
              flex: 1,
              minWidth: 120,
            }}
          />
          <button
            onClick={() => {
              setMode(ec.lead_id ? 'membre' : 'aucun')
              setTexteLibre('')
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--texte-ter)',
              fontSize: '0.85rem',
            }}
            title="Annuler la saisie libre"
          >
            ↩︎
          </button>
        </>
      )}
    </div>
  )
}

function EditEventModal({ event, onClose, onSave }) {
  const [nom, setNom] = useState(event.nom || '')
  const [date, setDate] = useState(dateForInput(event.date))
  const [heure, setHeure] = useState(event.heure || '')
  const [typeCulte, setTypeCulte] = useState(event.type_culte || '')
  const [notes, setNotes] = useState(event.notes || '')
  const [saving, setSaving] = useState(false)

  // Heure suggérée (auto)
  const heureAuto = defaultHeure(date)
  const isDimanche = date && getJourSemaine(date) === 0

  async function handleSubmit() {
    if (!nom.trim()) return
    setSaving(true)
    const heureFinal = heure.trim() || heureAuto
    await onSave({
      nom: nom.trim(),
      date: date || null,
      heure: heureFinal,
      type_culte: typeCulte.trim() || null,
      notes: notes.trim() || null,
    })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 430, margin: '0 auto', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 16px' }} />
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', marginBottom: 20 }}>Modifier l'événement</h3>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--texte-sec)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>
            Nom *
          </label>
          <input
            type="text"
            value={nom}
            onChange={e => setNom(e.target.value)}
            placeholder="Culte du dimanche…"
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--card)', color: 'var(--texte)',
              fontSize: '0.95rem', fontFamily: 'var(--font-ui)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--texte-sec)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--card)', color: 'var(--texte)',
                fontSize: '0.95rem', fontFamily: 'var(--font-ui)',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--texte-sec)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>
              Heure
            </label>
            <input
              type="time"
              value={heure}
              onChange={e => setHeure(e.target.value)}
              placeholder={heureAuto}
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--card)', color: 'var(--texte)',
                fontSize: '0.95rem', fontFamily: 'var(--font-ui)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
        {!heure && (
          <p style={{ fontSize: '0.72rem', color: 'var(--texte-ter)', marginTop: -10, marginBottom: 14, fontStyle: 'italic' }}>
            Si laissé vide, l'heure sera fixée à {heureAuto} ({isDimanche ? 'dimanche' : 'jour de semaine'}).
          </p>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--texte-sec)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>
            Type de culte
          </label>
          <input
            type="text"
            value={typeCulte}
            onChange={e => setTypeCulte(e.target.value)}
            placeholder="Culte du soir, répétition, concert…"
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--card)', color: 'var(--texte)',
              fontSize: '0.95rem', fontFamily: 'var(--font-ui)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--texte-sec)', marginBottom: 6, fontFamily: 'var(--font-ui)' }}>
            Notes
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes éventuelles…"
            rows={3}
            style={{
              width: '100%', padding: '10px 12px',
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--card)', color: 'var(--texte)',
              fontSize: '0.9rem', fontFamily: 'var(--font-ui)',
              boxSizing: 'border-box', resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-outline"
            onClick={onClose}
            disabled={saving}
            style={{ flex: 1 }}
          >
            Annuler
          </button>
          <button
            className="btn"
            onClick={handleSubmit}
            disabled={saving || !nom.trim()}
            style={{
              flex: 1,
              background: 'var(--bleu-principal)',
              color: '#fff',
              opacity: (saving || !nom.trim()) ? 0.5 : 1,
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddSongModal({ eventId, existingIds, onClose, onSaved, onError, nextOrdre }) {
  const [songs, setSongs] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('chants').select('id, titre, categorie, tonalite').order('titre').then(({ data, error }) => {
      if (error) {
        console.error('[AddSongModal] Erreur chargement chants :', error)
        if (onError) onError(`Chargement chants : ${error.message}`)
      }
      setSongs(data || [])
      setLoading(false)
    })
  }, [])

  async function addSong(song) {
    const { error } = await supabase
      .from('evenement_chants')
      .insert([{ evenement_id: eventId, chant_id: song.id, ordre: nextOrdre, tonalite_jour: song.tonalite }])

    if (error) {
      console.error('[addSong] Erreur Supabase :', error)
      if (onError) onError(`Ajout impossible : ${error.message}`)
      return
    }
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
