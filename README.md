# Poké Card

Application mobile (PWA) pour les collectionneurs de cartes Pokémon débutants : scanne une carte, découvre ce qu'elle est et combien elle vaut, gère ta collection, choisis tes boosters, suis l'actu et revends tes cartes.

> Application non officielle, non affiliée à The Pokémon Company, Nintendo ou Creatures.

## Avancement

| Étape | Contenu | État |
|---|---|---|
| 1 | Fondations : design clair/sombre, 5 onglets, onboarding, glossaire, PWA | ✅ |
| 2 | Scan (caméra + OCR) et fiche de carte avec prix | ⏳ |
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
    data/             données fixes (glossaire)
    lib/              petits outils (thème, stockage, réseau)
api/                  (étape 3) le serveur Node.js + PostgreSQL
```

## Lancer l'appli sur ton ordinateur

Il faut [Node.js](https://nodejs.org) version 20 ou plus.

```bash
cd web
npm install      # télécharge les dépendances (une seule fois)
npm run dev      # lance l'appli sur http://localhost:5173
```

Pour la tester sur ton téléphone, connecte-le au même Wi-Fi et lance `npm run dev -- --host` : l'adresse à ouvrir s'affiche dans le terminal.

```bash
npm run build    # crée la version finale dans web/dist
npm run preview  # affiche cette version finale
```
