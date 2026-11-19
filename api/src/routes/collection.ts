import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db/index.js'
import { requireUser } from './auth.js'

/**
 * Collection et wishlist de l'utilisateur connecté.
 * Les écritures sont « idempotentes » : renvoyer deux fois la même requête
 * (ex. après une coupure réseau) donne le même résultat, sans doublon.
 */

const CONDITIONS = ['NM', 'EX', 'GD', 'LP', 'PL', 'PO'] as const

const itemSchema = z.object({
  cardId: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  image: z.string().url().max(500).optional().nullable(),
  setId: z.string().min(1).max(64),
  setName: z.string().min(1).max(200),
  localId: z.string().min(1).max(32),
  rarity: z.string().max(100).optional().nullable(),
  types: z.array(z.string().max(40)).max(5).default([]),
  condition: z.enum(CONDITIONS),
  quantity: z.number().int().min(1).max(999),
  priceEur: z.number().min(0).max(1_000_000).nullable().optional(),
  purchasePrice: z.number().min(0).max(1_000_000).nullable().optional(),
  addedAt: z.string().datetime().optional(),
})

const wishSchema = z.object({
  name: z.string().min(1).max(200),
  image: z.string().url().max(500).optional().nullable(),
  setName: z.string().min(1).max(200),
  addedAt: z.string().datetime().optional(),
})

// Une case de classeur : une carte (possédée ou non), ou vide (null).
const slotSchema = z
  .object({
    cardId: z.string().min(1).max(64),
    name: z.string().min(1).max(200),
    image: z.string().url().max(500).optional().nullable(),
    setName: z.string().max(200).optional().nullable(),
    localId: z.string().max(32).optional().nullable(),
  })
  .nullable()

const binderSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  perPage: z.union([z.literal(4), z.literal(9), z.literal(12)]),
  slots: z.array(slotSchema).max(2000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type BinderData = z.infer<typeof binderSchema>

interface ItemRow {
  uid: string
  card_id: string
  name: string
  image: string | null
  set_id: string
  set_name: string
  local_id: string
  rarity: string | null
  types: string[]
  condition: string
  quantity: number
  price_eur: number | null
  purchase_price: number | null
  added_at: Date
}

const toItem = (r: ItemRow) => ({
  uid: r.uid,
  cardId: r.card_id,
  name: r.name,
  image: r.image ?? undefined,
  setId: r.set_id,
  setName: r.set_name,
  localId: r.local_id,
  rarity: r.rarity ?? undefined,
  types: r.types,
  condition: r.condition,
  quantity: r.quantity,
  priceEur: r.price_eur,
  purchasePrice: r.purchase_price,
  addedAt: new Date(r.added_at).toISOString(),
})

export async function collectionRoutes(app: FastifyInstance, { db }: { db: Db }) {
  // Toutes ces routes demandent d'être connecté.
  app.addHook('preHandler', async (req, reply) => {
    if (!requireUser(req)) return reply.code(401).send({ error: 'Connecte-toi pour synchroniser ta collection.' })
  })

  app.get('/collection', async (req) => {
    const userId = req.user!.id
    const items = await db.query<ItemRow>('SELECT * FROM collection_items WHERE user_id = $1 ORDER BY added_at', [userId])
    const wishlist = await db.query<{ card_id: string; name: string; image: string | null; set_name: string; added_at: Date }>(
      'SELECT * FROM wishlist WHERE user_id = $1 ORDER BY added_at',
      [userId],
    )
    const binders = await db.query<{ id: string; data: BinderData }>('SELECT id, data FROM binders WHERE user_id = $1', [userId])
    return {
      items: items.map(toItem),
      binders: binders.map((b) => ({ id: b.id, ...(typeof b.data === 'string' ? JSON.parse(b.data) : b.data) })),
      wishlist: wishlist.map((w) => ({
        cardId: w.card_id,
        name: w.name,
        image: w.image ?? undefined,
        setName: w.set_name,
        addedAt: new Date(w.added_at).toISOString(),
      })),
    }
  })

  // Classeurs : ajout ou mise à jour (le plus récent gagne), et suppression.
  app.put<{ Params: { id: string } }>('/binders/:id', async (req, reply) => {
    const id = z.string().uuid().safeParse(req.params.id)
    const body = binderSchema.safeParse(req.body)
    if (!id.success || !body.success) return reply.code(400).send({ error: 'Classeur invalide.' })
    const ok = await upsertBinder(db, req.user!.id, id.data, body.data)
    if (!ok) return reply.code(409).send({ error: 'Ce classeur appartient à un autre compte.' })
    return { ok: true }
  })

  app.delete<{ Params: { id: string } }>('/binders/:id', async (req, reply) => {
    const id = z.string().uuid().safeParse(req.params.id)
    if (!id.success) return reply.code(400).send({ error: 'Identifiant invalide.' })
    await db.query('DELETE FROM binders WHERE id = $1 AND user_id = $2', [id.data, req.user!.id])
    return { ok: true }
  })

  // Ajoute ou met à jour un exemplaire.
  app.put<{ Params: { uid: string } }>('/collection/items/:uid', async (req, reply) => {
    const uid = z.string().uuid().safeParse(req.params.uid)
    const body = itemSchema.safeParse(req.body)
    if (!uid.success || !body.success) return reply.code(400).send({ error: 'Données invalides.' })
    const ok = await upsertItem(db, req.user!.id, uid.data, body.data)
    if (!ok) return reply.code(409).send({ error: 'Cet exemplaire appartient à un autre compte.' })
    return { ok: true }
  })

  app.delete<{ Params: { uid: string } }>('/collection/items/:uid', async (req, reply) => {
    const uid = z.string().uuid().safeParse(req.params.uid)
    if (!uid.success) return reply.code(400).send({ error: 'Identifiant invalide.' })
    await db.query('DELETE FROM collection_items WHERE uid = $1 AND user_id = $2', [uid.data, req.user!.id])
    return { ok: true }
  })

  app.put<{ Params: { cardId: string } }>('/wishlist/:cardId', async (req, reply) => {
    const body = wishSchema.safeParse(req.body)
    if (!body.success || req.params.cardId.length > 64) return reply.code(400).send({ error: 'Données invalides.' })
    await upsertWish(db, req.user!.id, req.params.cardId, body.data)
    return { ok: true }
  })

  app.delete<{ Params: { cardId: string } }>('/wishlist/:cardId', async (req) => {
    await db.query('DELETE FROM wishlist WHERE user_id = $1 AND card_id = $2', [req.user!.id, req.params.cardId])
    return { ok: true }
  })

  // À la première connexion : on envoie ce qui était déjà sur le téléphone.
  app.post('/collection/import', async (req, reply) => {
    const body = z
      .object({
        items: z.array(itemSchema.extend({ uid: z.string().uuid() })).max(5000),
        wishlist: z.array(wishSchema.extend({ cardId: z.string().min(1).max(64) })).max(2000),
        binders: z.array(binderSchema.extend({ id: z.string().uuid() })).max(100).default([]),
      })
      .safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'Données invalides.' })
    let imported = 0
    for (const item of body.data.items) if (await upsertItem(db, req.user!.id, item.uid, item)) imported++
    for (const wish of body.data.wishlist) await upsertWish(db, req.user!.id, wish.cardId, wish)
    for (const { id, ...binder } of body.data.binders) await upsertBinder(db, req.user!.id, id, binder)
    return { ok: true, imported }
  })

  /**
   * Évolution de la valeur de la collection, jour par jour, calculée à partir des photos de prix.
   * Pour chaque jour : somme (prix du jour × quantité × coefficient d'état) des cartes déjà possédées ce jour-là.
   */
  app.get<{ Querystring: { days?: string } }>('/collection/value-history', async (req) => {
    const days = Math.min(365, Math.max(7, Number(req.query.days) || 90))
    const rows = await db.query<{ day: string; value: number; cards: number }>(
      `SELECT to_char(p.day, 'YYYY-MM-DD') AS day,
              sum(p.trend * c.quantity * CASE c.condition
                WHEN 'NM' THEN 1 WHEN 'EX' THEN 0.8 WHEN 'GD' THEN 0.65
                WHEN 'LP' THEN 0.5 WHEN 'PL' THEN 0.35 ELSE 0.2 END)::float8 AS value,
              sum(c.quantity)::int AS cards
       FROM collection_items c
       JOIN price_snapshots p ON p.card_id = c.card_id
       WHERE c.user_id = $1
         AND p.day >= current_date - make_interval(days => $2)
         AND p.day >= c.added_at::date
         AND p.trend IS NOT NULL
       GROUP BY p.day ORDER BY p.day`,
      [req.user!.id, days],
    )
    return { points: rows }
  })
}

