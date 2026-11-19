// Formes des données renvoyées par l'API TCGdex (seulement les champs utilisés).

import type { AsianLang } from './cardId'

export type Lang = 'fr' | 'en' | AsianLang

export interface CardBrief {
  id: string
  localId: string
  name: string
  image?: string
}

export interface SetBrief {
  id: string
  name: string
  logo?: string
  symbol?: string
  cardCount: { official: number; total: number }
}

export interface SetDetail extends SetBrief {
  releaseDate?: string
  serie?: { id: string; name: string }
  abbreviation?: { official?: string }
  cards: CardBrief[]
}

export interface Attack {
  name: string
  cost?: string[]
  damage?: string | number
  effect?: string
}

export interface Ability {
  name: string
  type?: string
  effect?: string
}

export interface TypeValue {
  type: string
  value?: string
}

export interface CardmarketPrices {
  updated?: string
  unit?: string
  idProduct?: number
  avg?: number | null
  low?: number | null
  trend?: number | null
  avg1?: number | null
  avg7?: number | null
  avg30?: number | null
  'avg-holo'?: number | null
  'low-holo'?: number | null
  'trend-holo'?: number | null
  'avg1-holo'?: number | null
  'avg7-holo'?: number | null
  'avg30-holo'?: number | null
}

export interface TcgplayerVariant {
  lowPrice?: number | null
  midPrice?: number | null
  highPrice?: number | null
  marketPrice?: number | null
}

export interface TcgplayerPrices {
  updated?: string
  unit?: string
  [variant: string]: TcgplayerVariant | string | undefined
}

export interface Card {
  id: string
  localId: string
  name: string
  image?: string
  category: string // « Pokémon », « Dresseur », « Énergie »
  illustrator?: string
  rarity?: string
  hp?: number
  types?: string[]
  stage?: string
  evolveFrom?: string
  suffix?: string
  description?: string
  effect?: string
  trainerType?: string
  attacks?: Attack[]
  abilities?: Ability[]
  weaknesses?: TypeValue[]
  resistances?: TypeValue[]
  retreat?: number
  dexId?: number[]
  regulationMark?: string
  variants?: { normal?: boolean; reverse?: boolean; holo?: boolean; firstEdition?: boolean }
  set: SetBrief
  pricing?: { cardmarket?: CardmarketPrices | null; tcgplayer?: TcgplayerPrices | null }
  /** Langue dans laquelle la fiche a été trouvée (ajouté par l'appli) */
  lang: Lang
}

/** Réponse enrichie par le cache : on sait si la donnée est « périmée » (vue hors ligne). */
export interface Cached<T> {
  data: T
  stale: boolean
  fetchedAt: number
}
