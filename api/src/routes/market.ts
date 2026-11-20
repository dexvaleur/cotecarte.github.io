import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Config } from '../config.js'
import type { Db } from '../db/index.js'
import { requireUser, type AuthUser } from './auth.js'
import { adminSet } from './stats.js'

/**
 * Onglet Vendre, façon Vinted :
 * - des annonces (photos, titre, prix, description, hashtags) visibles par tous ;
 * - un chat privé entre le vendeur et chaque acheteur intéressé ;
 * - bloquer un membre, signaler une annonce.
 * On ne montre jamais l'email : seulement le pseudo et l'avatar du profil.
 */

const MAX_PHOTOS = 5
const MAX_PHOTO_BYTES = 450_000
const MAX_ACTIVE_LISTINGS = 40
const PAGE = 30

const KINDS = ['vente', 'echange', 'les2'] as const
const STATUSES = ['active', 'reservee', 'vendue'] as const
const CONDITIONS = ['NM', 'EX', 'GD', 'LP', 'PL', 'PO'] as const

/** « #Dracaufeu », « dracaufeu » → « dracaufeu ». Lettres (accents compris), chiffres, tirets. */
export function cleanTag(t: string): string {
  return t
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, 24)
}

const listingBody = z.object({
  title: z.string().trim().min(2, 'Donne un titre à ton annonce.').max(80),
  description: z.string().trim().max(1500).default(''),
  hashtags: z.array(z.string().max(40)).max(15).default([]),
  kind: z.enum(KINDS).default('vente'),
  priceEur: z.number().min(0).max(100_000).nullable().default(null),
  condition: z.enum(CONDITIONS).nullable().default(null),
  cardId: z.string().max(64).nullable().default(null),
  photos: z.array(z.string().max(700_000)).max(MAX_PHOTOS).optional(),
})

function decodePhoto(dataUrl: string): Buffer | null {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!m) return null
  const buf = Buffer.from(m[1], 'base64')
  // Un vrai JPEG commence par FF D8.
  if (buf.length < 100 || buf.length > MAX_PHOTO_BYTES || buf[0] !== 0xff || buf[1] !== 0xd8) return null
  return buf
}

interface ListingRow {
  id: string
  user_id: string
  title: string
  description: string
  hashtags: string[]
  kind: string
  price_eur: number | null
  condition: string | null
  card_id: string | null
  status: string
  photo_count: number
  created_at: Date | string
  updated_at: Date | string
  profile: { pseudo?: string; avatar?: unknown } | null
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString())

function toListing(r: ListingRow, me: AuthUser | null, full = false) {
  return {
    id: r.id,
    title: r.title,
    ...(full ? { description: r.description, cardId: r.card_id } : {}),
    hashtags: r.hashtags,
    kind: r.kind,
    priceEur: r.price_eur,
    condition: r.condition,
    status: r.status,
    photoCount: r.photo_count,
    version: new Date(r.updated_at).getTime(),
    createdAt: iso(r.created_at),
    mine: !!me && me.id === r.user_id,
    seller: { id: r.user_id, pseudo: r.profile?.pseudo || 'Dresseur', avatar: r.profile?.avatar ?? null },
  }
}

const SELECT_LISTING = `SELECT l.*, u.profile FROM listings l JOIN users u ON u.id = l.user_id`

