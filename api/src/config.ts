import { z } from 'zod'

/**
 * Réglages du serveur, lus dans les variables d'environnement (fichier .env en local).
 * Voir .env.example pour la liste commentée.
 */
const schema = z.object({
  PORT: z.coerce.number().default(8787),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** Adresse de la base PostgreSQL. Vide = PGlite (base locale, idéale pour essayer). */
  DATABASE_URL: z.string().optional(),
  /** Dossier où PGlite garde ses données (si DATABASE_URL est vide). */
  PGLITE_DIR: z.string().default('./data/pglite'),
  /** Adresse(s) de l'appli autorisée(s) à appeler l'API, séparées par des virgules. */
  WEB_ORIGIN: z.string().default('http://localhost:5173,http://localhost:4173'),
  /** Secret pour signer les codes : une longue phrase aléatoire, à garder privée. */
  AUTH_SECRET: z.string().min(16).default('change-moi-en-production-avec-une-longue-phrase'),
  /**
   * Accès privé : emails autorisés à se connecter, séparés par des virgules.
   * Vide = tout le monde peut créer un compte.
   */
  ALLOWED_EMAILS: z.string().default(''),
  /** Envoi des emails. Vide = les codes s'affichent dans le terminal (développement). */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Poké Card <no-reply@pokecard.local>'),
  /** Adresse de TCGdex (modifiable pour les tests). */
  TCGDEX_URL: z.string().default('https://api.tcgdex.net'),
})

export type Config = z.infer<typeof schema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const config = schema.parse(env)
  if (config.NODE_ENV === 'production') {
    if (config.AUTH_SECRET.startsWith('change-moi')) throw new Error('AUTH_SECRET doit être défini en production.')
    if (!config.SMTP_URL) throw new Error('SMTP_URL doit être défini en production pour envoyer les codes.')
  }
  return config
}
