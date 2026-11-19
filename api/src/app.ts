import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Config } from './config.js'
import type { Db } from './db/index.js'
import type { Mailer } from './lib/mailer.js'
import { authRoutes } from './routes/auth.js'
import { cardRoutes } from './routes/cards.js'
import { collectionRoutes } from './routes/collection.js'
import { statsRoutes } from './routes/stats.js'

/**
 * Construit le serveur (sans le démarrer) : pratique pour les tests,
 * qui peuvent lui envoyer des requêtes sans ouvrir de vrai port réseau.
 */
export async function buildApp({ db, config, mailer }: { db: Db; config: Config; mailer: Mailer }): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.NODE_ENV === 'test' ? false : { level: 'info' },
    bodyLimit: 2_000_000,
    trustProxy: true,
  })

  // CORS : seule l'appli (WEB_ORIGIN) peut appeler l'API depuis un navigateur.
  const origins = config.WEB_ORIGIN.split(',').map((o) => o.trim())
  await app.register(cors, { origin: origins, methods: ['GET', 'POST', 'PUT', 'DELETE'] })

  // Limite de requêtes par adresse IP : protège contre les abus (ex. demandes de codes en rafale).
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' })

  app.get('/health', async () => ({ ok: true }))

  // Les routes de connexion ajoutent un « hook » global qui reconnaît l'utilisateur.
  await authRoutes(app, { db, config, mailer })
  await app.register(collectionRoutes, { db })
  await app.register(cardRoutes, { db, config })
  await app.register(statsRoutes, { db, config })

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'erreur')
    const status = (err as { statusCode?: number }).statusCode ?? 500
    reply.code(status).send({ error: status === 429 ? 'Trop de requêtes, patiente un peu.' : status < 500 ? (err as Error).message : 'Erreur du serveur.' })
  })

  return app
}
