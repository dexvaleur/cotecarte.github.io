import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Config } from '../config.js'
import type { Db } from '../db/index.js'
import { fingerprint, newLoginCode, newSessionToken, sameFingerprint } from '../lib/crypto.js'
import type { Mailer } from '../lib/mailer.js'

/**
 * Connexion par email, sans mot de passe :
 * 1. POST /auth/request {email} → on envoie un code à 6 chiffres par email.
 * 2. POST /auth/verify {email, code} → si le code est bon, on renvoie un jeton de session.
 * Ensuite l'appli envoie ce jeton à chaque requête : « Authorization: Bearer <jeton> ».
 */

const CODE_MINUTES = 15
const MAX_CODES_PER_HOUR = 5
const MAX_ATTEMPTS = 5
const SESSION_DAYS = 180

export interface AuthUser {
  id: string
  email: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null
  }
}

const emailSchema = z.string().trim().toLowerCase().email('Adresse email invalide.').max(254)

export async function authRoutes(app: FastifyInstance, { db, config, mailer }: { db: Db; config: Config; mailer: Mailer }) {
  const hashCode = (email: string, code: string) => fingerprint(config.AUTH_SECRET, `code:${email}:${code}`)
  const hashToken = (token: string) => fingerprint(config.AUTH_SECRET, `session:${token}`)

  // Accès privé (ALLOWED_EMAILS) : seules ces adresses peuvent se connecter.
  const allowed = new Set(
    config.ALLOWED_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
  const isAllowed = (email: string) => allowed.size === 0 || allowed.has(email)
  const PRIVATE_MESSAGE = 'Cote Carte est en accès privé pour le moment. Tu peux quand même scanner tes cartes sans compte.'

  // Pour chaque requête : si un jeton valide est fourni, on sait qui est l'utilisateur.
  app.decorateRequest('user', null)
  app.addHook('onRequest', async (req) => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) return
    const rows = await db.query<AuthUser>(
      `SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hashToken(header.slice(7))],
    )
    req.user = rows[0] ?? null
  })

  app.post('/auth/request', async (req, reply) => {
    const parsed = z.object({ email: emailSchema, consent: z.literal(true).optional() }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Adresse email invalide.' })
    // Case obligatoire : 15 ans ou plus + conditions et politique de confidentialité acceptées.
    if (!parsed.data.consent) {
      return reply.code(400).send({ error: 'Coche la case « J’ai 15 ans ou plus… » pour créer ton compte.' })
    }
    const { email } = parsed.data
    if (!isAllowed(email)) return reply.code(403).send({ error: PRIVATE_MESSAGE })

    const [{ count }] = await db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM login_codes WHERE email = $1 AND created_at > now() - interval '1 hour'`,
      [email],
    )
    if (count >= MAX_CODES_PER_HOUR) {
      return reply.code(429).send({ error: 'Trop de demandes. Réessaie dans une heure.' })
    }

    const code = newLoginCode()
    await db.query(
      `INSERT INTO login_codes (email, code_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [email, hashCode(email, code), CODE_MINUTES],
    )
    try {
      await mailer.sendLoginCode(email, code)
    } catch (err) {
      req.log.error({ err }, 'envoi email impossible')
      return reply.code(502).send({ error: 'Impossible d’envoyer l’email pour le moment. Réessaie plus tard.' })
    }
    // En développement (pas d'email configuré), on renvoie le code pour pouvoir tester.
    const devCode = mailer.console && config.NODE_ENV !== 'production' ? code : undefined
    return { ok: true, devCode }
  })

  app.post('/auth/verify', async (req, reply) => {
    const parsed = z.object({ email: emailSchema, code: z.string().trim().regex(/^\d{6}$/) }).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Le code contient 6 chiffres.' })
    const { email, code } = parsed.data
    if (!isAllowed(email)) return reply.code(403).send({ error: PRIVATE_MESSAGE })

    const [row] = await db.query<{ id: number; code_hash: string; attempts: number }>(
      `SELECT id, code_hash, attempts FROM login_codes
       WHERE email = $1 AND used_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1`,
      [email],
    )
    if (!row) return reply.code(400).send({ error: 'Code expiré. Demande un nouveau code.' })
    if (row.attempts >= MAX_ATTEMPTS) return reply.code(429).send({ error: 'Trop d’essais. Demande un nouveau code.' })
    if (!sameFingerprint(row.code_hash, hashCode(email, code))) {
      await db.query('UPDATE login_codes SET attempts = attempts + 1 WHERE id = $1', [row.id])
      return reply.code(400).send({ error: 'Code incorrect.' })
    }

    await db.query('UPDATE login_codes SET used_at = now() WHERE id = $1', [row.id])
    const [user] = await db.query<AuthUser>(
      `INSERT INTO users (email, terms_accepted_at) VALUES ($1, now())
       ON CONFLICT (email) DO UPDATE SET terms_accepted_at = now()
       RETURNING id, email`,
      [email],
    )
    const token = newSessionToken()
    await db.query(
      `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`,
      [hashToken(token), user.id, SESSION_DAYS],
    )
    return { token, user }
  })

  app.post('/auth/logout', async (req) => {
    const header = req.headers.authorization
    if (header?.startsWith('Bearer ')) await db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(header.slice(7))])
    return { ok: true }
  })

  app.get('/me', async (req, reply) => {
    const user = requireUser(req)
    if (!user) return reply.code(401).send({ error: 'Non connecté.' })
    return { user }
  })

  // Suppression du compte et de toutes ses données (droit à l'effacement, RGPD).
  app.delete('/me', async (req, reply) => {
    const user = requireUser(req)
    if (!user) return reply.code(401).send({ error: 'Non connecté.' })
    await db.query('DELETE FROM users WHERE id = $1', [user.id])
    await db.query('DELETE FROM login_codes WHERE email = $1', [user.email])
    return { ok: true }
  })
}

export function requireUser(req: FastifyRequest): AuthUser | null {
  return req.user
}
