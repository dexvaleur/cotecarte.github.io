// Petit glossaire pour les débutants : mots qu'on croise partout dans le monde des cartes.

export interface GlossaryEntry {
  term: string
  short: string // une phrase simple
  tip?: string // conseil ou exemple
  category: 'finition' | 'rareté' | 'état' | 'produit' | 'jeu'
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Holo',
    short: "L'illustration du Pokémon brille quand on incline la carte.",
    tip: 'Seule l’image brille, pas le reste de la carte.',
    category: 'finition',
  },
  {
    term: 'Reverse (Reverse Holo)',
    short: "Tout le cadre de la carte brille, sauf l'illustration.",
    tip: 'C’est l’inverse d’une Holo, d’où le nom « reverse ». Une par booster environ.',
    category: 'finition',
  },
  {
    term: 'Full Art',
    short: "L'illustration recouvre toute la carte, sans cadre.",
    tip: 'Souvent recherchées : elles valent en général plus cher.',
    category: 'finition',
  },
  {
    term: 'Illustration Rare / Spéciale',
    short: "Carte avec une illustration originale qui déborde sur toute la carte, souvent avec un décor.",
    tip: 'Parmi les cartes les plus convoitées des extensions récentes.',
    category: 'rareté',
  },
  {
    term: 'Secret Rare',
    short: "Carte dont le numéro dépasse le total de l'extension (ex. 210/198).",
    tip: 'Regarde le numéro en bas : s’il est plus grand que le 2ᵉ nombre, c’est une secrète !',
    category: 'rareté',
  },
  {
    term: 'Symbole de rareté',
    short: 'Petit signe en bas de la carte : ● commune, ◆ peu commune, ★ rare.',
    tip: 'Les cartes plus rares ont plusieurs étoiles, dorées ou noires.',
    category: 'rareté',
  },
  {
    term: 'Extension (Set)',
    short: 'Une série de cartes sorties ensemble, avec un nom et un symbole communs.',
    tip: 'Le symbole de l’extension est imprimé en bas de la carte.',
    category: 'jeu',
  },
  {
    term: 'Numéro de carte',
    short: 'Position de la carte dans son extension, ex. 025/165.',
    tip: 'C’est l’info la plus utile pour identifier une carte.',
    category: 'jeu',
  },
  {
    term: 'PV',
    short: 'Points de vie du Pokémon dans le jeu.',
    category: 'jeu',
  },
  {
    term: 'Near Mint (NM)',
    short: 'Carte quasi parfaite : pas de pli, coins nets, aucune rayure visible.',
    tip: 'C’est l’état de référence pour les prix affichés.',
    category: 'état',
  },
  {
    term: 'Excellent / Played',
    short: 'Carte avec de petits défauts (bords blanchis, rayures) : elle vaut moins.',
    category: 'état',
  },
  {
    term: 'Gradée (PSA, PCA…)',
    short: "Carte notée de 1 à 10 par une société spécialisée et mise sous coque scellée.",
    tip: 'Une carte notée 10 peut valoir bien plus que la même non gradée.',
    category: 'état',
  },
  {
    term: 'Booster',
    short: 'Petit paquet scellé de cartes au hasard (environ 10 cartes).',
    category: 'produit',
  },
  {
    term: 'Display',
    short: 'Boîte de 36 boosters (parfois 18) de la même extension.',
    tip: 'Moins cher par booster, mais un gros budget d’un coup.',
    category: 'produit',
  },
  {
    term: 'ETB (Coffret Dresseur d’Élite)',
    short: 'Coffret avec 8 à 10 boosters, des sleeves, des dés et des accessoires.',
    category: 'produit',
  },
  {
    term: 'Sleeve',
    short: 'Pochette plastique qui protège une carte.',
    tip: 'Mets tes cartes de valeur en sleeve dès l’ouverture du booster.',
    category: 'produit',
  },
]

export const CATEGORY_LABEL: Record<GlossaryEntry['category'], string> = {
  finition: 'Finition',
  rareté: 'Rareté',
  état: 'État',
  produit: 'Produit',
  jeu: 'Jeu',
}
