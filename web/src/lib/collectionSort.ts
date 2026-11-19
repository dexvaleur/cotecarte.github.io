import en from 'pokemon/data/en.json' with { type: 'json' }
import fr from 'pokemon/data/fr.json' with { type: 'json' }
import { rarityInfo, typeColor } from '../data/cardInfo.ts'

/**
 * Rangements de la collection : tri simple (plus chères, A → Z…) ou par groupes
 * (type, extension, rareté), avec un titre, le nombre de cartes et la valeur de chaque groupe.
 */

export type SortMode = 'value' | 'cheap' | 'dex' | 'type' | 'set' | 'rarity' | 'name' | 'recent' | 'dupes' | 'gain'

export const SORT_MODES: { id: SortMode; label: string; hint: string }[] = [
  { id: 'value', label: '💶 Plus chères', hint: 'De la plus chère à la moins chère' },
  { id: 'cheap', label: '🪙 Moins chères', hint: 'De la moins chère à la plus chère' },
  { id: 'dex', label: '🔢 Pokédex', hint: 'Dans l’ordre du Pokédex national (Bulbizarre n° 1, Herbizarre n° 2…)' },
  { id: 'type', label: '🎨 Par type', hint: 'Plante, Feu, Eau… puis Dresseurs et Énergies' },
  { id: 'set', label: '📦 Par extension', hint: 'Extension par extension, de la plus récente à la plus ancienne, dans l’ordre des numéros' },
  { id: 'rarity', label: '✨ Par rareté', hint: 'Des plus rares aux plus communes' },
  { id: 'name', label: '🔤 A → Z', hint: 'Par ordre alphabétique' },
  { id: 'recent', label: '🕒 Récentes', hint: 'Dernières cartes ajoutées en premier' },
  { id: 'dupes', label: '👯 Doublons', hint: 'Cartes en plusieurs exemplaires en premier : pratique pour échanger ou vendre' },
  { id: 'gain', label: '📈 Plus-values', hint: 'Cartes qui ont pris le plus de valeur depuis ton achat (si tu as noté le prix payé)' },
]

// --- Numéro de Pokédex à partir du nom de la carte ------------------------------

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

// Les fichiers sont dans l'ordre du Pokédex : position + 1 = numéro.
const DEX = new Map<string, number>()
for (const list of [fr, en] as string[][]) list.forEach((name, i) => DEX.has(norm(name)) || DEX.set(norm(name), i + 1))

/**
 * « Dracaufeu-ex » → 6, « Méga-Florizarre-ex » → 3, « Goupix d'Alola » → 37, « Rugit-Lune » → 1005.
 * Cartes Dresseur et Énergie : null.
 */
export function dexNumber(cardName: string): number | null {
  const words = norm(cardName.replace(/^m[ée]ga[- ]/i, '')).split(' ').filter(Boolean)
  // Nom de Pokémon le plus long possible, au début du nom (« Têtes de Fer »), sinon plus loin (« Dark Dracaufeu »).
  for (let start = 0; start < Math.min(words.length, 3); start++) {
    for (let len = Math.min(4, words.length - start); len >= 1; len--) {
      const n = DEX.get(words.slice(start, start + len).join(' '))
      if (n) return n
    }
  }
  return null
}

// --- Groupes --------------------------------------------------------------------

const TYPE_ORDER = ['Plante', 'Feu', 'Eau', 'Électrique', 'Psy', 'Combat', 'Obscurité', 'Métal', 'Fée', 'Dragon', 'Incolore']
const NO_TYPE = 'Dresseurs et Énergies'

export interface SortableRow {
  item: { uid: string; name: string; setId: string; setName: string; localId: string; addedAt: string; quantity: number; purchasePrice?: number | null }
  rarity?: string
  types: string[]
  unit: number
}

export interface Group<R> {
  key: string
  title: string
  color?: string
  rows: R[]
  count: number
  value: number
}

const byName = (a: SortableRow, b: SortableRow) => a.item.name.localeCompare(b.item.name, 'fr')
const byNumber = (a: SortableRow, b: SortableRow) => a.item.localId.localeCompare(b.item.localId, 'fr', { numeric: true })
const byDex = (a: SortableRow, b: SortableRow) => (dexNumber(a.item.name) ?? 99999) - (dexNumber(b.item.name) ?? 99999) || byName(a, b)
const gainOf = (r: SortableRow) => (r.item.purchasePrice ? r.unit - r.item.purchasePrice : -Infinity)

function group<R extends SortableRow>(rows: R[], keyOf: (r: R) => string, order: (a: string, b: string) => number, inner: (a: R, b: R) => number) {
  const map = new Map<string, R[]>()
  for (const r of rows) {
    const k = keyOf(r)
    map.set(k, [...(map.get(k) ?? []), r])
  }
  return [...map.entries()]
    .sort(([a], [b]) => order(a, b))
    .map(([key, list]) => ({
      key,
      title: key,
      rows: list.sort(inner),
      count: list.reduce((n, r) => n + r.item.quantity, 0),
      value: list.reduce((s, r) => s + r.unit * r.item.quantity, 0),
    }))
}

/**
 * Range les cartes selon le mode choisi. Renvoie toujours des groupes :
 * un seul groupe sans titre pour les tris simples.
 * `setOrder` : position de chaque extension dans l'ordre de sortie (pour « Par extension »).
 */
export function arrange<R extends SortableRow>(rows: R[], mode: SortMode, setOrder: Map<string, number> = new Map()): Group<R>[] {
  const flat = (sorted: R[]): Group<R>[] => [
    { key: 'all', title: '', rows: sorted, count: 0, value: 0 },
  ]
  const list = [...rows]
  switch (mode) {
    case 'value':
      return flat(list.sort((a, b) => b.unit - a.unit || byName(a, b)))
    case 'cheap':
      return flat(list.sort((a, b) => a.unit - b.unit || byName(a, b)))
    case 'dex':
      return flat(list.sort(byDex))
    case 'name':
      return flat(list.sort(byName))
    case 'recent':
      return flat(list.sort((a, b) => b.item.addedAt.localeCompare(a.item.addedAt)))
    case 'dupes':
      return flat(list.sort((a, b) => b.item.quantity - a.item.quantity || b.unit - a.unit))
    case 'gain':
      return flat(list.sort((a, b) => gainOf(b) - gainOf(a) || b.unit - a.unit))
    case 'type': {
      const rank = (t: string) => (t === NO_TYPE ? 999 : TYPE_ORDER.indexOf(t) === -1 ? 500 : TYPE_ORDER.indexOf(t))
      return group(list, (r) => r.types[0] ?? NO_TYPE, (a, b) => rank(a) - rank(b) || a.localeCompare(b), byDex).map((g) => ({
        ...g,
        color: g.key === NO_TYPE ? undefined : typeColor(g.key),
      }))
    }
    case 'set': {
      const names = new Map(list.map((r) => [r.item.setId, r.item.setName]))
      return group(list, (r) => r.item.setId, (a, b) => (setOrder.get(b) ?? -1) - (setOrder.get(a) ?? -1) || (names.get(a) ?? a).localeCompare(names.get(b) ?? b), byNumber).map(
        (g) => ({ ...g, title: names.get(g.key) ?? g.key }),
      )
    }
    case 'rarity': {
      const level = (label: string) => list.find((r) => rarityInfo(r.rarity).label === label)?.rarity
      return group(
        list,
        (r) => rarityInfo(r.rarity).label,
        (a, b) => rarityInfo(level(b)).level - rarityInfo(level(a)).level || a.localeCompare(b),
        (a, b) => b.unit - a.unit,
      )
    }
  }
}
