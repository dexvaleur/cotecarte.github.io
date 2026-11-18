# Poké Card

Application mobile (PWA) pour les collectionneurs de cartes Pokémon débutants : scanne une carte, découvre ce qu'elle est et combien elle vaut, gère ta collection, choisis tes boosters, suis l'actu et revends tes cartes.

> Application non officielle, non affiliée à The Pokémon Company, Nintendo ou Creatures.

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Fondations : design clair/sombre, 5 onglets, onboarding, glossaire, PWA | ✅ |
| 2 | Scan (caméra + OCR), recherche manuelle, fiche de carte avec prix et état | ✅ |
| 3 | Collection, serveur, base de données, connexion par email | ⏳ |
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
api/                  (étape 3) le serveur Node.js + PostgreSQL
```

## Comment marche le scan

1. **Photo** : caméra avec un cadre au format carte, ou photo de la galerie (la carte est détectée et recadrée automatiquement).
2. **Lecture (OCR)** : [Tesseract.js](https://tesseract.projectnaptha.com/) lit le nom en haut de la carte, le numéro en bas (`025/165`) et l'année du copyright. Tout se passe sur le téléphone, la photo n'est envoyée nulle part.
3. **Recherche** dans [TCGdex](https://tcgdex.dev) (gratuit, en français) : par numéro (extensions qui ont 165 cartes → carte n°25) et par nom.
4. **Score** de chaque carte trouvée : ressemblance du nom, numéro, suffixe (ex, V, VMAX), époque. Si on est sûr, la fiche s'ouvre ; sinon, une liste de choix s'affiche. La recherche manuelle reste toujours possible.

Pour voir ce que l'OCR a lu : console du navigateur → `window.__pokecardScan`.

**Limites connues** : reflets et sleeves brillantes gênent la lecture ; la comparaison d'images est prête mais désactivée tant que le serveur (étape 3) ne relaie pas les images (le serveur d'images de TCGdex envoie un en-tête CORS en double que les navigateurs refusent).

## Données et prix

Les fiches et les prix viennent de TCGdex, qui reprend les prix **Cardmarket** (€) et **TCGplayer** ($), mis à jour chaque jour. Les réponses sont gardées en cache (IndexedDB) : une carte déjà vue reste consultable hors ligne. La collection et la wishlist sont pour l'instant gardées sur le téléphone ; elles passeront sur le serveur à l'étape 3.

## Lancer l'appli sur ton ordinateur

Il faut [Node.js](https://nodejs.org) version 20 ou plus.

```bash
cd web
npm install      # télécharge les dépendances (une seule fois)
npm run dev      # lance l'appli sur http://localhost:5173
```

Pour la tester sur ton téléphone, connecte-le au même Wi-Fi et lance `npm run dev -- --host` : l'adresse à ouvrir s'affiche dans le terminal.

```bash
npm test         # tests automatiques (lecture du numéro, du nom…)
npm run build    # crée la version finale dans web/dist
npm run preview  # affiche cette version finale
```

La caméra ne fonctionne que sur une adresse sécurisée (`https://` ou `localhost`). Pour tester sur téléphone, le plus simple est d'importer une photo depuis la galerie, ou de mettre l'appli en ligne (étape suivante).
