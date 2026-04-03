import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

const TONALITES = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si',
                   'Dom', 'Do#m', 'Rém', 'Ré#m', 'Mim', 'Fam', 'Fa#m', 'Solm', 'Sol#m', 'Lam', 'La#m', 'Sim']

export default function AddSongPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [catMap, setCatMap] = useState(DEFAULT_CATS)
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState(COLOR_OPTIONS[5])
  const [savingCat, setSavingCat] = useState(false)
  const [form, setForm] = useState({
    titre: '', categorie: '', tonalite: '', bpm: '', lead: '',
    paroles: '', accords: '',
    pupitre_soprano: '', pupitre_alto: '', pupitre_tenor: '', pupitre_basse: '',
    pupitre_clavier: '', pupitre_guitare: '', pupitre_batterie: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    fetchCategories()
  }, [])

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
      set('categorie', newCatName.trim())
      setNewCatName('')
      setNewCatColor(COLOR_OPTIONS[5])
      setShowNewCat(false)
    }
    setSavingCat(false)
  }

  async function save() {
    setSaving(true)
    const { data, error } = await supabase.from('chants').insert([form]).select().single()
    setSaving(false)
    if (!error) navigate(`/repertoire/${data.id}`)
    else alert('Erreur lors de l\'enregistrement : ' + error.message)
  }

  const categories = Object.keys(catMap)

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => step === 1 ? navigate(-1) : setStep(s => s - 1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-sec)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-ui)', fontSize: '0.85rem', marginBottom: 12 }}>
          ← {step === 1 ? 'Annuler' : 'Retour'}
        </button>
        <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '1.4rem', fontWeight: 600 }}>Ajouter un chant</h2>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          {['Infos', 'Paroles', 'Pupitres'].map((label, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 3, borderRadius: 2, background: step > i ? 'var(--bleu-principal)' : 'var(--border)', marginBottom: 4, transition: 'background 0.3s' }} />
              <span style={{ fontSize: '0.7rem', color: step === i + 1 ? 'var(--bleu-principal)' : 'var(--texte-ter)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Infos */}
      {step === 1 && (
        <>
          <div className="form-group">
            <label className="form-label">Titre *</label>
            <input className="form-input" value={form.titre} onChange={e => set('titre', e.target.value)} placeholder="Nom du chant" />
          </div>

          <div className="form-group">
            <label className="form-label">Catégorie</label>
            <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: 8, paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
              {categories.map(cat => (
                <button key={cat} type="button"
                  onClick={() => set('categorie', form.categorie === cat ? '' : cat)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)',
                    cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-ui)',
                    background: form.categorie === cat
                      ? (catMap[cat]?.bg || 'var(--bleu-principal)')
                      : 'var(--card)',
                    color: form.categorie === cat
                      ? (catMap[cat]?.tx || '#fff')
                      : 'var(--texte)',
                    transition: 'all 0.2s',
                  }}>
                  {cat}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowNewCat(v => !v)}
                style={{
                  flexShrink: 0,
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
                  <button key={i} type="button"
                    onClick={() => setNewCatColor(c)}
                    style={{
                      width: 24, height: 24, borderRadius: '50%',
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
                    background: newCatColor.bg, color: newCatColor.tx,
                    borderRadius: 20, padding: '3px 12px',
                    fontSize: '0.82rem', fontWeight: 600,
                  }}>{newCatName}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleAddCategory} disabled={!newCatName.trim() || savingCat}
                  style={{
                    background: 'var(--bleu-principal)', color: '#fff',
                    border: 'none', borderRadius: 8, padding: '8px 16px',
                    fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600,
                  }}>
                  {savingCat ? 'Enregistrement…' : 'Créer'}
                </button>
                <button onClick={() => { setShowNewCat(false); setNewCatName('') }}
                  style={{
                    background: 'none', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '8px 16px',
                    fontSize: '0.85rem', cursor: 'pointer', color: 'var(--texte-sec)',
                  }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Tonalité</label>
              <select className="form-input" value={form.tonalite} onChange={e => set('tonalite', e.target.value)}>
                <option value="">—</option>
                {TONALITES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">BPM</label>
              <input className="form-input" type="number" value={form.bpm} onChange={e => set('bpm', e.target.value)} placeholder="120" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Lead</label>
            <input className="form-input" value={form.lead} onChange={e => set('lead', e.target.value)} placeholder="Nom du lead" />
          </div>

          <button className="btn btn-primary btn-full" onClick={() => setStep(2)} disabled={!form.titre.trim()}>
            Suivant → Paroles
          </button>
        </>
      )}

      {/* Step 2: Paroles */}
      {step === 2 && (
        <>
          <div className="form-group">
            <label className="form-label">Paroles</label>
            <textarea className="form-input" value={form.paroles} onChange={e => set('paroles', e.target.value)}
              placeholder="Saisissez les paroles ici…&#10;&#10;Utilisez des lignes vides pour séparer les couplets et refrains." style={{ minHeight: 200 }} />
          </div>

          <div className="form-group">
            <label className="form-label">Grille d'accords</label>
            <textarea className="form-input" value={form.accords} onChange={e => set('accords', e.target.value)}
              placeholder="Ex : Couplet : Do - Sol - Lam - Fa&#10;Refrain : Fa - Do - Sol" style={{ minHeight: 100, fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }} />
          </div>

          <button className="btn btn-primary btn-full" onClick={() => setStep(3)}>
            Suivant → Pupitres
          </button>
        </>
      )}

      {/* Step 3: Pupitres */}
      {step === 3 && (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--texte-sec)', marginBottom: 16 }}>
            Ajoutez des liens YouTube, Google Drive ou Dropbox pour chaque pupitre.
          </p>
          {[
            { label: 'Soprano',  key: 'pupitre_soprano' },
            { label: 'Alto',     key: 'pupitre_alto' },
            { label: 'Ténor',    key: 'pupitre_tenor' },
            { label: 'Basse',    key: 'pupitre_basse' },
            { label: 'Clavier',  key: 'pupitre_clavier' },
            { label: 'Guitare',  key: 'pupitre_guitare' },
            { label: 'Batterie', key: 'pupitre_batterie' },
          ].map(({ label, key }) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <input className="form-input" value={form[key]} onChange={e => set(key, e.target.value)} placeholder="https://…" type="url" />
            </div>
          ))}

          <button className="btn btn-primary btn-full" onClick={save} disabled={saving}>
            {saving ? 'Enregistrement…' : '✓ Enregistrer le chant'}
          </button>
        </>
      )}
    </>
  )
}
