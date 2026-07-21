import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
function formatDateLocale(dateStr, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!dateStr) return ''
  const ymd = String(dateStr).slice(0, 10)
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ''
  const localDate = new Date(y, m - 1, d, 12, 0, 0)
  return localDate.toLocaleDateString('fr-FR', options)
}

// Calcule la périodicité moyenne d'un chant à partir de la liste de ses dates de passage
function calculerPeriodicite(dates) {
  if (!dates || dates.length < 2) return null

  // Trier les dates par ordre croissant
  const tries = [...dates]
    .map(d => {
      const ymd = String(d).slice(0, 10)
      const [y, m, day] = ymd.split('-').map(Number)
      if (!y || !m || !day) return null
      return new Date(y, m - 1, day, 12, 0, 0).getTime()
    })
    .filter(Boolean)
    .sort((a, b) => a - b)

  if (tries.length < 2) return null

  // Calculer les écarts en jours entre chaque date consécutive
  const ecarts = []
  for (let i = 1; i < tries.length; i++) {
    const ecart = (tries[i] - tries[i - 1]) / (1000 * 60 * 60 * 24)
    ecarts.push(ecart)
  }

  // Moyenne
  const moyenneJours = ecarts.reduce((a, b) => a + b, 0) / ecarts.length

  // Format adaptatif
  if (moyenneJours < 14) {
    const j = Math.round(moyenneJours)
    return j <= 1 ? 'quasi chaque jour' : `tous les ${j} jours`
  }
  if (moyenneJours < 56) {  // ~8 semaines
    const sem = Math.round(moyenneJours / 7)
    return sem <= 1 ? 'toutes les semaines' : `toutes les ${sem} semaines`
  }
  const mois = Math.round(moyenneJours / 30)
  return mois <= 1 ? 'tous les mois' : `tous les ${mois} mois`
}

// Calcule la date limite selon la période choisie
function getDateLimit(periode) {
  if (periode === 'tout') return null
  const now = new Date()
  const limit = new Date(now)
  if (periode === '3m') limit.setMonth(now.getMonth() - 3)
  else if (periode === '6m') limit.setMonth(now.getMonth() - 6)
  else if (periode === '1a') limit.setFullYear(now.getFullYear() - 1)
  return limit
}

// Compare une date string (YYYY-MM-DD) à une date limite
function dateInRange(dateStr, dateLimit) {
  if (!dateLimit) return true
  if (!dateStr) return false
  const ymd = String(dateStr).slice(0, 10)
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return false
  const date = new Date(y, m - 1, d, 12, 0, 0)
  return date >= dateLimit
}

