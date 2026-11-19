import { EN_SERIES } from '../data/enSeries.ts'

/** Image anglaise TCGdex de la même carte (souvent disponible quand la française manque). */
export function enImageBase(cardId: string, frImage?: string): string | undefined {
  if (frImage?.includes('/en/')) return undefined // déjà l'image anglaise
  const cut = cardId.lastIndexOf('-')
  const setId = cardId.slice(0, cut)
  const serie = EN_SERIES[setId]
  return serie ? `https://assets.tcgdex.net/en/${serie}/${setId}/${cardId.slice(cut + 1)}` : undefined
}

