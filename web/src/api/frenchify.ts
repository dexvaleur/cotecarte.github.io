import fr from 'pokemon/data/fr.json'
import ja from 'pokemon/data/ja.json'
import ko from 'pokemon/data/ko.json'
import th from 'pokemon/data/th.json'
import zhHans from 'pokemon/data/zh-hans.json'
import zhHant from 'pokemon/data/zh-hant.json'
import type { Card, CardBrief } from './types'

/**
 * Cartes asiatiques (japonaises, coréennes, chinoises…) : TCGdex n'a que leurs textes d'origine.
 * On affiche les textes en français :
 *  1. en retrouvant la même carte en version française (même Pokémon, mêmes PV, mêmes attaques),
 *     pour reprendre son nom, ses attaques, ses talents et sa description ;
 *  2. sinon, au moins le nom du Pokémon, grâce à la liste des noms dans toutes les langues.
 * Ce fichier est chargé seulement quand on ouvre une carte asiatique.
 */

// Les listes sont dans l'ordre du Pokédex : même position = même Pokémon.
const INDEX = new Map<string, number>()
for (const list of [ja, ko, zhHant, zhHans, th] as string[][]) list.forEach((n, i) => INDEX.has(n) || INDEX.set(n, i))

// Suffixes des cartes, écrits à la française (« Dracaufeu-ex », « Pikachu VMAX »).
const SUFFIXES: [RegExp, string][] = [
  [/\s*VMAX$/, ' VMAX'],
  [/\s*VSTAR$/, ' VSTAR'],
  [/\s*V-UNION$/, ' V-UNION'],
  [/\s*V$/, ' V'],
  [/\s*GX$/, '-GX'],
  [/\s*EX$/, '-EX'],
  [/\s*ex$/, '-ex'],
  [/\s*BREAK$/, ' TURBO'],
]

const PREFIXES: [RegExp, string][] = [
  [/^メガ/, 'Méga-'],
  [/^ガラル/, ' de Galar'],
  [/^アローラ/, ' d’Alola'],
  [/^ヒスイ/, ' de Hisui'],
  [/^パルデア/, ' de Paldea'],
]

/** « リザードンex » → « Dracaufeu-ex ». null si le Pokémon n'est pas reconnu (ex. une carte Dresseur). */
export function frenchName(name: string | undefined): string | null {
  if (!name) return null
  let base = name.trim()
  let suffix = ''
  for (const [re, fr] of SUFFIXES) {
    if (re.test(base)) {
      base = base.replace(re, '')
      suffix = fr
      break
    }
  }
  let before = ''
  let after = ''
  for (const [re, label] of PREFIXES) {
    if (re.test(base)) {
      base = base.replace(re, '').replace(/^の/, '')
      if (label.startsWith(' ')) after = label
      else before = label
      break
    }
  }
  base = base.replace(/^\s+|\s+$/g, '')
  const i = INDEX.get(base)
  if (i === undefined) return null
  return `${before}${(fr as string[])[i]}${after}${suffix}`
}

/** Noms des cartes d'une extension asiatique, en français quand c'est un Pokémon. */
export function frenchBriefs(cards: CardBrief[]): CardBrief[] {
  return cards.map((c) => {
    const n = frenchName(c.name)
    return n ? { ...c, name: n } : c
  })
}

type Fetch = <T>(path: string) => Promise<T>

const dmg = (d: string | number | undefined) => String(d ?? '').replace(/\s/g, '')

/** Même carte ? Mêmes attaques (nombre d'Énergies et dégâts) et même nombre de talents. */
function sameCard(a: Card, b: Card): boolean {
  const aa = a.attacks ?? []
  const ba = b.attacks ?? []
  if (aa.length !== ba.length || (a.abilities?.length ?? 0) !== (b.abilities?.length ?? 0)) return false
  return aa.every((x, i) => (x.cost?.length ?? 0) === (ba[i].cost?.length ?? 0) && dmg(x.damage) === dmg(ba[i].damage))
}

/** La version française de la carte, si on la trouve. */
async function frenchTwin(card: Card, fetch: Fetch): Promise<Card | null> {
  const dex = card.dexId?.[0]
  if (!dex || !card.attacks?.length) return null
  const list = await fetch<CardBrief[]>(`/fr/cards?dexId=eq:${dex}${card.hp ? `&hp=eq:${card.hp}` : ''}`)
  // Même numéro d'abord (les extensions japonaises et françaises se suivent souvent), puis les plus récentes.
  const sorted = [...list].reverse().sort((a, b) => Number(b.localId === card.localId) - Number(a.localId === card.localId))
  for (let i = 0; i < Math.min(sorted.length, 16); i += 6) {
    const details = await Promise.all(sorted.slice(i, i + 6).map((c) => fetch<Card>(`/fr/cards/${encodeURIComponent(c.id)}`).catch(() => null)))
    const found = details.find((d) => d && sameCard(card, d))
    if (found) return found
  }
  return null
}

/** Fiche d'une carte asiatique avec ses textes en français quand c'est possible. */
export async function frenchify(card: Card, fetch: Fetch): Promise<Card> {
  const twin = await frenchTwin(card, fetch).catch(() => null)
  const originalName = card.name
  if (twin) {
    return {
      ...card,
      originalName,
      textsInFrench: true,
      name: twin.name,
      evolveFrom: twin.evolveFrom ?? frenchName(card.evolveFrom) ?? card.evolveFrom,
      attacks: card.attacks?.map((a, i) => ({ ...a, name: twin.attacks![i].name, effect: twin.attacks![i].effect ?? a.effect })),
      abilities: card.abilities?.map((a, i) => ({ ...a, name: twin.abilities![i].name, effect: twin.abilities![i].effect ?? a.effect })),
      description: twin.description ?? card.description,
    }
  }
  const name = frenchName(card.name)
  return {
    ...card,
    originalName,
    textsInFrench: false,
    name: name ?? card.name,
    evolveFrom: frenchName(card.evolveFrom) ?? card.evolveFrom,
  }
}
