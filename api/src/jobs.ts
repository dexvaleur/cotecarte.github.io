import type { Config } from './config.js'
import type { Db } from './db/index.js'
import { refreshPackStats } from './packs.js'
import { type CardPricing, createTcgdexFetcher, mapLimit, recordSnapshot } from './routes/cards.js'

/**
 * Tâche quotidienne : photographier le prix de toutes les cartes suivies
 * (dans une collection ou une wishlist). C'est ce qui remplit les courbes de prix,
 * même quand personne n'ouvre l'appli.
 */
export async function snapshotPrices(db: Db, config: Config): Promise<number> {
  const fetchTcgdex = createTcgdexFetcher(db, config)
  const rows = await db.query<{ card_id: string }>(
    `SELECT DISTINCT card_id FROM (
       SELECT card_id FROM collection_items UNION SELECT card_id FROM wishlist
     ) t
     WHERE NOT EXISTS (SELECT 1 FROM price_snapshots p WHERE p.card_id = t.card_id AND p.day = current_date)`,
  )
  let done = 0
  await mapLimit(rows, 4, async ({ card_id }) => {
    // TTL court : on veut le prix du jour, pas une copie d'hier.
    let res = await fetchTcgdex(`/v2/fr/cards/${encodeURIComponent(card_id)}`, 3_600_000)
    if (res.status === 404) res = await fetchTcgdex(`/v2/en/cards/${encodeURIComponent(card_id)}`, 3_600_000)
    // Même si la fiche venait du cache, on enregistre le prix du jour.
    if (res.body) {
      await recordSnapshot(db, card_id, (res.body as { pricing?: CardPricing }).pricing)
      done++
    }
  })
  return done
}

/** Lance la tâche au démarrage puis toutes les 6 heures. */
export function startJobs(db: Db, config: Config, log: (msg: string) => void): () => void {
  const run = () =>
    snapshotPrices(db, config)
      .then((n) => n && log(`💶 Prix du jour enregistrés pour ${n} carte(s)`))
      .catch((err) => log(`Tâche des prix en échec : ${(err as Error).message}`))
      .then(() => refreshPackStats(db, config, log))
      .catch((err) => log(`Statistiques des packs en échec : ${(err as Error).message}`))
  const first = setTimeout(run, 10_000)
  const timer = setInterval(run, 6 * 3_600_000)
  return () => {
    clearTimeout(first)
    clearInterval(timer)
  }
}
