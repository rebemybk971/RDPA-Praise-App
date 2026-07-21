import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { supabase } from '../lib/supabase'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const TONALITES = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si']
const PUPITRES = ['soprano', 'alto', 'tenor', 'basse', 'clavier', 'guitare', 'batterie']

let blocUidCounter = 0
function newBlocId() {
  return `bloc-${blocUidCounter++}`
}

const NOMS_BLOCS = [
  'Couplet 1', 'Couplet 2', 'Couplet 3', 'Couplet 4',
  'Pré-refrain',
  'Refrain', 'Refrain 1', 'Refrain 2', 'Refrain 3', 'Refrain 4',
  'Pont', 'Intro', 'Outro', 'Verset', 'Chorus', 'Bridge'
]

// Reconstruit la liste des blocs à partir du texte stocké en base ([Couplet 1]\n...\n\n[Refrain]\n...)
function parseParoles(texte) {
  if (!texte || !texte.trim()) return [{ nom: 'Couplet 1', contenu: '' }]
  const regex = /\[([^\]]+)\]\n?([\s\S]*?)(?=\n\[|$)/g
  const blocs = []
  let match
  while ((match = regex.exec(texte)) !== null) {
    blocs.push({ nom: match[1].trim(), contenu: match[2].trim() })
  }
  if (blocs.length === 0) {
    return [{ nom: 'Paroles', contenu: texte.trim() }]
  }
  return blocs
}

// Retourne un dictionnaire { nomBloc → accords } à partir du champ accords stocké en base
function parseAccordsMap(texte) {
  if (!texte || !texte.trim()) return {}
  const regex = /\[([^\]]+)\]\n?([\s\S]*?)(?=\n\[|$)/g
  const map = {}
  let match
  while ((match = regex.exec(texte)) !== null) {
    map[match[1].trim()] = match[2].trim()
  }
  return map
}

