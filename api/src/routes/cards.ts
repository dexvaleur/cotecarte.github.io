import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Config } from '../config.js'
import type { Db } from '../db/index.js'
import { buildNews } from '../news.js'
import { packStatsRunning, refreshPackStats, type SetStats } from '../packs.js'

/**
 * Relais vers TCGdex, avec cache dans la base :
 * - GET /tcgdex/v2/fr/cards/sv03.5-006 → même réponse que TCGdex, mais gardée en cache.
 * - Si TCGdex ne répond pas, on renvoie la dernière copie connue (en-tête X-Cache: stale).
 * - Chaque fiche de carte téléchargée enregistre au passage le prix du jour.
 *
 * Relais d'images (GET /img?u=…) : le serveur d'images de TCGdex envoie son en-tête CORS
 * en double, ce qui empêche l'appli d'analyser les images. On les relaie avec un en-tête correct.
 */

const HOUR = 3600_000
// Chemins autorisés : uniquement la lecture des cartes, extensions et séries.
const ALLOWED_PATH = /^\/v2\/(fr|en)\/(cards|sets|series)(\/[\w.\-%]+)?$/

export interface CardPricing {
  cardmarket?: { trend?: number | null; avg?: number | null; low?: number | null; avg7?: number | null; avg30?: number | null } | null
  tcgplayer?: Record<string, unknown> | null
}

