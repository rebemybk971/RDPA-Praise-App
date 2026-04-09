import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const TONALITES = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si']
const PUPITRES = ['soprano', 'alto', 'tenor', 'basse', 'clavier', 'guitare', 'batterie']

export default function AddSongPage() {
  const navigate = useNavigate()
  const [etape, setEtape] = useState(1)
  const [categories, setCategories] = useState([])
  const [nouvelleCategorie, setNouvelleCategorie] = useState('')
  const [ajouterCategorie, setAjouterCategorie] = useState(false)
  const [importEnCours, setImportEnCours] = useState(false)

  const [infos, setInfos] = useState({
    titre: '',
    auteur: '',
    categorie: '',
    tonalite: 'Do',
    bpm: 80,
  })

  const [paroles, setParoles] = useState([
    { nom: 'Couplet 1', contenu: '' }
  ])

  const [pupitres, setPupitres] = useState({
    soprano: '', alto: '', tenor: '', basse: '',
    clavier: '', guitare: '', batterie: ''
  })

  const [erreur, setErreur] = useState('')
  const [sauvegarde, setSauvegarde] = useState(false)

  useEffect(() => {
    chargerCategories()
  }, [])

  async function chargerCategories() {
    const { data } = await supabase.from('categories').select('*').order('nom')
    if (data) setCategories(data)
  }

  async function ajouterNouvelleCategorie() {
    if (!nouvelleCategorie.trim()) return
    const { error } = await supabase.from('categories').insert({ nom: nouvelleCategorie.trim() })
    if (!error) {
      await chargerCategories()
      setInfos(prev => ({ ...prev, categorie: nouvelleCategorie.trim() }))
      setNouvelleCategorie('')
      setAjouterCategorie(false)
    }
  }

  function ajouterBloc() {
    const noms = ['Couplet', 'Refrain', 'Pont', 'Intro', 'Outro', 'Verset', 'Chorus', 'Bridge']
    const nomAuto = noms[paroles.length % noms.length] + (paroles.length >= noms.length ? ' ' + Math.floor(paroles.length / noms.length + 1) : ' ' + (paroles.filter(p => p.nom.startsWith(noms[paroles.length % noms.length])).length + 1))
    setParoles(prev => [...prev, { nom: nomAuto, contenu: '' }])
  }

  function supprimerBloc(index) {
    setParoles(prev => prev.filter((_, i) => i !== index))
  }

  function modifierBloc(index, champ, valeur) {
    setParoles(prev => prev.map((b, i) => i === index ? { ...b, [champ]: valeur } : b))
  }

  // ✅ CORRECTION BUG 4 — Import PDF : extraction texte lisible uniquement
  async function importerFichier(e) {
    const fichier = e.target.files[0]
    if (!fichier) return
    setImportEnCours(true)
    setErreur('')

    try {
      if (fichier.type === 'application/pdf') {
        const arrayBuffer = await fichier.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        let texteComplet = ''

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const contenu = await page.getTextContent()
          const textePage = contenu.items
            .map(item => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()
          if (textePage) texteComplet += textePage + '\n\n'
        }

        // Nettoyage des caractères spéciaux problématiques pour Supabase
        texteComplet = texteComplet
          .replace(/[^\x20-\x7E\xA0-\xFF\u00C0-\u024F\u2018\u2019\u201C\u201D\n\r]/g, '')
          .replace(/\s+\n/g, '\n')
          .trim()

        if (texteComplet) {
          setParoles([{ nom: 'Paroles importées', contenu: texteComplet }])
        } else {
          setErreur('Le PDF ne contient pas de texte lisible. Essaie de copier-coller les paroles directement.')
        }

      } else if (fichier.type === 'text/plain') {
        const texte = await fichier.text()
        setParoles([{ nom: 'Paroles importées', contenu: texte.trim() }])

      } else {
        setErreur('Format non supporté. Utilise un PDF avec du texte, ou colle les paroles directement.')
      }
    } catch (err) {
      console.error('Erreur import:', err)
      setErreur('Impossible de lire ce fichier. Colle les paroles directement dans la zone de texte.')
    }

    setImportEnCours(false)
  }

  // ✅ CORRECTION BUG 5 — BPM vide : valeur par défaut 80, jamais de chaîne vide
  async function sauvegarder() {
    if (!infos.titre.trim()) {
      setErreur('Le titre est obligatoire.')
      return
    }

    const parolesTexte = paroles
      .map(b => `[${b.nom}]\n${b.contenu}`)
      .join('\n\n')

    const bpmFinal = infos.bpm === '' || infos.bpm === null || isNaN(Number(infos.bpm))
      ? 80
      : Number(infos.bpm)

    const donnees = {
      titre: infos.titre.trim(),
      auteur: infos.auteur.trim() || null,
      categorie: infos.categorie || null,
      tonalite: infos.tonalite || null,
      bpm: bpmFinal,
      paroles: parolesTexte || null,
      ...Object.fromEntries(
        PUPITRES.map(p => [`pupitre_${p}`, pupitres[p].trim() || null])
      )
    }

    const { error } = await supabase.from('chants').insert(donnees)

    if (error) {
      console.error('Erreur sauvegarde:', error)
      setErreur('Erreur lors de la sauvegarde : ' + error.message)
    } else {
      setSauvegarde(true)
      setTimeout(() => navigate('/repertoire'), 1500)
    }
  }

  const styles = {
    page: { padding: '1rem', maxWidth: '600px', margin: '0 auto', fontFamily: 'DM Sans, sans-serif' },
    titre: { fontSize: '1.4rem', fontWeight: '600', marginBottom: '1.5rem', color: 'var(--color-text-primary, #1a1a1a)' },
    etapes: { display: 'flex', gap: '8px', marginBottom: '1.5rem' },
    etapeBouton: (n) => ({
      flex: 1, padding: '8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
      background: etape === n ? '#4BBFE8' : etape > n ? '#A8DDF2' : '#EEF4F8',
      color: etape === n ? 'white' : '#1A7BAF', fontWeight: etape === n ? '600' : '400',
      fontSize: '13px'
    }),
    label: { display: 'block', marginBottom: '4px', fontSize: '13px', color: 'var(--color-text-secondary, #555)' },
    input: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d0e4ef', fontSize: '14px', boxSizing: 'border-box', background: 'var(--color-background-primary, white)', color: 'var(--color-text-primary, #1a1a1a)' },
    select: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d0e4ef', fontSize: '14px', boxSizing: 'border-box', background: 'var(--color-background-primary, white)', color: 'var(--color-text-primary, #1a1a1a)' },
    textarea: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #d0e4ef', fontSize: '14px', minHeight: '120px', boxSizing: 'border-box', fontFamily: 'Cormorant Garamond, serif', lineHeight: '1.8', background: 'var(--color-background-primary, white)', color: 'var(--color-text-primary, #1a1a1a)', resize: 'vertical' },
    champ: { marginBottom: '1rem' },
    boutonPrincipal: { background: '#4BBFE8', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '10px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', width: '100%', marginTop: '1rem' },
    boutonSecondaire: { background: 'transparent', color: '#4BBFE8', border: '1.5px solid #4BBFE8', padding: '10px 20px', borderRadius: '10px', fontSize: '14px', cursor: 'pointer' },
    erreur: { background: '#FEF0E6', color: '#A0521A', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginTop: '8px' },
    succes: { background: '#EAF4FA', color: '#1A5E8A', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', textAlign: 'center', fontWeight: '500' },
    categoriesRangee: { display: 'flex', flexDirection: 'row', overflowX: 'auto', gap: '8px', paddingBottom: '4px', whiteSpace: 'nowrap', marginTop: '6px' },
    categoriePilule: (selected) => ({ padding: '5px 14px', borderRadius: '20px', border: '1.5px solid', cursor: 'pointer', fontSize: '13px', fontWeight: selected ? '600' : '400', background: selected ? '#4BBFE8' : '#EEF4F8', color: selected ? 'white' : '#1A7BAF', borderColor: selected ? '#4BBFE8' : '#A8DDF2', flexShrink: 0 }),
    bloc: { background: '#F4F9FC', borderRadius: '10px', padding: '12px', marginBottom: '12px', border: '1px solid #d0e4ef' },
    bpmRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  }

  if (sauvegarde) {
    return (
      <div style={styles.page}>
        <div style={styles.succes}>✅ Chant enregistré avec succès ! Retour au répertoire...</div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.titre}>Ajouter un chant</h1>

      <div style={styles.etapes}>
        {[1,2,3].map(n => (
          <button key={n} style={styles.etapeBouton(n)} onClick={() => n < etape && setEtape(n)}>
            {n === 1 ? '1 · Infos' : n === 2 ? '2 · Paroles' : '3 · Pupitres'}
          </button>
        ))}
      </div>

      {/* ÉTAPE 1 — Informations */}
      {etape === 1 && (
        <div>
          <div style={styles.champ}>
            <label style={styles.label}>Titre *</label>
            <input style={styles.input} value={infos.titre} onChange={e => setInfos(p => ({...p, titre: e.target.value}))} placeholder="Titre du chant" />
          </div>
          <div style={styles.champ}>
            <label style={styles.label}>Auteur / Compositeur</label>
            <input style={styles.input} value={infos.auteur} onChange={e => setInfos(p => ({...p, auteur: e.target.value}))} placeholder="Nom de l'auteur" />
          </div>
          <div style={styles.champ}>
            <label style={styles.label}>Catégorie</label>
            <div style={styles.categoriesRangee}>
              {categories.map(c => (
                <button key={c.id} style={styles.categoriePilule(infos.categorie === c.nom)} onClick={() => setInfos(p => ({...p, categorie: p.categorie === c.nom ? '' : c.nom}))}>
                  {c.nom}
                </button>
              ))}
              <button style={styles.categoriePilule(false)} onClick={() => setAjouterCategorie(true)}>+ Nouvelle</button>
            </div>
            {ajouterCategorie && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input style={{ ...styles.input, flex: 1 }} value={nouvelleCategorie} onChange={e => setNouvelleCategorie(e.target.value)} placeholder="Nom de la catégorie" autoFocus />
                <button style={styles.boutonSecondaire} onClick={ajouterNouvelleCategorie}>Ajouter</button>
                <button style={{ ...styles.boutonSecondaire, color: '#999', borderColor: '#ccc' }} onClick={() => setAjouterCategorie(false)}>✕</button>
              </div>
            )}
          </div>
          <div style={styles.champ}>
            <label style={styles.label}>Tonalité</label>
            <select style={styles.select} value={infos.tonalite} onChange={e => setInfos(p => ({...p, tonalite: e.target.value}))}>
              {TONALITES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={styles.champ}>
            <label style={styles.label}>BPM (tempo) — {infos.bpm} bpm</label>
            <div style={styles.bpmRow}>
              <input type="range" min="40" max="220" value={infos.bpm || 80}
                onChange={e => setInfos(p => ({...p, bpm: Number(e.target.value)}))}
                style={{ flex: 1 }} />
              <input type="number" min="40" max="220" value={infos.bpm || 80}
                onChange={e => setInfos(p => ({...p, bpm: e.target.value === '' ? 80 : Number(e.target.value)}))}
                style={{ ...styles.input, width: '70px' }} />
            </div>
          </div>
          {erreur && <div style={styles.erreur}>{erreur}</div>}
          <button style={styles.boutonPrincipal} onClick={() => { setErreur(''); setEtape(2) }}>
            Suivant → Paroles
          </button>
        </div>
      )}

      {/* ÉTAPE 2 — Paroles */}
      {etape === 2 && (
        <div>
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary, #555)' }}>Blocs de paroles</span>
            <label style={{ ...styles.boutonSecondaire, display: 'inline-block', cursor: 'pointer', fontSize: '13px' }}>
              {importEnCours ? '⏳ Import...' : '📄 Importer un fichier'}
              <input type="file" accept=".pdf,.txt" onChange={importerFichier} style={{ display: 'none' }} />
            </label>
          </div>
          {erreur && <div style={styles.erreur}>{erreur}</div>}
          {paroles.map((bloc, i) => (
            <div key={i} style={styles.bloc}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                <select value={bloc.nom} onChange={e => modifierBloc(i, 'nom', e.target.value)}
                  style={{ ...styles.select, flex: 1 }}>
                  {['Couplet 1','Couplet 2','Couplet 3','Refrain','Pont','Intro','Outro','Verset','Chorus','Bridge'].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                {paroles.length > 1 && (
                  <button onClick={() => supprimerBloc(i)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                )}
              </div>
              <textarea style={styles.textarea} value={bloc.contenu} onChange={e => modifierBloc(i, 'contenu', e.target.value)} placeholder="Paroles..." />
            </div>
          ))}
          <button style={styles.boutonSecondaire} onClick={ajouterBloc}>+ Ajouter un bloc</button>
          <button style={styles.boutonPrincipal} onClick={() => { setErreur(''); setEtape(3) }}>
            Suivant → Pupitres
          </button>
          <button style={{ ...styles.boutonSecondaire, marginTop: '8px', width: '100%', textAlign: 'center' }} onClick={() => setEtape(1)}>
            ← Retour
          </button>
        </div>
      )}

      {/* ÉTAPE 3 — Pupitres */}
      {etape === 3 && (
        <div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary, #555)', marginBottom: '1rem' }}>
            Colle un lien YouTube, Google Drive, ou Dropbox pour chaque pupitre.
          </p>
          {PUPITRES.map(p => (
            <div key={p} style={styles.champ}>
              <label style={styles.label}>{p.charAt(0).toUpperCase() + p.slice(1)}</label>
              <input style={styles.input} value={pupitres[p]} onChange={e => setPupitres(prev => ({...prev, [p]: e.target.value}))} placeholder={`Lien pour ${p}`} />
            </div>
          ))}
          {erreur && <div style={styles.erreur}>{erreur}</div>}
          <button style={styles.boutonPrincipal} onClick={sauvegarder}>
            ✅ Enregistrer le chant
          </button>
          <button style={{ ...styles.boutonSecondaire, marginTop: '8px', width: '100%', textAlign: 'center' }} onClick={() => setEtape(2)}>
            ← Retour
          </button>
        </div>
      )}
    </div>
  )
}