export async function marketRoutes(app: FastifyInstance, { db, config }: { db: Db; config: Config }) {
  const admins = adminSet(config)

  /** Utilisateur connecté avec un pseudo (obligatoire pour publier et discuter). */
  async function member(req: FastifyRequest, reply: FastifyReply): Promise<AuthUser | null> {
    const user = requireUser(req)
    if (!user) {
      reply.code(401).send({ error: 'Connecte-toi pour continuer.' })
      return null
    }
    const [row] = await db.query<{ pseudo: string | null }>(`SELECT profile->>'pseudo' AS pseudo FROM users WHERE id = $1`, [user.id])
    if (!row?.pseudo?.trim()) {
      reply.code(400).send({ error: 'Choisis d’abord un pseudo dans l’onglet Profil.', code: 'pseudo' })
      return null
    }
    return user
  }

  async function blockedBetween(a: string, b: string): Promise<boolean> {
    const rows = await db.query('SELECT 1 FROM blocks WHERE (user_id = $1 AND blocked_id = $2) OR (user_id = $2 AND blocked_id = $1)', [a, b])
    return rows.length > 0
  }

  async function savePhotos(listingId: string, photos: string[]): Promise<boolean> {
    const bufs = photos.map(decodePhoto)
    if (bufs.some((b) => !b)) return false
    await db.query('DELETE FROM listing_photos WHERE listing_id = $1', [listingId])
    for (const [pos, buf] of bufs.entries()) {
      await db.query('INSERT INTO listing_photos (listing_id, pos, data) VALUES ($1, $2, $3)', [listingId, pos, buf])
    }
    await db.query('UPDATE listings SET photo_count = $2 WHERE id = $1', [listingId, bufs.length])
    return true
  }

  // ---- Annonces -------------------------------------------------------------

  app.get('/listings', async (req) => {
    const q = z
      .object({
        q: z.string().max(80).optional(),
        tag: z.string().max(40).optional(),
        mine: z.string().optional(),
        seller: z.string().uuid().optional(),
        before: z.string().datetime().optional(),
      })
      .safeParse(req.query)
    const p = q.success ? q.data : {}
    const me = req.user
    const where: string[] = []
    const params: unknown[] = []
    const add = (v: unknown) => {
      params.push(v)
      return `$${params.length}`
    }
    if (p.mine && me) where.push(`l.user_id = ${add(me.id)}`)
    else {
      where.push(`l.status <> 'vendue'`)
      if (p.seller) where.push(`l.user_id = ${add(p.seller)}`)
      if (me) where.push(`NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id = ${add(me.id)} AND b.blocked_id = l.user_id) OR (b.blocked_id = $${params.length} AND b.user_id = l.user_id))`)
    }
    const tag = p.tag ? cleanTag(p.tag) : ''
    if (tag) where.push(`${add(tag)} = ANY(l.hashtags)`)
    const words = (p.q ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 5)
    for (const w of words) {
      const like = `%${w.replace(/[\\%_]/g, (c) => '\\' + c)}%`
      const t = cleanTag(w)
      where.push(`(l.title ILIKE ${add(like)} OR l.description ILIKE $${params.length} OR ${add(t)} = ANY(l.hashtags))`)
    }
    if (p.before) where.push(`l.created_at < ${add(p.before)}`)
    const rows = await db.query<ListingRow>(
      `${SELECT_LISTING} WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC LIMIT ${PAGE + 1}`,
      params,
    )
    const page = rows.slice(0, PAGE)
    return {
      listings: page.map((r) => toListing(r, me)),
      next: rows.length > PAGE ? iso(page[page.length - 1].created_at) : null,
    }
  })

  app.get('/listings/:id', async (req, reply) => {
    const id = z.string().uuid().safeParse((req.params as { id: string }).id)
    if (!id.success) return reply.code(404).send({ error: 'Annonce introuvable.' })
    const [row] = await db.query<ListingRow>(`${SELECT_LISTING} WHERE l.id = $1`, [id.data])
    if (!row) return reply.code(404).send({ error: 'Cette annonce n’existe plus.' })
    const me = req.user
    let conversationId: string | null = null
    if (me && me.id !== row.user_id) {
      const [c] = await db.query<{ id: string }>('SELECT id FROM conversations WHERE listing_id = $1 AND buyer_id = $2', [row.id, me.id])
      conversationId = c?.id ?? null
    }
    return { listing: { ...toListing(row, me, true), conversationId }, canModerate: !!me && admins.has(me.email) }
  })

  app.get('/listings/:id/photos/:pos', async (req, reply) => {
    const { id, pos } = req.params as { id: string; pos: string }
    if (!z.string().uuid().safeParse(id).success || !/^\d$/.test(pos)) return reply.code(404).send()
    const [row] = await db.query<{ data: Uint8Array }>('SELECT data FROM listing_photos WHERE listing_id = $1 AND pos = $2', [id, Number(pos)])
    if (!row) return reply.code(404).send()
    // L'adresse contient la version de l'annonce : la photo peut rester en cache longtemps.
    return reply
      .header('content-type', 'image/jpeg')
      .header('cache-control', 'public, max-age=604800, immutable')
      .header('cross-origin-resource-policy', 'cross-origin')
      .send(Buffer.from(row.data))
  })

  app.post('/listings', { bodyLimit: 3_500_000, config: { rateLimit: { max: 15, timeWindow: '1 hour' } } }, async (req, reply) => {
    const user = await member(req, reply)
    if (!user) return
    const parsed = listingBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Annonce invalide.' })
    const b = parsed.data
    if (!b.photos?.length) return reply.code(400).send({ error: 'Ajoute au moins une photo.' })
    const [{ count }] = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM listings WHERE user_id = $1 AND status <> 'vendue'`, [user.id])
    if (count >= MAX_ACTIVE_LISTINGS) return reply.code(400).send({ error: `Maximum ${MAX_ACTIVE_LISTINGS} annonces en ligne. Marque-en certaines comme vendues.` })
    const tags = [...new Set(b.hashtags.map(cleanTag).filter(Boolean))].slice(0, 10)
    const [row] = await db.query<{ id: string }>(
      `INSERT INTO listings (user_id, title, description, hashtags, kind, price_eur, condition, card_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [user.id, b.title, b.description, tags, b.kind, b.kind === 'echange' ? null : b.priceEur, b.condition, b.cardId],
    )
    if (!(await savePhotos(row.id, b.photos))) {
      await db.query('DELETE FROM listings WHERE id = $1', [row.id])
      return reply.code(400).send({ error: 'Une photo est invalide ou trop lourde.' })
    }
    return { id: row.id }
  })

  async function ownListing(req: FastifyRequest, reply: FastifyReply, allowAdmin = false) {
    const user = requireUser(req)
    if (!user) {
      reply.code(401).send({ error: 'Connecte-toi pour continuer.' })
      return null
    }
    const id = (req.params as { id: string }).id
    const [row] = z.string().uuid().safeParse(id).success ? await db.query<{ user_id: string }>('SELECT user_id FROM listings WHERE id = $1', [id]) : []
    if (!row) {
      reply.code(404).send({ error: 'Cette annonce n’existe plus.' })
      return null
    }
    if (row.user_id !== user.id && !(allowAdmin && admins.has(user.email))) {
      reply.code(403).send({ error: 'Ce n’est pas ton annonce.' })
      return null
    }
    return id
  }

  app.put('/listings/:id', { bodyLimit: 3_500_000 }, async (req, reply) => {
    const id = await ownListing(req, reply)
    if (!id) return
    const parsed = listingBody.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Annonce invalide.' })
    const b = parsed.data
    if (b.photos && !b.photos.length) return reply.code(400).send({ error: 'Ajoute au moins une photo.' })
    if (b.photos && !(await savePhotos(id, b.photos))) return reply.code(400).send({ error: 'Une photo est invalide ou trop lourde.' })
    const tags = [...new Set(b.hashtags.map(cleanTag).filter(Boolean))].slice(0, 10)
    await db.query(
      `UPDATE listings SET title = $2, description = $3, hashtags = $4, kind = $5, price_eur = $6, condition = $7, card_id = $8, updated_at = now() WHERE id = $1`,
      [id, b.title, b.description, tags, b.kind, b.kind === 'echange' ? null : b.priceEur, b.condition, b.cardId],
    )
    return { ok: true }
  })

  app.put('/listings/:id/status', async (req, reply) => {
    const id = await ownListing(req, reply)
    if (!id) return
    const parsed = z.object({ status: z.enum(STATUSES) }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Statut invalide.' })
    await db.query('UPDATE listings SET status = $2, updated_at = now() WHERE id = $1', [id, parsed.data.status])
    return { ok: true }
  })

  app.delete('/listings/:id', async (req, reply) => {
    const id = await ownListing(req, reply, true)
    if (!id) return
    await db.query('DELETE FROM listings WHERE id = $1', [id])
    return { ok: true }
  })

  app.post('/listings/:id/report', { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, async (req, reply) => {
    const user = requireUser(req)
    if (!user) return reply.code(401).send({ error: 'Connecte-toi pour signaler.' })
    const id = (req.params as { id: string }).id
    const parsed = z.object({ reason: z.string().trim().min(1).max(300) }).safeParse(req.body)
    if (!parsed.success || !z.string().uuid().safeParse(id).success) return reply.code(400).send({ error: 'Signalement invalide.' })
    const [row] = await db.query<{ user_id: string }>('SELECT user_id FROM listings WHERE id = $1', [id])
    if (!row) return reply.code(404).send({ error: 'Cette annonce n’existe plus.' })
    await db.query('INSERT INTO reports (reporter_id, listing_id, target_id, reason) VALUES ($1, $2, $3, $4)', [user.id, id, row.user_id, parsed.data.reason])
    return { ok: true }
  })

  // ---- Discussions ----------------------------------------------------------

  /** Ouvre (ou retrouve) la discussion avec le vendeur d'une annonce. */
  app.post('/listings/:id/chat', async (req, reply) => {
    const user = await member(req, reply)
    if (!user) return
    const id = (req.params as { id: string }).id
    const [l] = z.string().uuid().safeParse(id).success ? await db.query<{ user_id: string }>('SELECT user_id FROM listings WHERE id = $1', [id]) : []
    if (!l) return reply.code(404).send({ error: 'Cette annonce n’existe plus.' })
    if (l.user_id === user.id) return reply.code(400).send({ error: 'C’est ton annonce.' })
    if (await blockedBetween(user.id, l.user_id)) return reply.code(403).send({ error: 'Tu ne peux pas contacter ce membre.' })
    const [c] = await db.query<{ id: string }>(
      `INSERT INTO conversations (listing_id, buyer_id, seller_id) VALUES ($1, $2, $3)
       ON CONFLICT (listing_id, buyer_id) DO UPDATE SET listing_id = EXCLUDED.listing_id RETURNING id`,
      [id, user.id, l.user_id],
    )
    return { id: c.id }
  })

  interface ConvRow {
    id: string
    listing_id: string
    buyer_id: string
    seller_id: string
    buyer_read_at: Date | string
    seller_read_at: Date | string
    last_at: Date | string
    title: string
    price_eur: number | null
    kind: string
    status: string
    photo_count: number
    updated_at: Date | string
    other_profile: { pseudo?: string; avatar?: unknown } | null
    last_body: string | null
    last_sender: string | null
    unread: number
  }

  const convSql = (filter: string) => `
    SELECT c.*, l.title, l.price_eur, l.kind, l.status, l.photo_count, l.updated_at,
      o.profile AS other_profile,
      m.body AS last_body, m.sender_id AS last_sender,
      (SELECT count(*)::int FROM messages x WHERE x.conversation_id = c.id AND x.sender_id <> $1
         AND x.created_at > CASE WHEN c.buyer_id = $1 THEN c.buyer_read_at ELSE c.seller_read_at END) AS unread
    FROM conversations c
    JOIN listings l ON l.id = c.listing_id
    JOIN users o ON o.id = CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END
    LEFT JOIN LATERAL (SELECT body, sender_id FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1) m ON true
    WHERE (c.buyer_id = $1 OR c.seller_id = $1) ${filter}`

  const toConv = (r: ConvRow, me: string) => {
    const otherId = r.buyer_id === me ? r.seller_id : r.buyer_id
    return {
      id: r.id,
      role: r.buyer_id === me ? 'acheteur' : 'vendeur',
      listing: { id: r.listing_id, title: r.title, priceEur: r.price_eur, kind: r.kind, status: r.status, photoCount: r.photo_count, version: new Date(r.updated_at).getTime() },
      other: { id: otherId, pseudo: r.other_profile?.pseudo || 'Dresseur', avatar: r.other_profile?.avatar ?? null },
      lastMessage: r.last_body,
      lastFromMe: r.last_sender === me,
      lastAt: iso(r.last_at),
      unread: r.unread,
    }
  }

  app.get('/chats', async (req, reply) => {
    const user = requireUser(req)
    if (!user) return reply.code(401).send({ error: 'Connecte-toi pour voir tes messages.' })
    // Une discussion sans aucun message n'apparaît que pour celui qui l'a ouverte.
    const rows = await db.query<ConvRow>(convSql(`AND (m.body IS NOT NULL OR c.buyer_id = $1)`) + ' ORDER BY c.last_at DESC LIMIT 100', [user.id])
    return { chats: rows.map((r) => toConv(r, user.id)) }
  })

  app.get('/chats/unread', async (req, reply) => {
    const user = requireUser(req)
    if (!user) return reply.code(401).send({ error: 'Non connecté.' })
    const [r] = await db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE (c.buyer_id = $1 OR c.seller_id = $1) AND m.sender_id <> $1
         AND m.created_at > CASE WHEN c.buyer_id = $1 THEN c.buyer_read_at ELSE c.seller_read_at END`,
      [user.id],
    )
    return { count: r.count }
  })

  async function myConv(req: FastifyRequest, reply: FastifyReply) {
    const user = requireUser(req)
    if (!user) {
      reply.code(401).send({ error: 'Connecte-toi pour voir tes messages.' })
      return null
    }
    const id = (req.params as { id: string }).id
    const [row] = z.string().uuid().safeParse(id).success ? await db.query<ConvRow>(convSql('AND c.id = $2'), [user.id, id]) : []
    if (!row) {
      reply.code(404).send({ error: 'Discussion introuvable.' })
      return null
    }
    return { user, row }
  }

  app.get('/chats/:id', async (req, reply) => {
    const found = await myConv(req, reply)
    if (!found) return
    const { user, row } = found
    const after = Number((req.query as { after?: string }).after ?? 0) || 0
    const messages = await db.query<{ id: string; sender_id: string; body: string; created_at: Date | string }>(
      `SELECT id, sender_id, body, created_at FROM messages WHERE conversation_id = $1 AND id > $2 ORDER BY id LIMIT 500`,
      [row.id, after],
    )
    await db.query(`UPDATE conversations SET ${row.buyer_id === user.id ? 'buyer_read_at' : 'seller_read_at'} = now() WHERE id = $1`, [row.id])
    const other = row.buyer_id === user.id ? row.seller_id : row.buyer_id
    const [b] = await db.query<{ mine: boolean; theirs: boolean }>(
      `SELECT bool_or(user_id = $1) AS mine, bool_or(user_id = $2) AS theirs FROM blocks WHERE (user_id = $1 AND blocked_id = $2) OR (user_id = $2 AND blocked_id = $1)`,
      [user.id, other],
    )
    return {
      chat: { ...toConv(row, user.id), unread: 0 },
      blocked: b?.mine ? 'moi' : b?.theirs ? 'lui' : null,
      messages: messages.map((m) => ({ id: Number(m.id), mine: m.sender_id === user.id, body: m.body, at: iso(m.created_at) })),
    }
  })

  app.post('/chats/:id/messages', { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } }, async (req, reply) => {
    const found = await myConv(req, reply)
    if (!found) return
    const { user, row } = found
    const parsed = z.object({ body: z.string().trim().min(1).max(1000) }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Message vide ou trop long.' })
    const other = row.buyer_id === user.id ? row.seller_id : row.buyer_id
    if (await blockedBetween(user.id, other)) return reply.code(403).send({ error: 'Tu ne peux plus écrire à ce membre.' })
    const [m] = await db.query<{ id: string; created_at: Date | string }>(
      'INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING id, created_at',
      [row.id, user.id, parsed.data.body],
    )
    await db.query(
      `UPDATE conversations SET last_at = now(), ${row.buyer_id === user.id ? 'buyer_read_at' : 'seller_read_at'} = now() WHERE id = $1`,
      [row.id],
    )
    return { message: { id: Number(m.id), mine: true, body: parsed.data.body, at: iso(m.created_at) } }
  })

  // ---- Bloquer un membre ----------------------------------------------------

  app.post('/users/:id/block', async (req, reply) => {
    const user = requireUser(req)
    if (!user) return reply.code(401).send({ error: 'Non connecté.' })
    const id = (req.params as { id: string }).id
    if (!z.string().uuid().safeParse(id).success || id === user.id) return reply.code(400).send({ error: 'Membre invalide.' })
    await db.query('INSERT INTO blocks (user_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [user.id, id])
    return { ok: true }
  })

  app.delete('/users/:id/block', async (req, reply) => {
    const user = requireUser(req)
    if (!user) return reply.code(401).send({ error: 'Non connecté.' })
    await db.query('DELETE FROM blocks WHERE user_id = $1 AND blocked_id = $2', [user.id, (req.params as { id: string }).id])
    return { ok: true }
  })

  // ---- Modération -----------------------------------------------------------

  app.get('/admin/reports', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'Non connecté.' })
    if (!admins.has(req.user.email)) return reply.code(403).send({ error: 'Réservé à l’administrateur.' })
    const rows = await db.query<{ id: number; listing_id: string | null; title: string | null; reason: string; created_at: Date | string; pseudo: string | null }>(
      `SELECT r.id, r.listing_id, l.title, r.reason, r.created_at, t.profile->>'pseudo' AS pseudo
       FROM reports r LEFT JOIN listings l ON l.id = r.listing_id LEFT JOIN users t ON t.id = r.target_id
       ORDER BY r.created_at DESC LIMIT 100`,
    )
    return { reports: rows.map((r) => ({ id: r.id, listingId: r.listing_id, title: r.title, reason: r.reason, pseudo: r.pseudo, at: iso(r.created_at) })) }
  })

  app.delete('/admin/reports/:id', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'Non connecté.' })
    if (!admins.has(req.user.email)) return reply.code(403).send({ error: 'Réservé à l’administrateur.' })
    await db.query('DELETE FROM reports WHERE id = $1', [Number((req.params as { id: string }).id) || 0])
    return { ok: true }
  })
}
