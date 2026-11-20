// Explications « débutant » : rareté, types, générations, états.

export interface RarityInfo {
  label: string
  /** 1 = très courante … 5 = extrêmement rare */
  level: 1 | 2 | 3 | 4 | 5
  explain: string
}

// Clé = nom de rareté renvoyé par l'API (français ou anglais), normalisé en minuscules.
const RARITIES: Record<string, RarityInfo> = {
  commune: { label: 'Commune', level: 1, explain: 'Carte de base, il y en a plusieurs dans chaque booster.' },
  'peu commune': { label: 'Peu commune', level: 1, explain: 'Un peu moins fréquente, environ 3 par booster.' },
  rare: { label: 'Rare', level: 2, explain: 'Au moins une rare par booster, reconnaissable à l’étoile ★.' },
  'rare holo': { label: 'Rare Holo', level: 2, explain: 'Rare dont l’illustration brille : carte brillante, plus difficile à trouver.' },
  'holo rare': { label: 'Rare Holo', level: 2, explain: 'Rare dont l’illustration brille : carte brillante, plus difficile à trouver.' },
  'double rare': { label: 'Double rare', level: 3, explain: 'Carte « ex » brillante (★★ noires). Environ 1 booster sur 5.' },
  'ultra rare': { label: 'Ultra rare', level: 4, explain: 'Carte Full Art : l’illustration couvre toute la carte. Environ 1 booster sur 15.' },
  'illustration rare': { label: 'Illustration rare', level: 3, explain: 'Illustration originale qui déborde sur toute la carte (★ dorée). Environ 1 booster sur 12.' },
  'illustration spéciale rare': { label: 'Illustration spéciale rare', level: 5, explain: 'Version spéciale très recherchée d’un Pokémon ex (★★ dorées). Environ 1 booster sur 60 à 90.' },
  'special illustration rare': { label: 'Illustration spéciale rare', level: 5, explain: 'Version spéciale très recherchée d’un Pokémon ex (★★ dorées). Environ 1 booster sur 60 à 90.' },
  'hyper rare': { label: 'Hyper rare', level: 5, explain: 'Carte dorée (★★★). Parmi les plus rares d’une extension, environ 1 booster sur 130.' },
  'secret rare': { label: 'Secrète', level: 5, explain: 'Son numéro dépasse le total de l’extension. Très difficile à obtenir.' },
  'rare secrète': { label: 'Secrète', level: 5, explain: 'Son numéro dépasse le total de l’extension. Très difficile à obtenir.' },
  'shiny rare': { label: 'Chromatique', level: 4, explain: 'Pokémon dans ses couleurs « shiny », rares et recherchées.' },
  'chromatique ultra rare': { label: 'Chromatique ultra rare', level: 5, explain: 'Pokémon chromatique en version Full Art, très rare.' },
  'shiny ultra rare': { label: 'Chromatique ultra rare', level: 5, explain: 'Pokémon chromatique en version Full Art, très rare.' },
  'holo rare v': { label: 'Rare Holo V', level: 3, explain: 'Pokémon V brillant, plus puissant dans le jeu. Assez courant dans les anciennes extensions.' },
  'holo rare vmax': { label: 'Rare Holo VMAX', level: 3, explain: 'Pokémon VMAX (géant) brillant. Environ 1 booster sur 8.' },
  'holo rare vstar': { label: 'Rare Holo VSTAR', level: 3, explain: 'Pokémon VSTAR brillant. Environ 1 booster sur 8.' },
  'radieux rare': { label: 'Radieux', level: 3, explain: 'Pokémon chromatique au style particulier, 1 seul autorisé par deck.' },
  'radiant rare': { label: 'Radieux', level: 3, explain: 'Pokémon chromatique au style particulier, 1 seul autorisé par deck.' },
  'ace spec rare': { label: 'ACE SPEC', level: 3, explain: 'Carte Dresseur très puissante, une seule autorisée par deck.' },
  magnifique: { label: 'Magnifique', level: 4, explain: 'Pokémon qui sort du cadre de la carte, avec un fond arc-en-ciel.' },
  'magnifique rare': { label: 'Magnifique', level: 4, explain: 'Pokémon qui sort du cadre de la carte, avec un fond arc-en-ciel.' },
  'amazing rare': { label: 'Magnifique', level: 4, explain: 'Pokémon qui sort du cadre de la carte, avec un fond arc-en-ciel.' },
  'rare holo lv.x': { label: 'Rare Holo NIV.X', level: 4, explain: 'Ancienne carte puissante (2007-2009), recherchée par les collectionneurs.' },
  'rare prime': { label: 'Rare Prime', level: 4, explain: 'Ancienne carte brillante spéciale (2010-2011).' },
  légende: { label: 'LÉGENDE', level: 4, explain: 'Carte en deux moitiés à assembler (2010-2011).' },
  legend: { label: 'LÉGENDE', level: 4, explain: 'Carte en deux moitiés à assembler (2010-2011).' },
  'dresseur full art': { label: 'Dresseur Full Art', level: 4, explain: 'Carte Dresseur illustrée sur toute sa surface.' },
  'full art trainer': { label: 'Dresseur Full Art', level: 4, explain: 'Carte Dresseur illustrée sur toute sa surface.' },
  promo: { label: 'Promo', level: 2, explain: 'Carte offerte avec un coffret, un événement ou un magazine. Pas dans les boosters.' },
  'sans rareté': { label: 'Sans rareté', level: 1, explain: 'Carte sans symbole de rareté (énergies de base, cartes de kit…).' },
  none: { label: 'Sans rareté', level: 1, explain: 'Carte sans symbole de rareté (énergies de base, cartes de kit…).' },
  couronne: { label: 'Couronne', level: 5, explain: 'Carte dorée ultra rare.' },
  crown: { label: 'Couronne', level: 5, explain: 'Carte dorée ultra rare.' },
}

