// Fonction serverless Vercel : structure des paroles brutes (issues d'un import PDF)
// en blocs (Couplet, Refrain, Pont...) via l'API Mistral. La clé API reste côté serveur.
//
// Approche : la détection des lignes d'accords et leur association aux paroles est faite
// en JavaScript déterministe (jamais générée par l'IA, donc jamais d'altération d'espacement).
// L'IA n'intervient que pour nommer les paragraphes et repérer les refrains répétés — elle
// ne renvoie que des noms et des numéros de paragraphe, jamais de texte.

const REGEX_ACCORD = /^[A-G](#|b)?(m|min|maj|dim|aug|sus)?\d{0,2}(maj7)?(\/[A-G](#|b)?)?$/i

function estLigneAccords(ligne) {
  const tokens = ligne.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  const nbAccords = tokens.filter(t => REGEX_ACCORD.test(t)).length
  return nbAccords / tokens.length >= 0.6
}

// Découpe le texte en paragraphes (séparés par une ligne vide)
function decouperParagraphes(texte) {
  return texte
    .split(/\n{2,}/)
    .map(p => p.split('\n'))
    .filter(lignes => lignes.some(l => l.trim()))
}

// Associe chaque ligne de paroles à sa ligne d'accords (si présente juste au-dessus)
function construireBloc(lignes) {
  const contenuLignes = []
  const accordsLignes = []
  let i = 0
  while (i < lignes.length) {
    const ligne = lignes[i]
    if (estLigneAccords(ligne) && i + 1 < lignes.length && !estLigneAccords(lignes[i + 1])) {
      accordsLignes.push(ligne)
      contenuLignes.push(lignes[i + 1])
      i += 2
    } else if (estLigneAccords(ligne)) {
      accordsLignes.push(ligne)
      contenuLignes.push('')
      i += 1
    } else {
      contenuLignes.push(ligne)
      accordsLignes.push('')
      i += 1
    }
  }
  return {
    contenu: contenuLignes.join('\n').trim(),
    accords: accordsLignes.some(l => l.trim()) ? accordsLignes.join('\n') : '',
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' })
    return
  }

  const { texte } = req.body || {}
  if (!texte || typeof texte !== 'string' || !texte.trim()) {
    res.status(400).json({ error: 'Texte manquant' })
    return
  }

  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    console.error('[api/structurer-paroles] MISTRAL_API_KEY absente des variables d\'environnement')
    res.status(500).json({ error: 'Clé Mistral non configurée côté serveur' })
    return
  }

  const paragraphes = decouperParagraphes(texte)
  if (paragraphes.length === 0) {
    res.status(400).json({ error: 'Aucun paragraphe détecté dans le texte' })
    return
  }

  const blocsBruts = paragraphes.map(construireBloc)

  const apercuParagraphes = blocsBruts
    .map((b, idx) => `--- Paragraphe ${idx} ---\n${b.contenu}`)
    .join('\n\n')

  const prompt = `Voici les paragraphes de paroles d'un chant chrétien, extraits d'un PDF et déjà découpés (numérotés à partir de 0).
Ta seule tâche : donner un nom à chaque paragraphe (Couplet 1, Couplet 2, Refrain, Pont, Intro, Outro...) selon son contenu et sa position, ET détecter si plusieurs paragraphes ont un contenu identique ou quasi identique (répétition d'un refrain) — dans ce cas, réutilise le MÊME numéro de paragraphe avec le même nom à chaque fois qu'il apparaît dans l'ordre du chant.

Réponds UNIQUEMENT avec un JSON de la forme :
{"blocs": [{"nom": "Couplet 1", "paragraphe": 0}, {"nom": "Refrain", "paragraphe": 1}, {"nom": "Couplet 2", "paragraphe": 2}, {"nom": "Refrain", "paragraphe": 1}]}

Règles :
- "paragraphe" doit être un des numéros fournis ci-dessous (0, 1, 2...), jamais un texte.
- Ignore les paragraphes qui ressemblent à du bruit (numéro de page, mentions légales, CCLI, copyright...) — ne crée pas de bloc pour ça.
- Ne renvoie jamais de texte de paroles ou d'accords, uniquement des noms et des numéros.

Paragraphes :
${apercuParagraphes}`

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[api/structurer-paroles] Erreur Mistral :', response.status, errText)
      res.status(502).json({ error: `Erreur Mistral (${response.status})` })
      return
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      console.error('[api/structurer-paroles] Réponse Mistral sans contenu :', JSON.stringify(data))
      res.status(502).json({ error: 'Réponse Mistral vide' })
      return
    }

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (e) {
      console.error('[api/structurer-paroles] JSON invalide reçu :', content)
      res.status(502).json({ error: 'Réponse IA non structurée correctement' })
      return
    }

    if (!Array.isArray(parsed.blocs) || parsed.blocs.length === 0) {
      console.error('[api/structurer-paroles] Aucun bloc dans la réponse :', content)
      res.status(200).json({
        blocs: blocsBruts.map((b, idx) => ({ nom: `Couplet ${idx + 1}`, ...b })),
      })
      return
    }

    // Reconstruit les blocs finaux à partir du texte ORIGINAL déterministe (jamais généré par l'IA)
    const blocsFinal = parsed.blocs
      .filter(b => Number.isInteger(b.paragraphe) && blocsBruts[b.paragraphe])
      .map(b => ({
        nom: b.nom || 'Bloc',
        contenu: blocsBruts[b.paragraphe].contenu,
        accords: blocsBruts[b.paragraphe].accords,
      }))

    if (blocsFinal.length === 0) {
      res.status(200).json({
        blocs: blocsBruts.map((b, idx) => ({ nom: `Couplet ${idx + 1}`, ...b })),
      })
      return
    }

    res.status(200).json({ blocs: blocsFinal })
  } catch (err) {
    console.error('[api/structurer-paroles] Exception :', err)
    res.status(500).json({ error: 'Erreur serveur : ' + err.message })
  }
}
