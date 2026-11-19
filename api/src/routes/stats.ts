import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Config } from '../config.js'
import type { Db } from '../db/index.js'

/**
 * Statistiques de visite, sans cookie et anonymes.
 * L'appli envoie au plus une fois par jour « visitor » (et « new » la toute première fois),
 * « open » à chaque ouverture et « scan » à chaque scan. Le serveur additionne, c'est tout.
 */
export const METRICS = ['open', 'visitor', 'new', 'scan'] as const

export function adminSet(config: Config): Set<string> {
  return new Set(
    config.ADMIN_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
}

export async function statsRoutes(app: FastifyInstance, { db, config }: { db: Db; config: Config }) {
  const admins = adminSet(config)

  app.post('/stats/hit', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = z.object({ events: z.array(z.enum(METRICS)).min(1).max(METRICS.length) }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Requête invalide.' })
    for (const metric of new Set(parsed.data.events)) {
      await db.query(
        `INSERT INTO stats_daily (day, metric, count) VALUES (current_date, $1, 1)
         ON CONFLICT (day, metric) DO UPDATE SET count = stats_daily.count + 1`,
        [metric],
      )
    }
    return reply.code(204).send()
  })

  app.get('/admin/stats', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'Non connecté.' })
    if (!admins.has(req.user.email)) return reply.code(403).send({ error: 'Réservé à l’administrateur.' })

    const [totals] = await db.query<{ users: number; collectors: number; cards: number; visitors30: number; scans30: number }>(
      `SELECT
         (SELECT count(*)::int FROM users) AS users,
         (SELECT count(DISTINCT user_id)::int FROM collection_items) AS collectors,
         (SELECT coalesce(sum(quantity), 0)::int FROM collection_items) AS cards,
         (SELECT coalesce(sum(count), 0)::int FROM stats_daily WHERE metric = 'visitor' AND day > current_date - 30) AS visitors30,
         (SELECT coalesce(sum(count), 0)::int FROM stats_daily WHERE metric = 'scan' AND day > current_date - 30) AS scans30`,
    )
    const days = await db.query<{ day: string; open: number; visitor: number; new: number; scan: number; signups: number; logins: number }>(
      `WITH d AS (SELECT generate_series(current_date - 29, current_date, interval '1 day')::date AS day)
       SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
         coalesce((SELECT count FROM stats_daily s WHERE s.day = d.day AND metric = 'open'), 0) AS open,
         coalesce((SELECT count FROM stats_daily s WHERE s.day = d.day AND metric = 'visitor'), 0) AS visitor,
         coalesce((SELECT count FROM stats_daily s WHERE s.day = d.day AND metric = 'new'), 0) AS new,
         coalesce((SELECT count FROM stats_daily s WHERE s.day = d.day AND metric = 'scan'), 0) AS scan,
         (SELECT count(*)::int FROM users u WHERE date(u.created_at) = d.day) AS signups,
         (SELECT count(*)::int FROM sessions x WHERE date(x.created_at) = d.day) AS logins
       FROM d ORDER BY d.day DESC`,
    )
    return { totals, days }
  })
}