export default function AddSongPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const modeEdition = Boolean(id)

  const [etape, setEtape] = useState(1)
  const [categories, setCategories] = useState([])
  const [nouvelleCategorie, setNouvelleCategorie] = useState('')
  const [ajouterCategorie, setAjouterCategorie] = useState(false)
  const [importEnCours, setImportEnCours] = useState(false)
  const [chargementChant, setChargementChant] = useState(modeEdition)

  const [infos, setInfos] = useState({
    titre: '',
    auteur: '',
    categorie: '',
    tonalite: 'Do',
    bpm: 80,
  })

  const [paroles, setParoles] = useState(() => [
    { nom: 'Couplet 1', contenu: '', accords: '', id: newBlocId() }
  ])
  const [showAccordsInput, setShowAccordsInput] = useState(false)

  const [pupitres, setPupitres] = useState({
    soprano: '', alto: '', tenor: '', basse: '',
    clavier: '', guitare: '', batterie: ''
  })

  const [erreur, setErreur] = useState('')
  const [sauvegarde, setSauvegarde] = useState(false)

  useEffect(() => {
    chargerCategories()
    if (modeEdition) {
      chargerChantExistant()
    }
  }, [id])

  async function chargerCategories() {
    const { data } = await supabase.from('categories').select('*').order('nom')
    if (data) setCategories(data)
  }

  async function chargerChantExistant() {
    try {
      const { data, error } = await supabase.from('chants').select('*').eq('id', id).single()
      if (error) {
        console.error('[AddSongPage] Erreur chargement chant :', error)
        setErreur('Impossible de charger ce chant : ' + error.message)
        setChargementChant(false)
        return
      }
      if (!data) {
        setErreur('Chant introuvable.')
        setChargementChant(false)
        return
      }
      setInfos({
        titre: data.titre || '',
        auteur: data.auteur || '',
        categorie: data.categorie || '',
        tonalite: data.tonalite || 'Do',
        bpm: data.bpm || 80,
      })
      const blocsParoles = parseParoles(data.paroles)
      const accordsMap = parseAccordsMap(data.accords)
      const blocsAvecAccords = blocsParoles.map(b => ({ ...b, accords: accordsMap[b.nom] || '', id: newBlocId() }))
      setParoles(blocsAvecAccords)
      if (blocsAvecAccords.some(b => b.accords)) setShowAccordsInput(true)
      setPupitres({
        soprano: data.pupitre_soprano || '',
        alto: data.pupitre_alto || '',
        tenor: data.pupitre_tenor || '',
        basse: data.pupitre_basse || '',
        clavier: data.pupitre_clavier || '',
        guitare: data.pupitre_guitare || '',
        batterie: data.pupitre_batterie || '',
      })
      setChargementChant(false)
    } catch (err) {
      console.error('[AddSongPage] Exception chargement chant :', err)
      setErreur('Erreur inattendue : ' + err.message)
      setChargementChant(false)
    }
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
    setParoles(prev => [...prev, { nom: 'Couplet ' + (prev.length + 1), contenu: '', accords: '', id: newBlocId() }])
  }

  function supprimerBloc(index) {
    setParoles(prev => prev.filter((_, i) => i !== index))
  }

  function modifierBloc(index, champ, valeur) {
    setParoles(prev => prev.map((b, i) => i === index ? { ...b, [champ]: valeur } : b))
  }

  function onDragEndParoles(result) {
    if (!result.destination) return
    if (result.destination.index === result.source.index) return
    setParoles(prev => {
      const items = Array.from(prev)
      const [moved] = items.splice(result.source.index, 1)
      items.splice(result.destination.index, 0, moved)
      return items
    })
  }

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

        texteComplet = texteComplet
          .replace(/[^\x20-\x7E\xA0-\xFF\u00C0-\u024F\u2018\u2019\u201C\u201D\n\r]/g, '')
          .replace(/\s+\n/g, '\n')
          .trim()

        if (texteComplet) {
          setParoles([{ nom: 'Paroles importées', contenu: texteComplet, accords: '', id: newBlocId() }])
        } else {
          setErreur('Le PDF ne contient pas de texte lisible. Essaie de copier-coller les paroles directement.')
        }

      } else if (fichier.type === 'text/plain') {
        const texte = await fichier.text()
        setParoles([{ nom: 'Paroles importées', contenu: texte.trim(), accords: '', id: newBlocId() }])

      } else {
        setErreur('Format non supporté. Utilise un PDF avec du texte, ou colle les paroles directement.')
      }
    } catch (err) {
      console.error('Erreur import:', err)
      setErreur('Impossible de lire ce fichier. Colle les paroles directement dans la zone de texte.')
    }

    setImportEnCours(false)
  }

  async function sauvegarder() {
    if (!infos.titre.trim()) {
      setErreur('Le titre est obligatoire.')
      return
    }

    const parolesTexte = paroles
      .map(b => `[${b.nom}]\n${b.contenu}`)
      .join('\n\n')

    const accordsTexte = paroles.some(b => b.accords?.trim())
      ? paroles.filter(b => b.accords?.trim()).map(b => `[${b.nom}]\n${b.accords}`).join('\n\n')
      : null

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
      accords: accordsTexte,
      ...Object.fromEntries(
        PUPITRES.map(p => [`pupitre_${p}`, pupitres[p].trim() || null])
      )
    }

    let error
    if (modeEdition) {
      const res = await supabase.from('chants').update(donnees).eq('id', id)
      error = res.error
    } else {
      const res = await supabase.from('chants').insert(donnees)
      error = res.error
    }

    if (error) {
      console.error('Erreur sauvegarde:', error)
      setErreur('Erreur lors de la sauvegarde : ' + error.message)
    } else {
      setSauvegarde(true)
      setTimeout(() => {
        if (modeEdition) {
          navigate(`/repertoire/${id}`)
        } else {
          navigate('/repertoire')
        }
      }, 1500)
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

  if (chargementChant) {
    return (
      <div style={styles.page}>
        <div className="loading">Chargement du chant…</div>
      </div>
    )
  }

  if (sauvegarde) {
    return (
      <div style={styles.page}>
        <div style={styles.succes}>
          ✅ {modeEdition ? 'Chant modifié avec succès !' : 'Chant enregistré avec succès !'} Redirection…
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.titre}>{modeEdition ? 'Modifier le chant' : 'Ajouter un chant'}</h1>

      <div style={styles.etapes}>
        {[1,2,3].map(n => (
          <button key={n} style={styles.etapeBouton(n)} onClick={() => setEtape(n)}>
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
              <input type="number" min="40" max="220" value={infos.bpm}
                onChange={e => setInfos(p => ({...p, bpm: e.target.value === '' ? '' : Number(e.target.value)}))}
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
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary, #555)' }}>Blocs de paroles</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowAccordsInput(v => !v)}
                style={{ ...styles.boutonSecondaire, fontSize: '13px', background: showAccordsInput ? '#EEF4F8' : 'transparent', padding: '6px 12px' }}
              >
                {showAccordsInput ? '♩ Masquer accords' : '♩ Saisir les accords'}
              </button>
              <label style={{ ...styles.boutonSecondaire, display: 'inline-block', cursor: 'pointer', fontSize: '13px' }}>
                {importEnCours ? '⏳ Import...' : '📄 Importer'}
                <input type="file" accept=".pdf,.txt" onChange={importerFichier} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
          {erreur && <div style={styles.erreur}>{erreur}</div>}
          <DragDropContext onDragEnd={onDragEndParoles}>
            <Droppable droppableId="paroles-blocs">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {paroles.map((bloc, i) => (
                    <Draggable key={bloc.id} draggableId={bloc.id} index={i}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          style={{
                            ...styles.bloc,
                            opacity: snapshot.isDragging ? 0.7 : 1,
                            boxShadow: snapshot.isDragging ? '0 8px 24px rgba(0,0,0,0.15)' : undefined,
                            ...provided.draggableProps.style,
                          }}
                        >
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                            {paroles.length > 1 && (
                              <span
                                {...provided.dragHandleProps}
                                style={{ cursor: 'grab', color: '#ccc', fontSize: '1rem', padding: '0 2px', lineHeight: 1, userSelect: 'none' }}
                                title="Déplacer"
                              >⠿</span>
                            )}
                            <select value={bloc.nom} onChange={e => modifierBloc(i, 'nom', e.target.value)}
                              style={{ ...styles.select, flex: 1 }}>
                              {NOMS_BLOCS.map(n => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                              {!NOMS_BLOCS.includes(bloc.nom) && (
                                <option key={bloc.nom} value={bloc.nom}>{bloc.nom}</option>
                              )}
                            </select>
                            {paroles.length > 1 && (
                              <button onClick={() => supprimerBloc(i)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '16px' }}>✕</button>
                            )}
                          </div>
                          {showAccordsInput && (
                            <textarea
                              value={bloc.accords}
                              onChange={e => modifierBloc(i, 'accords', e.target.value)}
                              placeholder="Accords (alignés avec les paroles)&#10;Ex : G    Am   F    C"
                              style={{ ...styles.textarea, fontFamily: 'DM Mono, monospace', fontSize: '0.82rem', minHeight: '64px', lineHeight: '1.7', marginBottom: '4px', background: '#EEF4F8', color: '#1A5E8A' }}
                            />
                          )}
                          <textarea style={styles.textarea} value={bloc.contenu} onChange={e => modifierBloc(i, 'contenu', e.target.value)} placeholder="Paroles..." />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
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
            ✅ {modeEdition ? 'Enregistrer les modifications' : 'Enregistrer le chant'}
          </button>
          <button style={{ ...styles.boutonSecondaire, marginTop: '8px', width: '100%', textAlign: 'center' }} onClick={() => setEtape(2)}>
            ← Retour
          </button>
        </div>
      )}
    </div>
  )
}
