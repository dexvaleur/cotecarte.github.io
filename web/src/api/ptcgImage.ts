/**
 * Image de secours depuis pokemontcg.io, pour les cartes que TCGdex n'illustre pas
 * (environ 17 % des cartes : Galeries de Dresseurs, promos, anciennes extensions…).
 *
 * Les deux bases ne nomment pas les extensions de la même façon :
 * « sv03.5 » chez TCGdex = « sv3pt5 » chez pokemontcg.io. Cette table fait la correspondance.
 * Testé sur les 2 941 cartes sans image : 2 132 retrouvées.
 */

const SPECIAL: Record<string, string> = {
  'swsh4.5sv': 'swsh45sv',
  'swsh4.5': 'swsh45',
  'swsh12.5': 'swsh12pt5',
  'swsh12.5gg': 'swsh12pt5gg',
  'swsh10.5': 'pgo',
  'sm3.5': 'sm35',
  'sm7.5': 'sm75',
  'sv03.5': 'sv3pt5',
  'sv04.5': 'sv4pt5',
  'sv06.5': 'sv6pt5',
  'sv08.5': 'sv8pt5',
  hgssp: 'hsp',
  '2011bw': 'mcd11',
  '2012bw': 'mcd12',
  '2014xy': 'mcd14',
  '2015xy': 'mcd15',
  '2016xy': 'mcd16',
  '2017sm': 'mcd17',
  '2018sm-fr': 'mcd18',
  '2019sm-fr': 'mcd19',
  '2021swsh': 'mcd21',
  '2022swsh': 'mcd22',
}

/** Identifiant pokemontcg.io de l'extension (« sv03.5 » → « sv3pt5 », « sv01 » → « sv1 »). */
export function ptcgSetId(tcgdexSetId: string): string {
  if (SPECIAL[tcgdexSetId]) return SPECIAL[tcgdexSetId]
  const sv = /^sv0(\d)$/.exec(tcgdexSetId)
  return sv ? `sv${sv[1]}` : tcgdexSetId
}

/** Adresse de l'image pokemontcg.io d'une carte TCGdex (« swsh9tg-TG07 » → …/swsh9tg/TG07.png). */
export function ptcgImageUrl(cardId: string, quality: 'low' | 'high' = 'low'): string {
  const cut = cardId.lastIndexOf('-')
  const setId = cardId.slice(0, cut)
  const localId = cardId.slice(cut + 1)
  // Numéros sans zéros devant (« 069 » → « 69 ») ; les préfixes (TG07, SV051) restent tels quels.
  const num = /^\d+$/.test(localId) ? String(parseInt(localId, 10)) : localId
  return `https://images.pokemontcg.io/${ptcgSetId(setId)}/${num}${quality === 'high' ? '_hires' : ''}.png`
}