export async function cardRoutes(app: FastifyInstance, { db, config }: { db: Db; config: Config }) {
  const fetchTcgdex = createTcgdexFetcher(db, config)

  app.get('/tcgdex/*', async (req, reply) => {
    const path = '/' + (req.params as { '*': string })['*']
    if (!ALLOWED_PATH.test(path)) return reply.code(404).send({ error: 'Chemin non autorisé.' })
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
    // Fiche d'une carte = prix qui bougent : 6 h. Le reste (listes, extensions) : 24 h.
    const ttl = /\/cards\/[^/]+$/.test(path) ? 6 * HOUR : 24 * HOUR
    const res = await fetchTcgdex(path + query, ttl)
    if (res.status === 404) return reply.code(404).send({ error: 'Introuvable.' })
    if (!res.body) return reply.code(503).send({ error: 'Le service de cartes ne répond pas.' })
    reply.header('X-Cache', res.cache)
    reply.header('Cache-Control', 'public, max-age=600')
    return res.body
  })

  app.get<{ Querystring: { u?: string } }>('/img', async (req, reply) => {
    const parsed = z.string().url().safeParse(req.query.u)
    if (!parsed.success) return reply.code(400).send({ error: 'Adresse invalide.' })
    const url = new URL(parsed.data)
    // Uniquement les images de TCGdex : le serveur ne doit pas servir de relais vers n'importe quel site.
    if (url.protocol !== 'https:' || url.hostname !== 'assets.tcgdex.net') return reply.code(403).send({ error: 'Hôte non autorisé.' })
    let upstream: Response
    try {
      upstream = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    } catch {
      return reply.code(502).send({ error: 'Image indisponible.' })
    }
    if (!upstream.ok) return reply.code(upstream.status === 404 ? 404 : 502).send({ error: 'Image indisponible.' })
    const type = upstream.headers.get('content-type') ?? ''
    if (!type.startsWith('image/')) return reply.code(502).send({ error: 'Ce n’est pas une image.' })
    const buf = Buffer.from(await upstream.arrayBuffer())
    if (buf.length > 3_000_000) return reply.code(502).send({ error: 'Image trop lourde.' })
    reply.header('Content-Type', type)
    reply.header('Cache-Control', 'public, max-age=2592000, immutable')
    reply.header('Access-Control-Allow-Origin', '*')
    return reply.send(buf)
  })

  /** Onglet Packs : statistiques des extensions récentes (calculées une fois par jour). */
  app.get('/packs', async (req) => {
    const rows = await db.query<{ data: SetStats & { rank: number }; updated_at: Date }>('SELECT data, updated_at FROM pack_stats')
    // Rien encore (premier lancement) ou données d'hier : on relance le calcul en arrière-plan.
    const stale = !rows.length || rows.some((r) => Date.now() - new Date(r.updated_at).getTime() > 26 * HOUR)
    if (stale && !packStatsRunning()) refreshPackStats(db, config, (m) => req.log.info(m)).catch((err) => req.log.error({ err }, 'packs'))
    const sets = rows.map((r) => r.data).sort((a, b) => a.rank - b.rank)
    const updatedAt = rows.reduce<string | null>((m, r) => {
      const t = new Date(r.updated_at).toISOString()
      return !m || t < m ? t : m
    }, null)
    return { sets, updatedAt, computing: packStatsRunning() }
  })

  /** Onglet Actus : sorties, prix qui bougent, articles. */
  app.get('/news', async () => buildNews(db))

  /** Historique des prix d'une carte (une valeur par jour). */
  app.get<{ Params: { cardId: string }; Querystring: { days?: string } }>('/prices/:cardId/history', async (req) => {
    const days = Math.min(365, Math.max(7, Number(req.query.days) || 30))
    const points = await db.query<{ day: string; trend: number | null; avg: number | null; low: number | null }>(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, trend, avg, low FROM price_snapshots
       WHERE card_id = $1 AND day >= current_date - make_interval(days => $2) ORDER BY day`,
      [req.params.cardId, days],
    )
    return { points }
  })

  /** Prix actuels de plusieurs cartes d'un coup (pour la valeur de la collection). */
  app.post('/prices/latest', async (req, reply) => {
    const body = z.object({ ids: z.array(z.string().min(1).max(64)).max(500) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Données invalides.' })
    const ids = [...new Set(body.data.ids)]
    const out: Record<string, { eur: number | null; rarity?: string; types?: string[] }> = {}
    await mapLimit(ids, 6, async (id) => {
      const res = await fetchTcgdex(`/v2/fr/cards/${encodeURIComponent(id)}`, 6 * HOUR)
      const card = (res.body ?? (await fetchTcgdex(`/v2/en/cards/${encodeURIComponent(id)}`, 6 * HOUR)).body) as
        | { pricing?: CardPricing; rarity?: string; types?: string[] }
        | null
      if (!card) return
      const cm = card.pricing?.cardmarket
      out[id] = { eur: firstPositive(cm?.trend, cm?.avg, cm?.avg30), rarity: card.rarity, types: card.types }
    })
    return { prices: out }
  })
}

/** Télécharge depuis TCGdex en passant par le cache ; enregistre le prix du jour des fiches de carte. */
export function createTcgdexFetcher(db: Db, config: Config) {
  return async function fetchTcgdex(
    pathAndQuery: string,
    ttlMs: number,
  ): Promise<{ status: number; body: unknown | null; cache: 'hit' | 'miss' | 'stale' }> {
    const [cached] = await db.query<{ body: unknown; fetched_at: Date }>('SELECT body, fetched_at FROM api_cache WHERE key = $1', [pathAndQuery])
    if (cached && Date.now() - new Date(cached.fetched_at).getTime() < ttlMs) return { status: 200, body: cached.body, cache: 'hit' }
    try {
      const res = await fetch(config.TCGDEX_URL + pathAndQuery, { signal: AbortSignal.timeout(15_000) })
      if (res.status === 404) return { status: 404, body: null, cache: 'miss' }
      if (!res.ok) throw new Error(`TCGdex ${res.status}`)
      const body = await res.json()
      await db.query(
        `INSERT INTO api_cache (key, body, fetched_at) VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET body = EXCLUDED.body, fetched_at = now()`,
        [pathAndQuery, JSON.stringify(body)],
      )
      const cardMatch = /^\/v2\/(?:fr|en)\/cards\/([^/?]+)$/.exec(pathAndQuery)
      if (cardMatch) await recordSnapshot(db, decodeURIComponent(cardMatch[1]), (body as { pricing?: CardPricing }).pricing)
      return { status: 200, body, cache: 'miss' }
    } catch {
      return cached ? { status: 200, body: cached.body, cache: 'stale' } : { status: 503, body: null, cache: 'miss' }
    }
  }
}

/** Enregistre le prix du jour d'une carte (une ligne par carte et par jour). */
export async function recordSnapshot(db: Db, cardId: string, pricing: CardPricing | undefined) {
  const cm = pricing?.cardmarket
  if (!cm) return
  const tp = pricing?.tcgplayer as Record<string, { marketPrice?: number }> | undefined
  const tcgMarket = tp ? firstPositive(...Object.values(tp).map((v) => (typeof v === 'object' ? v?.marketPrice : undefined))) : null
  await db.query(
    `INSERT INTO price_snapshots (card_id, day, trend, avg, low, avg30, tcg_market)
     VALUES ($1, current_date, $2, $3, $4, $5, $6)
     ON CONFLICT (card_id, day) DO UPDATE SET trend = EXCLUDED.trend, avg = EXCLUDED.avg,
       low = EXCLUDED.low, avg30 = EXCLUDED.avg30, tcg_market = EXCLUDED.tcg_market`,
    [cardId, firstPositive(cm.trend), firstPositive(cm.avg), firstPositive(cm.low), firstPositive(cm.avg30), tcgMarket],
  )
}

function firstPositive(...v: (number | null | undefined)[]): number | null {
  for (const x of v) if (typeof x === 'number' && x > 0) return x
  return null
}

/** Lance `fn` sur chaque élément, au plus `limit` à la fois. */
export async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++])
  })
  await Promise.all(workers)
}
