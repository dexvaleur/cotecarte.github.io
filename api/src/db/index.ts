import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Accès à la base de données.
 * - En production : une vraie base PostgreSQL (variable DATABASE_URL).
 * - En développement et pour les tests : PGlite, un vrai PostgreSQL qui tourne
 *   directement dans Node.js, sans rien installer.
 * Les deux s'utilisent de la même façon : db.query('SELECT … WHERE id = $1', [id]).
 */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  close(): Promise<void>
}

export async function createDb(databaseUrl: string | undefined, dataDir?: string): Promise<Db> {
  if (databaseUrl) {
    const { default: pg } = await import('pg')
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      max: 10,
      // « channel_binding=require » (ex. adresses Neon) : la bibliothèque ne le lit pas
      // dans l'adresse, on active donc l'option nous-mêmes (protection contre l'interception).
      enableChannelBinding: /[?&]channel_binding=require\b/.test(databaseUrl),
    })
    return {
      async query<T>(sql: string, params: unknown[] = []) {
        const res = await pool.query(sql, params)
        return res.rows as T[]
      },
      close: () => pool.end(),
    }
  }
  const { PGlite } = await import('@electric-sql/pglite')
  // Sans dossier : base en mémoire (effacée à l'arrêt), pratique pour les tests.
  const lite = new PGlite(dataDir)
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await lite.query(sql, params)
      return res.rows as T[]
    },
    close: () => lite.close(),
  }
}

/**
 * Applique les fichiers SQL du dossier migrations/ qui n'ont pas encore été appliqués,
 * dans l'ordre de leur nom (001_…, 002_…). Ainsi la base évolue sans perdre de données.
 */
export async function migrate(db: Db): Promise<string[]> {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`)
  const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  const done = new Set((await db.query<{ name: string }>('SELECT name FROM schema_migrations')).map((r) => r.name))
  const applied: string[] = []
  for (const file of files) {
    if (done.has(file)) continue
    const sql = await readFile(join(dir, file), 'utf8')
    await db.query('BEGIN')
    try {
      for (const statement of splitSql(sql)) await db.query(statement)
      await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
      await db.query('COMMIT')
      applied.push(file)
    } catch (err) {
      await db.query('ROLLBACK')
      throw new Error(`Migration ${file} impossible : ${(err as Error).message}`)
    }
  }
  return applied
}

/** Découpe un fichier SQL en instructions (séparées par « ; » en fin de ligne). */
function splitSql(sql: string): string[] {
  return sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean)
}