async function upsertItem(db: Db, userId: string, uid: string, i: z.infer<typeof itemSchema>): Promise<boolean> {
  const rows = await db.query(
    `INSERT INTO collection_items
       (uid, user_id, card_id, name, image, set_id, set_name, local_id, rarity, types, condition, quantity, price_eur, purchase_price, added_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, COALESCE($15::timestamptz, now()))
     ON CONFLICT (uid) DO UPDATE SET
       condition = EXCLUDED.condition, quantity = EXCLUDED.quantity,
       price_eur = EXCLUDED.price_eur, purchase_price = EXCLUDED.purchase_price,
       rarity = EXCLUDED.rarity, types = EXCLUDED.types, updated_at = now()
     WHERE collection_items.user_id = EXCLUDED.user_id
     RETURNING uid`,
    [
      uid, userId, i.cardId, i.name, i.image ?? null, i.setId, i.setName, i.localId, i.rarity ?? null,
      i.types, i.condition, i.quantity, i.priceEur ?? null, i.purchasePrice ?? null, i.addedAt ?? null,
    ],
  )
  return rows.length > 0
}

async function upsertWish(db: Db, userId: string, cardId: string, w: z.infer<typeof wishSchema>) {
  await db.query(
    `INSERT INTO wishlist (user_id, card_id, name, image, set_name, added_at)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, now()))
     ON CONFLICT (user_id, card_id) DO NOTHING`,
    [userId, cardId, w.name, w.image ?? null, w.setName, w.addedAt ?? null],
  )
}

/** Enregistre un classeur, sauf si le serveur a déjà une version plus récente. Faux si l'id est à un autre compte. */
async function upsertBinder(db: Db, userId: string, id: string, data: BinderData): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    `INSERT INTO binders (id, user_id, data, updated_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
       WHERE binders.user_id = EXCLUDED.user_id AND binders.updated_at <= EXCLUDED.updated_at
     RETURNING id`,
    [id, userId, JSON.stringify(data), data.updatedAt],
  )
  if (rows.length) return true
  // Rien d'écrit : soit une version plus récente existe déjà (normal), soit l'id est à quelqu'un d'autre.
  const [owner] = await db.query<{ user_id: string }>('SELECT user_id FROM binders WHERE id = $1', [id])
  return owner?.user_id === userId
}
