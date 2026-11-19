import type { Config } from './config.js'
import type { Db } from './db/index.js'
import { type CardPricing, createTcgdexFetcher, mapLimit } from './routes/cards.js'

/**
 * Onglet « Packs » : statistiques des extensions récentes, pour aider à choisir quoi ouvrir.
 * Pour chaque extension, on télécharge toutes les cartes (prix Cardmarket) et on calcule :
 * - les cartes stars (les plus chères) ;
 * - combien de cartes valent plus de 5 € / 20 € ;
 * - la valeur moyenne des cartes « hors série » (numéro au-dessus du total officiel) ;
 * - le prix pour compléter l'extension en achetant chaque carte à l'unité.
 */

const DAY = 24 * 3_600_000
const SERIES = ['me', 'sv'] // séries récentes (Méga-Évolution, Écarlate et Violet)
const MAX_SETS = 8

export interface StarCard {
  id: string
  name: string
  localId: string
  image?: string
  rarity?: string
  eur: number
}

export interface SetStats {
  id: string
  name: string
  logo?: string
  serie: string
  releaseDate: string
  official: number
  total: number
  /** Cartes dont on connaît le prix */
  priced: number
  top: StarCard[]
  over5: number
  over20: number
  /** Valeur moyenne d'une carte hors série (null s'il n'y en a pas avec prix) */
  secretAvg: number | null
  secretCount: number
  /** Somme des prix de toutes les cartes (1 exemplaire de chaque) */
  fullSetEur: number
}

interface SetDetail {
  id: string
  name: string
  logo?: string
  releaseDate?: string
  serie?: { id: string; name: string }
  cardCount?: { official?: number; total?: number }
  cards?: { id: string; localId: string; name: string; image?: string }[]
}

interface CardDetail {
  id: string
  localId: string
  name: string
  image?: string
  rarity?: string
  pricing?: CardPricing
}

const price = (c: CardDetail): number | null => {
  const cm = c.pricing?.cardmarket
  for (const v of [cm?.trend, cm?.avg, cm?.avg30]) if (typeof v === 'number' && v > 0) return v
  return null
}

const round = (n: number) => Math.round(n * 100) / 100

/** Calcul pur (testé) à partir de la fiche de l'extension et des fiches de ses cartes. */
export function computeSetStats(set: SetDetail, cards: CardDetail[]): SetStats {
  const official = set.cardCount?.official ?? 0
  const priced = cards.map((c) => ({ c, eur: price(c) })).filter((x): x is { c: CardDetail; eur: number } => x.eur !== null)
  const secrets = priced.filter(({ c }) => {
    const n = parseInt(c.localId, 10)
    return official > 0 && Number.isFinite(n) && n > official
  })
  const top = [...priced]
    .sort((a, b) => b.eur - a.eur)
    .slice(0, 6)
    .map(({ c, eur }) => ({ id: c.id, name: c.name, localId: c.localId, image: c.image, rarity: c.rarity, eur: round(eur) }))
  return {
    id: set.id,
    name: set.name,
    logo: set.logo,
    serie: set.serie?.name ?? '',
    releaseDate: set.releaseDate ?? '',
    official,
    total: set.cardCount?.total ?? cards.length,
    priced: priced.length,
    top,
    over5: priced.filter((x) => x.eur >= 5).length,
    over20: priced.filter((x) => x.eur >= 20).length,
    secretAvg: secrets.length ? round(secrets.reduce((s, x) => s + x.eur, 0) / secrets.length) : null,
    secretCount: secrets.length,
    fullSetEur: round(priced.reduce((s, x) => s + x.eur, 0)),
  }
}

/** Extensions principales récentes déjà sorties (hors promos et mini-collections). */
export async function recentSetIds(fetchTcgdex: ReturnType<typeof createTcgdexFetcher>): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10)
  const found: { id: string; date: string }[] = []
  for (const serie of SERIES) {
    const res = await fetchTcgdex(`/v2/fr/series/${serie}`, DAY)
    const sets = (res.body as { sets?: { id: string; cardCount?: { official?: number } }[] } | null)?.sets ?? []
    for (const s of sets) {
      if ((s.cardCount?.official ?? 0) < 60 || /p$|-c$/.test(s.id)) continue
      const d = (await fetchTcgdex(`/v2/fr/sets/${encodeURIComponent(s.id)}`, DAY)).body as SetDetail | null
      if (d?.releaseDate && d.releaseDate <= today) found.push({ id: s.id, date: d.releaseDate })
    }
    if (found.length >= MAX_SETS) break
  }
  return found
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_SETS)
    .map((s) => s.id)
}

let running: Promise<number> | null = null

/** Recalcule les extensions dont les statistiques ont plus d'un jour. Un seul calcul à la fois. */
export function refreshPackStats(db: Db, config: Config, log: (m: string) => void = () => {}): Promise<number> {
  running ??= (async () => {
    const fetchTcgdex = createTcgdexFetcher(db, config)
    const ids = await recentSetIds(fetchTcgdex)
    const fresh = new Set(
      (await db.query<{ set_id: string }>(`SELECT set_id FROM pack_stats WHERE updated_at > now() - interval '20 hours'`)).map((r) => r.set_id),
    )
    let done = 0
    for (const id of ids) {
      if (fresh.has(id)) continue
      const set = (await fetchTcgdex(`/v2/fr/sets/${encodeURIComponent(id)}`, DAY)).body as SetDetail | null
      if (!set?.cards?.length) continue
      const cards: CardDetail[] = []
      await mapLimit(set.cards, 4, async (brief) => {
        const res = await fetchTcgdex(`/v2/fr/cards/${encodeURIComponent(brief.id)}`, DAY)
        if (res.body) cards.push(res.body as CardDetail)
      })
      const stats = computeSetStats(set, cards)
      await db.query(
        `INSERT INTO pack_stats (set_id, data, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (set_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [id, JSON.stringify({ ...stats, rank: ids.indexOf(id) })],
      )
      done++
      log(`🎁 Statistiques de l’extension ${set.name} calculées (${cards.length} cartes)`)
    }
    // Les extensions qui ne font plus partie des récentes sont retirées.
    if (ids.length) await db.query(`DELETE FROM pack_stats WHERE NOT (set_id = ANY($1))`, [ids])
    return done
  })().finally(() => {
    running = null
  })
  return running
}

export const packStatsRunning = () => running !== null