export function rarityInfo(rarity: string | undefined): RarityInfo {
  if (!rarity) return { label: 'Inconnue', level: 1, explain: 'La rareté de cette carte n’est pas renseignée.' }
  const known = RARITIES[rarity.toLowerCase()]
  if (known) return known
  return { label: rarity, level: 3, explain: 'Rareté spéciale : regarde le symbole en bas de la carte.' }
}

// Couleur de chaque type d'énergie (fond de la pastille).
const TYPE_COLORS: Record<string, string> = {
  plante: '#3fa34d', grass: '#3fa34d',
  feu: '#e8572a', fire: '#e8572a',
  eau: '#2f8fe0', water: '#2f8fe0',
  électrique: '#e9b400', lightning: '#e9b400',
  psy: '#9b4fd1', psychic: '#9b4fd1',
  combat: '#b5623a', fighting: '#b5623a',
  obscurité: '#3d4566', darkness: '#3d4566',
  métal: '#7d8a99', metal: '#7d8a99',
  fée: '#e46fb3', fairy: '#e46fb3',
  dragon: '#b08a1e',
  incolore: '#9a9aa6', colorless: '#9a9aa6',
}

export function typeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] ?? '#7d8a99'
}

/** Génération du Pokémon d'après son numéro de Pokédex national. */
export function generationOf(dexId: number | undefined): number | null {
  if (!dexId) return null
  const limits = [151, 251, 386, 493, 649, 721, 809, 905, 1025]
  const i = limits.findIndex((l) => dexId <= l)
  return i === -1 ? 10 : i + 1
}

// ----- États (échelle Cardmarket) ----------------------------------------

export type ConditionCode = 'NM' | 'EX' | 'GD' | 'LP' | 'PL' | 'PO'

export const CONDITIONS: Record<ConditionCode, { label: string; short: string; factor: number; explain: string }> = {
  NM: { label: 'Near Mint', short: 'NM', factor: 1, explain: 'Quasi parfaite, comme sortie du booster.' },
  EX: { label: 'Excellent', short: 'EX', factor: 0.8, explain: 'Très légers défauts visibles de près.' },
  GD: { label: 'Good', short: 'GD', factor: 0.65, explain: 'Petits défauts visibles : bords un peu blanchis, rayures.' },
  LP: { label: 'Light Played', short: 'LP', factor: 0.5, explain: 'Carte jouée : usure visible sur les bords et la surface.' },
  PL: { label: 'Played', short: 'PL', factor: 0.35, explain: 'Usure importante, petit pli possible.' },
  PO: { label: 'Poor', short: 'PO', factor: 0.2, explain: 'Très abîmée : pli marqué, déchirure, tache.' },
}

// Fiches japonaises, coréennes… : TCGdex donne le type, la catégorie et le stade en anglais.
const EN_TO_FR: Record<string, string> = {
  grass: 'Plante', fire: 'Feu', water: 'Eau', lightning: 'Électrique', psychic: 'Psy', fighting: 'Combat',
  darkness: 'Obscurité', metal: 'Métal', fairy: 'Fée', dragon: 'Dragon', colorless: 'Incolore',
  pokemon: 'Pokémon', trainer: 'Dresseur', energy: 'Énergie',
  basic: 'De base', stage1: 'Niveau 1', stage2: 'Niveau 2', vmax: 'VMAX', vstar: 'VSTAR', mega: 'Méga',
  ability: 'Talent', item: 'Objet', supporter: 'Supporter', stadium: 'Stade', tool: 'Outil Pokémon',
}

/** « Fire » → « Feu », « Stage2 » → « Niveau 2 » ; un mot déjà en français reste tel quel. */
export function frLabel(word: string): string {
  return EN_TO_FR[word.toLowerCase().replace(/\s+/g, '')] ?? word
}
