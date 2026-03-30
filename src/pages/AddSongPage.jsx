import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['Adoration', 'Louange', 'Combat', 'Victoire', 'Parvis']
const TONALITES = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si',
                   'Dom', 'Do#m', 'Rém', 'Ré#m', 'Mim', 'Fam', 'Fa#m', 'Solm', 'Sol#m', 'Lam', 'La#m', 'Sim']

export default function AddSongPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    titre: '', categorie: '', tonalite: '', bpm: '', lead: '',
    paroles: '', accords: '',
    pupitre_soprano: '', pupitre_alto: '', pupitre_tenor: '', pupitre_basse: '',
    pupitre_clavier: '', pupitre_guitare: '', pupitre_batterie: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    const { data, error } = await supabase.from('chants').insert([form]).select().single()
    setSaving(false)
    if (!error) navigate(`/repertoire/${data.id}`)
    else alert('Erreur lors de l\'enregistrement : ' + error.message)
  }

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
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <button key={cat} type="button"
                  onClick={() => set('categorie', form.categorie === cat ? '' : cat)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)',
                    cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-ui)',
                    background: form.categorie === cat ? 'var(--bleu-principal)' : 'var(--card)',
                    color: form.categorie === cat ? '#fff' : 'var(--texte)',
                    transition: 'all 0.2s',
                  }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

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
            { label: 'Soprano', key: 'pupitre_soprano' },
            { label: 'Alto',    key: 'pupitre_alto' },
            { label: 'Ténor',   key: 'pupitre_tenor' },
            { label: 'Basse',   key: 'pupitre_basse' },
            { label: 'Clavier', key: 'pupitre_clavier' },
            { label: 'Guitare', key: 'pupitre_guitare' },
            { label: 'Batterie',key: 'pupitre_batterie' },
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
