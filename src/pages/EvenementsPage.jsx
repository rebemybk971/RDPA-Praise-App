import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function EvenementsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { fetchEvents() }, [])

  async function fetchEvents() {
    const { data } = await supabase
      .from('evenements')
      .select('*, evenement_chants(count)')
      .order('date', { ascending: false })
    setEvents(data || [])
    setLoading(false)
  }

  return (
    <>
      {showAdd && <AddEventModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); fetchEvents() }} />}

      {loading ? (
        <div className="loading">Chargement…</div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">📅</div>
          <p>Aucun événement pour l'instant.<br/>Créez votre premier culte !</p>
        </div>
      ) : (
        events.map(ev => (
          <Link key={ev.id} to={`/evenements/${ev.id}`} className="song-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--texte)' }}>{ev.nom}</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--texte-sec)', marginTop: 2 }}>
                  {ev.date && new Date(ev.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <button
                onClick={e => { e.preventDefault(); navigate(`/evenements/${ev.id}/jour-j`) }}
                style={{ background: 'var(--bleu-principal)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                🎤 Jour J
              </button>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--texte-sec)' }}>
              {ev.lead && <span>Lead : {ev.lead}</span>}
              {ev.type_culte && <span>· {ev.type_culte}</span>}
              {ev.evenement_chants?.[0]?.count > 0 && <span>· {ev.evenement_chants[0].count} chant(s)</span>}
            </div>
          </Link>
        ))
      )}

      <button className="fab" onClick={() => setShowAdd(true)}>＋</button>
    </>
  )
}

function AddEventModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ nom: '', date: '', type_culte: '', lead: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.nom.trim()) return
    setSaving(true)
    const { error } = await supabase.from('evenements').insert([form])
    setSaving(false)
    if (!error) onSaved()
    else alert('Erreur : ' + error.message)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 430, margin: '0 auto' }}>
        <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 20px' }} />
        <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.3rem', marginBottom: 16 }}>Nouvel événement</h3>

        <div className="form-group">
          <label className="form-label">Nom *</label>
          <input className="form-input" value={form.nom} onChange={e => set('nom', e.target.value)} placeholder="Culte du dimanche" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <input className="form-input" value={form.type_culte} onChange={e => set('type_culte', e.target.value)} placeholder="Culte, Jeunesse…" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Lead</label>
          <input className="form-input" value={form.lead} onChange={e => set('lead', e.target.value)} placeholder="Nom du lead" />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving || !form.nom.trim()}>
            {saving ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}
