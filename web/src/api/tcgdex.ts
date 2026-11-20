import { ApiError, cachedJson, DAY, HOUR } from './cache'
import type { Cached, Card, CardBrief, Lang, SetBrief, SetDetail } from './types'
import { sameLocalId } from '../scan/parse'
import { API_URL } from '../lib/api'
import { splitCardId, withLang } from './cardId'

/**
 * Accès à TCGdex (https://tcgdex.dev) : base de données gratuite des cartes Pokémon,
 * disponible en français, avec les prix Cardmarket et TCGplayer.
 * Toutes les fonctions passent par le cache (voir cache.ts).
 */

const DIRECT = 'https://api.tcgdex.net/v2'
// Avec notre serveur : on passe par lui (cache partagé, prix du jour enregistrés).
// S'il ne répond pas, on se rabat directement sur TCGdex.
const BASE = API_URL ? `${API_URL}/tcgdex/v2` : DIRECT

function get<T>(path: string, ttlMs: number): Promise<Cached<T>> {
  return cachedJson<T>(BASE + path, ttlMs, API_URL ? DIRECT + path : undefined)
}

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
    const { data } = await get<{ sets: { id: string }[] }>(`/fr/series/tcgp`, 7 * DAY)
    return new Set(data.sets.map((s) => s.id))
  } catch {
    return new Set()
  }
}

export async function getSets(lang: Lang = 'fr'): Promise<SetBrief[]> {
  if (lang !== 'fr' && lang !== 'en') {
    // Extensions asiatiques : identifiants préfixés par la langue (« ja:SV2a »).
    const { data } = await get<SetBrief[]>(`/${lang}/sets`, DAY)
    return data.map((s) => ({ ...s, id: withLang(lang, s.id) }))
  }
  const [{ data }, pocket] = await Promise.all([get<SetBrief[]>(`/${lang}/sets`, DAY), pocketSetIds()])
  return data.filter((s) => !pocket.has(s.id))
}

export async function getSet(id: string, lang: Lang = 'fr'): Promise<Cached<SetDetail>> {
  const { lang: asian, raw } = splitCardId(id)
  if (!asian) return get<SetDetail>(`/${lang}/sets/${encodeURIComponent(id)}`, DAY)
  const [res, { frenchBriefs }] = await Promise.all([get<SetDetail>(`/${asian}/sets/${encodeURIComponent(raw)}`, DAY), import('./frenchify')])
  const cards = frenchBriefs(res.data.cards.map((c) => ({ ...c, id: withLang(asian, c.id) })))
  return { ...res, data: { ...res.data, id, cards } }
}

/** Fiche complète d'une carte : en français si elle existe, sinon en anglais. */
export async function getCard(id: string): Promise<Cached<Card>> {
  const { lang: asian, raw } = splitCardId(id)
  if (asian) {
    const [res, { frenchify }] = await Promise.all([get<Omit<Card, 'lang'>>(`/${asian}/cards/${encodeURIComponent(raw)}`, 6 * HOUR), import('./frenchify')])
    // Textes en français : on cherche la même carte en version française (voir frenchify.ts).
    const data = await frenchify({ ...res.data, id, lang: asian }, async (path) => (await get(path, 7 * DAY)).data as never)
    return { ...res, data }
  }
  try {
    const res = await get<Omit<Card, 'lang'>>(`/fr/cards/${encodeURIComponent(id)}`, 6 * HOUR)
    return { ...res, data: { ...res.data, lang: 'fr' } }
  } catch (err) {
    if (!(err instanceof ApiError) || err.kind !== 'notfound') throw err
    const res = await get<Omit<Card, 'lang'>>(`/en/cards/${encodeURIComponent(id)}`, 6 * HOUR)
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
  const path = (lang: Lang) => `/${lang}/cards?name=${encodeURIComponent(q)}&pagination:itemsPerPage=400`
  const [fr, en, sets] = await Promise.all([
    get<CardBrief[]>(path('fr'), DAY).then((r) => r.data).catch(rethrowUnlessNotFound),
    get<CardBrief[]>(path('en'), DAY).then((r) => r.data).catch(rethrowUnlessNotFound),
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
export async function searchByNumber(raw: string, total: number | null, tolerance = 0, lang: Lang = 'fr'): Promise<CardBrief[]> {
  if (total === null) return []
  const sets = lang === 'fr' ? await getSets('fr').catch(() => getSets('en')) : await getSets(lang)
  // tolerance : accepte un total lu à 1 ou 2 près (« 196 » lu au lieu de « 198 »).
  const close = (n: number | undefined) => n !== undefined && Math.abs(n - total) <= tolerance
  const diff = (s: SetBrief) => Math.min(Math.abs(s.cardCount.official - total), Math.abs(s.cardCount.total - total))
  // Les plus proches du total lu d'abord, puis les plus récentes (la liste est dans l'ordre de sortie).
  const matching = sets
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => close(s.cardCount.official) || close(s.cardCount.total))
    .sort((a, b) => diff(a.s) - diff(b.s) || b.i - a.i)
    .map(({ s }) => s)
  const results = await Promise.all(
    matching.slice(0, 10).map(async (s) => {
      try {
        const { data } = await getSet(s.id, lang === 'en' ? 'en' : 'fr')
        return data.cards.filter((c) => sameLocalId(c.localId, raw))
      } catch {
        return []
      }
    }),
  )
  return results.flat()
}
