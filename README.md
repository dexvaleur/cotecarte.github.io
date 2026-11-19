# DexValeur

Application mobile (PWA) pour les collectionneurs de cartes Pokémon débutants : scanne une carte, découvre ce qu'elle est et combien elle vaut, gère ta collection, choisis tes boosters, suis l'actu et revends tes cartes.

> Application non officielle, non affiliée à The Pokémon Company, Nintendo ou Creatures.

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Fondations : design clair/sombre, 5 onglets, onboarding, glossaire, PWA | ✅ |
| 2 | Scan (caméra + OCR), recherche manuelle, fiche de carte avec prix et état | ✅ |
| 3 | Serveur, base de données, connexion par email, collection complète synchronisée | ✅ |
| 4 | Conseils d'achat de packs | ⏳ |
| 5 | Actualités et notifications | ⏳ |
| 6 | Revente | ⏳ |

## Structure

```
web/                  l'application (React + TypeScript + Tailwind, compilée par Vite)
  index.html          page de départ
  vite.config.ts      configuration (dont la PWA : manifeste, mode hors ligne)
  public/             icônes et fichiers copiés tels quels
  src/
    main.tsx          point d'entrée
    App.tsx           liste des écrans (routes) + onboarding au 1er lancement
    index.css         couleurs (mode clair / sombre)
    components/       morceaux d'interface réutilisables (en-tête, onglets…)
    screens/          un fichier par écran
    api/              accès à TCGdex (cartes + prix) avec cache hors ligne
    scan/             reconnaissance : traitement d'image, OCR, analyse du texte
    data/             données fixes (glossaire, raretés, états)
    lib/              petits outils (thème, stockage, collection, prix, formats)
api/                  le serveur (Node.js + Fastify + PostgreSQL)
  src/index.ts        démarrage
  src/app.ts          assemblage des routes
  src/routes/         auth (connexion), collection, cards (TCGdex, images, prix)
  src/jobs.ts         relevé quotidien des prix
  src/db/             accès à la base + migrations SQL (schéma commenté)
  .env.example        réglages commentés
  Dockerfile          pour l'hébergement
```

## Comment marche le scan

1. **Photo** : caméra avec un cadre au format carte, ou photo de la galerie (la carte est détectée et recadrée automatiquement).
2. **Lecture (OCR)** : [Tesseract.js](https://tesseract.projectnaptha.com/) lit le nom en haut de la carte, le numéro en bas (`025/165`) et l'année du copyright. Tout se passe sur le téléphone, la photo n'est envoyée nulle part.
3. **Recherche** dans [TCGdex](https://tcgdex.dev) (gratuit, en français) : par numéro (extensions qui ont 165 cartes → carte n°25) et par nom.
4. **Score** de chaque carte trouvée : ressemblance du nom, numéro, suffixe (ex, V, VMAX), époque. Si on est sûr, la fiche s'ouvre ; sinon, une liste de choix s'affiche. La recherche manuelle reste toujours possible.

Pour voir ce que l'OCR a lu : console du navigateur → `window.__pokecardScan`.

**Limites connues** : reflets et sleeves brillantes gênent la lecture. La comparaison d'images ne fonctionne qu'avec le serveur, qui relaie les images (le serveur d'images de TCGdex envoie un en-tête CORS en double que les navigateurs refusent).

## Données et prix

Les fiches et les prix viennent de TCGdex, qui reprend les prix **Cardmarket** (€) et **TCGplayer** ($), mis à jour chaque jour. Les réponses sont gardées en cache (IndexedDB) : une carte déjà vue reste consultable hors ligne. La collection et la wishlist sont gardées sur le téléphone, et synchronisées avec ton compte si tu es connecté.

## Le serveur (étape 3)

Il sert à quatre choses :
1. **Ton compte** : connexion par email avec un code à 6 chiffres (pas de mot de passe). Le code et le jeton de session ne sont jamais stockés en clair.
2. **Ta collection en ligne** : retrouvée sur tous tes appareils. L'appli enregistre d'abord sur le téléphone, puis envoie les changements dès qu'il y a du réseau (marche hors ligne).
3. **Le cache** des cartes et des prix (moins d'appels à TCGdex) et le **relais des images** (qui active la comparaison d'images au scan).
4. **Le relevé quotidien des prix** des cartes suivies : courbes jour par jour et évolution de la valeur de ta collection.

Sans serveur, l'appli fonctionne quand même (collection sur le téléphone uniquement).

## Lancer l'appli sur ton ordinateur

Il faut [Node.js](https://nodejs.org) version 22 ou plus. Ouvre deux terminaux :

```bash
# Terminal 1 : le serveur
cd api
npm install
npm run dev      # http://localhost:8787 — base locale automatique, codes de connexion affichés ici
```

```bash
# Terminal 2 : l'appli
cd web
npm install
npm run dev      # http://localhost:5173
```

Pour la tester sur ton téléphone, connecte-le au même Wi-Fi et lance `npm run dev -- --host` : l'adresse à ouvrir s'affiche dans le terminal.

```bash
npm test         # tests automatiques (dans web/ : lecture du scan ; dans api/ : serveur)
npm run build    # crée la version finale dans web/dist
npm run preview  # affiche cette version finale
```

## Mise en ligne

1. **Base de données** : crée une base PostgreSQL gratuite (ex. [Neon](https://neon.tech)) et copie son adresse.
2. **Serveur** : héberge le dossier `api/` (ex. [Render](https://render.com) ou [Railway](https://railway.app), avec le `Dockerfile`). Variables à définir : `DATABASE_URL`, `AUTH_SECRET`, `SMTP_URL` (envoi des emails, ex. [Brevo](https://www.brevo.com)), `WEB_ORIGIN` (adresse de l'appli), `NODE_ENV=production`. Voir `api/.env.example`.
3. **Appli** : GitHub Pages, avec le workflow `.github/workflows/deploy-web.yml` (instructions en haut du fichier). Mettre la variable `VITE_API_URL` = adresse du serveur.

La caméra ne fonctionne que sur une adresse sécurisée (`https://` ou `localhost`). Pour tester sur téléphone, le plus simple est d'importer une photo depuis la galerie, ou de mettre l'appli en ligne (étape suivante).
