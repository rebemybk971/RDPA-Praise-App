# Louange RDPA — Révélation Du Premier Amour

PWA de gestion du répertoire de louange pour l'église RDPA.

## Déploiement rapide

### 1. Supabase — créer la base de données

1. Aller sur [supabase.com](https://supabase.com) → ton projet
2. Cliquer sur **SQL Editor** → **New Query**
3. Copier-coller le contenu de `supabase_schema.sql`
4. Cliquer **Run**

### 2. GitHub — déposer le code

1. Aller sur [github.com](https://github.com) → **New repository**
2. Nommer le dépôt `rdpa` → **Create repository**
3. Glisser-déposer tous les fichiers (sauf le dossier `node_modules`)
4. Cliquer **Commit changes**

### 3. Vercel — mettre en ligne

1. Aller sur [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. **Add New Project** → importer le repo `rdpa`
3. Dans **Environment Variables**, ajouter :
   - `VITE_SUPABASE_URL` = `https://tlpnhncedabytcrnxpth.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = ta clé anon (dans Supabase > Settings > API)
4. Cliquer **Deploy** ✅

### 4. Premier compte admin

1. Dans Supabase → **Authentication** → **Users** → **Invite user**
2. Entrer ton email → envoyer l'invitation
3. Dans **SQL Editor**, exécuter :
   ```sql
   INSERT INTO membres (auth_id, nom, email, role)
   SELECT id, 'Ton Nom', email, 'admin'
   FROM auth.users
   WHERE email = 'ton@email.com';
   ```

## Stack technique

- **React + Vite** — interface rapide et légère
- **Supabase** — base de données temps réel + authentification
- **Vercel** — hébergement gratuit avec déploiement automatique
- **PWA** — installable sur iPhone et Android

## Modifier l'app

Chaque modification dans Claude → mettre à jour les fichiers sur GitHub → Vercel redéploie automatiquement.
