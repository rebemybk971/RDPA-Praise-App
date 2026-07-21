// Fonction serverless Vercel : structure des paroles brutes (issues d'un import PDF)
// en blocs (Couplet, Refrain, Pont...) via l'API Mistral. La clé API reste côté serveur.

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

  const prompt = `Tu structures les paroles d'un chant chrétien en blocs (Couplet 1, Couplet 2, Refrain, Pont, Intro, Outro, etc).
Le texte brut ci-dessous provient d'une extraction PDF et peut contenir des sauts de ligne mal placés, des répétitions ou du bruit.
Il peut aussi contenir des accords (symboles comme G, Am, D7, Fmaj7, Bb, C#m...) entremêlés avec les paroles, soit sur leur propre ligne au-dessus des paroles, soit collés dans le texte.

Réponds UNIQUEMENT avec un objet JSON de la forme :
{"blocs": [{"nom": "Couplet 1", "contenu": "...", "accords": "..."}, {"nom": "Refrain", "contenu": "...", "accords": "..."}]}

Règles pour "contenu" :
- Regroupe les paroles par section logique (couplets, refrain, pont...), sans les accords.
- Si un refrain se répète à l'identique plusieurs fois dans le texte, ne le liste qu'une seule fois sous "Refrain".
- Conserve les sauts de ligne (un \\n entre chaque ligne de parole).
- Ne modifie pas les mots ni la ponctuation. Tu peux normaliser les espaces multiples à l'intérieur d'une ligne de paroles en un seul espace.

Règles pour "accords" (alignement précis, style OpenSong/OnSong) :
- Si le bloc ne contient aucun accord détectable dans le texte source, mets "accords": "" (chaîne vide).
- Si des accords sont détectés, produis EXACTEMENT une ligne d'accords par ligne de paroles correspondante (même nombre de \\n que "contenu", ligne vide "" si aucun accord sur cette ligne précise).
- Pour positionner un accord, compte le nombre de caractères depuis le début de la ligne de paroles JUSQU'À la lettre au-dessus de laquelle il se trouve dans le texte source, puis place l'accord à cette même position de caractère dans la ligne d'accords (en complétant avec des espaces avant). Comme "contenu" est en police monospace identique à "accords", la position en caractères doit correspondre visuellement.
- N'invente jamais d'accords qui ne sont pas présents dans le texte source.

Exemple (texte source avec accords sur leur propre ligne au-dessus des paroles) :
"""
G          D          Em
Amazing grace how sweet the sound
"""
Doit donner : "contenu": "Amazing grace how sweet the sound", "accords": "G          D          Em"
(le "G" est au caractère 0 comme "Amazing", le "D" est au caractère 11 comme "how", etc. — recopie la position réelle du texte source, ne la réinvente pas).

N'ajoute aucun texte en dehors du JSON.

Texte brut :
"""
${texte}
"""`

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
      res.status(502).json({ error: "Aucun bloc détecté par l'IA" })
      return
    }

    res.status(200).json({ blocs: parsed.blocs })
  } catch (err) {
    console.error('[api/structurer-paroles] Exception :', err)
    res.status(500).json({ error: 'Erreur serveur : ' + err.message })
  }
}
