import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

/** Code à 6 chiffres (ex. « 048213 »), tiré au hasard de façon sûre. */
export function newLoginCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/** Jeton de session : 32 octets aléatoires, impossibles à deviner. */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

/**
 * « Empreinte » (HMAC-SHA256) d'un secret. On stocke l'empreinte, jamais le secret :
 * même si la base fuitait, les codes et jetons resteraient inutilisables.
 */
export function fingerprint(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex')
}

/** Comparaison en temps constant (ne révèle pas, par sa durée, combien de caractères sont bons). */
export function sameFingerprint(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}