export default function HistoriquePage() {
  const [data, setData] = useState([])
  const [chants, setChants] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('cultes')
  const [search, setSearch] = useState('')
  // Sous-onglet de la vue Fréquence
  const [freqView, setFreqView] = useState('top')  // 'top' | 'flop' | 'alpha'
  // Période pour la vue Fréquence
  const [periode, setPeriode] = useState('3m')     // '3m' | '6m' | '1a' | 'tout'

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [rowsRes, chantsRes] = await Promise.all([
      supabase
        .from('evenement_chants')
        .select('*, chants(titre, categorie), evenements(nom, date)')
        .order('created_at', { ascending: false }),
      supabase
        .from('chants')
        .select('id, titre, categorie')
        .order('titre'),
    ])
    if (rowsRes.error) console.error('[HistoriquePage] Erreur evenement_chants :', rowsRes.error)
    if (chantsRes.error) console.error('[HistoriquePage] Erreur chants :', chantsRes.error)
    setData(rowsRes.data || [])
    setChants(chantsRes.data || [])
    setLoading(false)
  }

  // Recherche
  const filtered = data.filter(r =>
    r.chants?.titre?.toLowerCase().includes(search.toLowerCase()) ||
    r.evenements?.nom?.toLowerCase().includes(search.toLowerCase()) ||
    (r.lead || '').toLowerCase().includes(search.toLowerCase())
  )

  // ----- Onglet CULTES -----
  // Groupé par événement, ordre décroissant (récent → ancien) sur la date d'événement
  const groupedArr = (() => {
    const m = new Map()
    for (const row of filtered) {
      const evId = row.evenement_id
      if (!m.has(evId)) m.set(evId, { evenement_id: evId, event: row.evenements, songs: [] })
      m.get(evId).songs.push(row)
    }
    return Array.from(m.values()).sort((a, b) => {
      const da = a.event?.date || ''
      const db = b.event?.date || ''
      return db.localeCompare(da)  // décroissant
    })
  })()

  // ----- Onglet FRÉQUENCE -----
  // On filtre par période en regardant evenements.date
  const dateLimit = getDateLimit(periode)
  const filteredByPeriode = filtered.filter(r => dateInRange(r.evenements?.date, dateLimit))

  // Agrégation par chant_id : compte + liste des dates
  const aggByChant = new Map()
  for (const row of filteredByPeriode) {
    const cid = row.chant_id
    if (!cid) continue
    if (!aggByChant.has(cid)) {
      aggByChant.set(cid, {
        id: cid,
        titre: row.chants?.titre || '—',
        categorie: row.chants?.categorie,
        count: 0,
        dates: [],
      })
    }
    const obj = aggByChant.get(cid)
    obj.count++
    if (row.evenements?.date) obj.dates.push(row.evenements.date)
  }

  // Top + : seulement ceux pris ≥ 1, tri décroissant, 20 max
  const topPlus = Array.from(aggByChant.values())
    .filter(x => x.count >= 1)
    .sort((a, b) => b.count - a.count || a.titre.localeCompare(b.titre))
    .slice(0, 20)

  // Top - : on prend TOUTE la table chants et on regarde leur fréquence sur la période
  const topMoins = chants
    .map(c => {
      const agg = aggByChant.get(c.id)
      return {
        id: c.id,
        titre: c.titre || '—',
        categorie: c.categorie,
        count: agg?.count || 0,
        dates: agg?.dates || [],
      }
    })
    .sort((a, b) => a.count - b.count || a.titre.localeCompare(b.titre))
    .slice(0, 20)

  // A→Z : tout le répertoire trié par titre
  const alpha = chants
    .map(c => {
      const agg = aggByChant.get(c.id)
      return {
        id: c.id,
        titre: c.titre || '—',
        categorie: c.categorie,
        count: agg?.count || 0,
        dates: agg?.dates || [],
      }
    })
    .sort((a, b) => a.titre.localeCompare(b.titre))

  // Pour les barres de progression : la valeur max
  const maxTopPlus = topPlus[0]?.count || 1
  const maxTopMoins = Math.max(...topMoins.map(x => x.count), 1)
  const maxAlpha = Math.max(...alpha.map(x => x.count), 1)

  // ----- Onglet SOLISTES (compte le soliste principal + le 2e soliste des duos) -----
  const solistesInscrits = Object.values(
    filtered.reduce((acc, row) => {
      ;[[row.lead_id, row.lead], [row.lead_id_2, row.lead_2]].forEach(([leadId, lead]) => {
        if (!leadId) return
        if (!acc[leadId]) acc[leadId] = { id: leadId, nom: lead || '—', count: 0 }
        acc[leadId].count++
      })
      return acc
    }, {})
  ).sort((a, b) => b.count - a.count)

  const solistesAutres = Object.values(
    filtered.reduce((acc, row) => {
      ;[[row.lead_id, row.lead], [row.lead_id_2, row.lead_2]].forEach(([leadId, lead]) => {
        if (leadId) return
        if (!lead || !lead.trim()) return
        const key = lead.trim().toLowerCase()
        if (!acc[key]) acc[key] = { nom: lead.trim(), count: 0 }
        acc[key].count++
      })
      return acc
    }, {})
  ).sort((a, b) => b.count - a.count)

  const maxSolistes = Math.max(
    solistesInscrits[0]?.count || 0,
    solistesAutres[0]?.count || 0,
    1
  )

  if (loading) return <div className="loading">Chargement…</div>

  // Libellé période pour affichage
  const labelPeriode = {
    '3m': '3 mois',
    '6m': '6 mois',
    '1a': '1 an',
    'tout': 'tout l\'historique',
  }[periode]

  return (
    <>
      {/* Search */}
      <div className="search-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" />
        {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texte-ter)', fontSize: '1rem' }}>✕</button>}
      </div>

      {/* Tabs principaux */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {['cultes', 'fréquence', 'solistes'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, background: 'none', border: 'none', padding: '10px 4px',
            cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '0.82rem',
            color: tab === t ? 'var(--bleu-principal)' : 'var(--texte-sec)',
            borderBottom: tab === t ? '2px solid var(--bleu-principal)' : '2px solid transparent',
            fontWeight: tab === t ? 500 : 300, textTransform: 'capitalize', transition: 'all 0.2s',
          }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {/* ===== Tab: CULTES (récent → ancien) ===== */}
      {tab === 'cultes' && (
        groupedArr.length === 0 ? (
          <div className="empty-state"><div className="emoji">📅</div><p>Aucun historique pour l'instant.</p></div>
        ) : (
          groupedArr.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid var(--border)', marginBottom: 10 }}>
                <p style={{ fontFamily: 'var(--font-title)', fontSize: '0.95rem', fontWeight: 600, color: 'var(--texte)' }}>{group.event?.nom}</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--texte-ter)' }}>
                  {formatDateLocale(group.event?.date)}
                </p>
              </div>
              {group.songs.map((row, si) => (
                <div key={si} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '9px 6px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--texte-ter)', minWidth: 18 }}>{si + 1}</span>
                    <span style={{ flex: 1, minWidth: 120, fontFamily: 'var(--font-title)', fontSize: '0.95rem', color: 'var(--texte)' }}>{row.chants?.titre}</span>
                    {row.tonalite_jour && <span style={{ fontSize: '0.75rem', color: 'var(--bleu-principal)', fontWeight: 500 }}>{row.tonalite_jour}</span>}
                    {row.chants?.categorie && <span className="cat-badge" style={{ ...catStyle(row.chants.categorie), fontSize: '0.62rem', padding: '2px 7px' }}>{row.chants.categorie}</span>}
                  </div>
                  {(row.lead || row.lead_2) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 28 }}>
                      {row.lead && <span style={{ fontSize: '0.78rem', color: 'var(--bleu-principal)', fontWeight: 500 }}>🎤 {row.lead}</span>}
                      {row.lead_2 && <span style={{ fontSize: '0.78rem', color: 'var(--bleu-principal)', fontWeight: 500 }}>🎤 {row.lead_2}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )
      )}

      {/* ===== Tab: FRÉQUENCE ===== */}
      {tab === 'fréquence' && (
        <>
          {/* Sous-onglets + sélecteur période */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, flex: 1, minWidth: 200 }}>
              {[
                { k: 'top',   label: 'Top +' },
                { k: 'flop',  label: 'Top −' },
                { k: 'alpha', label: 'A→Z' },
              ].map(s => (
                <button key={s.k}
                  onClick={() => setFreqView(s.k)}
                  style={{
                    flex: 1,
                    background: freqView === s.k ? 'var(--bleu-principal)' : 'var(--card)',
                    color: freqView === s.k ? '#fff' : 'var(--texte-sec)',
                    border: '1px solid var(--border)',
                    borderRadius: 8, padding: '6px 8px',
                    cursor: 'pointer', fontSize: '0.78rem',
                    fontFamily: 'var(--font-ui)',
                    transition: 'all 0.2s',
                  }}>
                  {s.label}
                </button>
              ))}
            </div>
            <select
              value={periode}
              onChange={e => setPeriode(e.target.value)}
              style={{
                fontSize: '0.78rem', padding: '6px 10px',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--card)', color: 'var(--texte)',
                fontFamily: 'var(--font-ui)', cursor: 'pointer',
              }}>
              <option value="3m">3 mois</option>
              <option value="6m">6 mois</option>
              <option value="1a">1 an</option>
              <option value="tout">Tout</option>
            </select>
          </div>

          {/* Titre dynamique */}
          <p style={{ fontSize: '0.75rem', color: 'var(--texte-ter)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {freqView === 'top' && `Top ${Math.min(20, topPlus.length)} des chants les plus pris · ${labelPeriode}`}
            {freqView === 'flop' && `Top ${Math.min(20, topMoins.length)} des chants les moins pris · ${labelPeriode}`}
            {freqView === 'alpha' && `Répertoire complet (A → Z) · ${labelPeriode}`}
          </p>

          {/* Listes */}
          {freqView === 'top' && (
            topPlus.length === 0 ? (
              <div className="empty-state"><div className="emoji">📊</div><p>Aucune donnée sur cette période.</p></div>
            ) : topPlus.map((item, i) => (
              <FreqRow key={item.id} item={item} index={i} max={maxTopPlus} barColor="var(--bleu-principal)" />
            ))
          )}

          {freqView === 'flop' && (
            topMoins.length === 0 ? (
              <div className="empty-state"><div className="emoji">📊</div><p>Aucun chant dans le répertoire.</p></div>
            ) : topMoins.map((item, i) => (
              <FreqRow key={item.id} item={item} index={i} max={maxTopMoins} barColor="var(--texte-ter)" />
            ))
          )}

          {freqView === 'alpha' && (
            alpha.length === 0 ? (
              <div className="empty-state"><div className="emoji">📊</div><p>Aucun chant dans le répertoire.</p></div>
            ) : alpha.map((item, i) => (
              <FreqRow key={item.id} item={item} index={i} max={maxAlpha} barColor="var(--bleu-principal)" showRank={false} />
            ))
          )}
        </>
      )}

      {/* ===== Tab: SOLISTES (inchangé) ===== */}
      {tab === 'solistes' && (
        solistesInscrits.length === 0 && solistesAutres.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">🎤</div>
            <p>Aucun soliste renseigné pour l'instant.<br/>Désignez les solistes depuis la page d'un événement.</p>
          </div>
        ) : (
          <>
            {solistesInscrits.length > 0 && (
              <>
                <p style={{ fontSize: '0.7rem', color: 'var(--texte-ter)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, marginTop: 4 }}>
                  Membres inscrits
                </p>
                {solistesInscrits.map((item, i) => (
                  <div key={`in-${item.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--texte-ter)', minWidth: 24, textAlign: 'right' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-title)', fontSize: '0.95rem', color: 'var(--texte)', marginBottom: 4 }}>🎤 {item.nom}</p>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(item.count / maxSolistes) * 100}%`, background: 'var(--bleu-principal)', borderRadius: 2, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--texte-sec)', minWidth: 30, textAlign: 'right' }}>{item.count}×</span>
                  </div>
                ))}
              </>
            )}
            {solistesAutres.length > 0 && (
              <>
                <p style={{ fontSize: '0.7rem', color: 'var(--texte-ter)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, marginTop: 24 }}>
                  Autres
                </p>
                {solistesAutres.map((item, i) => (
                  <div key={`out-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--texte-ter)', minWidth: 24, textAlign: 'right' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-title)', fontSize: '0.95rem', color: 'var(--texte)', marginBottom: 4 }}>🎤 {item.nom}</p>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(item.count / maxSolistes) * 100}%`, background: 'var(--texte-ter)', borderRadius: 2, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--texte-sec)', minWidth: 30, textAlign: 'right' }}>{item.count}×</span>
                  </div>
                ))}
              </>
            )}
          </>
        )
      )}
    </>
  )
}

// Composant de ligne pour les vues Top+, Top-, A→Z
function FreqRow({ item, index, max, barColor, showRank = true }) {
  const periodicite = calculerPeriodicite(item.dates)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      {showRank && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--texte-ter)', minWidth: 24, textAlign: 'right' }}>
          {index + 1}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <p style={{ fontFamily: 'var(--font-title)', fontSize: '0.95rem', color: 'var(--texte)' }}>{item.titre}</p>
          {periodicite && (
            <span style={{ fontSize: '0.7rem', color: 'var(--texte-ter)', fontStyle: 'italic' }}>
              · {periodicite}
            </span>
          )}
          {!periodicite && item.count === 1 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--texte-ter)', fontStyle: 'italic' }}>
              · 1ère fois
            </span>
          )}
        </div>
        <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(item.count / max) * 100}%`, background: barColor, borderRadius: 2, transition: 'width 0.5s ease' }} />
        </div>
      </div>
      <span style={{ fontSize: '0.8rem', color: 'var(--texte-sec)', minWidth: 30, textAlign: 'right' }}>{item.count}×</span>
    </div>
  )
}
