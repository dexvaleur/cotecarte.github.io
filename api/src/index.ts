import { mkdir } from 'node:fs/promises'
import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { createDb, migrate } from './db/index.js'
import { startJobs } from './jobs.js'
import { createMailer } from './lib/mailer.js'

// Démarrage du serveur : réglages → base de données → migrations → routes → écoute.
const config = loadConfig()
if (!config.DATABASE_URL) await mkdir(config.PGLITE_DIR, { recursive: true })
const db = await createDb(config.DATABASE_URL, config.DATABASE_URL ? undefined : config.PGLITE_DIR)
const applied = await migrate(db)
const mailer = await createMailer(config, (m) => console.log(m))
const app = await buildApp({ db, config, mailer })
if (applied.length) app.log.info(`Migrations appliquées : ${applied.join(', ')}`)
if (!config.DATABASE_URL) app.log.info(`Base locale PGlite dans ${config.PGLITE_DIR}`)
if (mailer.console) app.log.info('Emails désactivés : les codes de connexion s’affichent ici.')

const stopJobs = startJobs(db, config, (m) => app.log.info(m))
await app.listen({ port: config.PORT, host: config.HOST })

// Arrêt propre (Ctrl+C, redémarrage de l'hébergeur).
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    stopJobs()
    await app.close()
    await db.close()
    process.exit(0)
  })
}
