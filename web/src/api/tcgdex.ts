import { ApiError, cachedJson, DAY, HOUR } from './cache'
import type { Cached, Card, CardBrief, Lang, SetBrief, SetDetail } from './types'
import { sameLocalId } from '../scan/parse'

/**
 * Accès à TCGdex (https://tcgdex.dev) : base de données gratuite des cartes Pokémon,
 * disponible en français, avec les prix Cardmarket et TCGplayer.
 * Toutes les fonctions passent par le cache (voir cache.ts).
 */

const BASE = 'https://api.tcgdex.net/v2'

/** URL d'une image de carte. quality : « low » (vignette) ou « high » (HD). */
export function cardImage(image: string | undefined, quality: 'low' | 'high' = 'low'): string | undefined {
  return image ? `${image}/${quality}.webp` : undefined
}

/** Identifiant de l'extension à partir de l'identifiant de la carte (« sv03.5-006 » → « sv03.5 »). */
export function setIdOf(cardId: string): string {
  return cardId.slice(0, cardId.lastIndexOf('-'))
}

/** Extensions du jeu mobile « TCG Pocket » : cartes virtuelles, à exclure. */
async function pocketSetIds(): Promise<Set<string>> {
  try {
    const { data } = await cachedJson<{ sets: { id: string }[] }>(`${BASE}/fr/series/tcgp`, 7 * DAY)
    return new Set(data.sets.map((s) => s.id))
  } catch {
    return new Set()
  }
}

export async function getSets(lang: Lang = 'fr'): Promise<SetBrief[]> {
  const [{ data }, pocket] = await Promise.all([cachedJson<SetBrief[]>(`${BASE}/${lang}/sets`, DAY), pocketSetIds()])
  return data.filter((s) => !pocket.has(s.id))
}

export async function getSet(id: string, lang: Lang = 'fr'): Promise<Cached<SetDetail>> {
  return cachedJson<SetDetail>(`${BASE}/${lang}/sets/${encodeURIComponent(id)}`, DAY)
}

/** Fiche complète d'une carte : en français si elle existe, sinon en anglais. */
export async function getCard(id: string): Promise<Cached<Card>> {
  try {
    const res = await cachedJson<Omit<Card, 'lang'>>(`${BASE}/fr/cards/${encodeURIComponent(id)}`, 6 * HOUR)
    return { ...res, data: { ...res.data, lang: 'fr' } }
  } catch (err) {
    if (!(err instanceof ApiError) || err.kind !== 'notfound') throw err
    const res = await cachedJson<Omit<Card, 'lang'>>(`${BASE}/en/cards/${encodeURIComponent(id)}`, 6 * HOUR)
    return { ...res, data: { ...res.data, lang: 'en' } }
  }
}

/**
 * Recherche par nom (en français ET en anglais, pour les cartes dans les deux langues).
 * « Dracau » trouve « Dracaufeu », « Dracaufeu-ex »…
 */
export async function searchByName(name: string): Promise<CardBrief[]> {
  const q = name.trim()
  if (q.length < 2) return []
  const url = (lang: Lang) => `${BASE}/${lang}/cards?name=${encodeURIComponent(q)}&pagination:itemsPerPage=400`
  const [fr, en, sets] = await Promise.all([
    cachedJson<CardBrief[]>(url('fr'), DAY).then((r) => r.data).catch(rethrowUnlessNotFound),
    cachedJson<CardBrief[]>(url('en'), DAY).then((r) => r.data).catch(rethrowUnlessNotFound),
    getSets('fr').catch(() => [] as SetBrief[]),
  ])
  // Une même carte peut apparaître en FR et en EN : on garde la version française.
  const byId = new Map<string, CardBrief>()
  for (const c of [...fr, ...en]) if (!byId.has(c.id)) byId.set(c.id, c)

  // La liste des extensions est dans l'ordre de sortie : on s'en sert pour
  // montrer les cartes les plus récentes en premier, et écarter TCG Pocket.
  const order = new Map(sets.map((s, i) => [s.id, i]))
  const pocket = await pocketSetIds()
  return [...byId.values()]
    .filter((c) => !pocket.has(setIdOf(c.id)))
    .sort((a, b) => (order.get(setIdOf(b.id)) ?? -1) - (order.get(setIdOf(a.id)) ?? -1))
}

function rethrowUnlessNotFound(err: unknown): CardBrief[] {
  if (err instanceof ApiError && err.kind === 'notfound') return []
  throw err
}

/**
 * Recherche par numéro imprimé (ex. 6 et 165 pour « 006/165 »).
 * On cherche les extensions qui ont 165 cartes, puis la carte n°6 dans chacune.
 */
export async function searchByNumber(raw: string, total: number | null): Promise<CardBrief[]> {
  if (total === null) return []
  const sets = await getSets('fr').catch(() => getSets('en'))
  const matching = sets.filter((s) => s.cardCount.official === total || s.cardCount.total === total)
  const results = await Promise.all(
    matching.slice(0, 8).map(async (s) => {
      try {
        const { data } = await getSet(s.id)
        return data.cards.filter((c) => sameLocalId(c.localId, raw))
      } catch {
        return []
      }
    }),
  )
  return results.flat()
}
