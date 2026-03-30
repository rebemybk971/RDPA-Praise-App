-- ============================================================
-- RDPA — Schéma Supabase
-- À exécuter dans : Supabase > SQL Editor > New Query
-- ============================================================

-- 1. Membres (liés à auth.users)
CREATE TABLE IF NOT EXISTS membres (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nom TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'lecteur' CHECK (role IN ('admin', 'editeur', 'lecteur')),
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Chants
CREATE TABLE IF NOT EXISTS chants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titre TEXT NOT NULL,
  categorie TEXT,
  tonalite TEXT,
  bpm INTEGER,
  lead TEXT,
  paroles TEXT,
  accords TEXT,
  pupitre_soprano TEXT,
  pupitre_alto TEXT,
  pupitre_tenor TEXT,
  pupitre_basse TEXT,
  pupitre_clavier TEXT,
  pupitre_guitare TEXT,
  pupitre_batterie TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Événements
CREATE TABLE IF NOT EXISTS evenements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  date DATE,
  type_culte TEXT,
  lead TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Chants dans les événements (setlist)
CREATE TABLE IF NOT EXISTS evenement_chants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  evenement_id UUID REFERENCES evenements(id) ON DELETE CASCADE,
  chant_id UUID REFERENCES chants(id) ON DELETE CASCADE,
  ordre INTEGER DEFAULT 0,
  tonalite_jour TEXT,
  bpm_jour INTEGER,
  lead TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Annotations
CREATE TABLE IF NOT EXISTS annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chant_id UUID REFERENCES chants(id) ON DELETE CASCADE,
  auteur_id UUID REFERENCES membres(id) ON DELETE SET NULL,
  ligne_index INTEGER,
  type TEXT DEFAULT 'note' CHECK (type IN ('modulation', 'harmonie', 'note')),
  contenu TEXT NOT NULL,
  visibilite TEXT DEFAULT 'perso' CHECK (visibilite IN ('public', 'brouillon', 'perso')),
  publiee_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE chants ENABLE ROW LEVEL SECURITY;
ALTER TABLE evenements ENABLE ROW LEVEL SECURITY;
ALTER TABLE evenement_chants ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

-- Politique simple : tout utilisateur authentifié peut tout lire
-- (les restrictions de rôle sont gérées côté app)

CREATE POLICY "Lecture authentifiée" ON membres FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture authentifiée" ON chants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture authentifiée" ON evenements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture authentifiée" ON evenement_chants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Lecture authentifiée" ON annotations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Écriture authentifiée" ON chants FOR ALL TO authenticated USING (true);
CREATE POLICY "Écriture authentifiée" ON evenements FOR ALL TO authenticated USING (true);
CREATE POLICY "Écriture authentifiée" ON evenement_chants FOR ALL TO authenticated USING (true);
CREATE POLICY "Écriture authentifiée" ON annotations FOR ALL TO authenticated USING (true);
CREATE POLICY "Écriture membres" ON membres FOR ALL TO authenticated USING (true);

-- ============================================================
-- Données de test (optionnel — supprimer si non souhaité)
-- ============================================================

INSERT INTO chants (titre, categorie, tonalite, bpm, paroles) VALUES
  ('Tu es digne', 'Adoration', 'Ré', 76, E'Tu es digne, Tu es digne\nSeigneur Tu es digne\n\nDigne de toute louange\nDigne de toute gloire\nTu es digne'),
  ('Que ta gloire règne', 'Louange', 'Sol', 92, E'Que ta gloire règne\nSur toute la terre\n\nQue ton nom soit exalté\nDans les cieux et sur la terre'),
  ('Plus que vainqueur', 'Combat', 'La', 108, E'Je suis plus que vainqueur\nPar Celui qui m''a aimé\n\nRien ne peut me séparer\nDe son amour infini')
ON CONFLICT DO NOTHING;
