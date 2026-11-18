// Fonctions « pures » (sans effet de bord) pour comprendre le texte lu par l'OCR.
// Elles sont testées dans parse.test.ts.

export interface ParsedNumber {
  /** Numéro de la carte dans l'extension, ex. 6 pour « 006/165 » */
  num: number
  /** Numéro tel qu'imprimé, ex. « 006 » ou « TG05 » */
  raw: string
  /** Total imprimé après la barre, ex. 165 (null si absent, ex. promo « SVP 085 ») */
  total: number | null
  /** Préfixe éventuel (TG, GG, SV, SWSH, SVP…) */
  prefix: string | null
}

/** Enlève accents et majuscules pour comparer des textes. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Corrige les confusions classiques de l'OCR dans une suite de chiffres (O→0, l→1…). */
function fixDigits(s: string): string {
  return s
    .replace(/[OoQD]/g, '0')
    .replace(/[lIi|!]/g, '1')
    .replace(/[Ss$]/g, '5')
    .replace(/[B]/g, '8')
    .replace(/[Z]/g, '2')
    .replace(/[G]/g, '6')
}

/**
 * Cherche le numéro de carte dans le texte : « 006/165 », « 25 / 102 », « TG05/TG30 », « SVP 085 ».
 * Renvoie la meilleure proposition, ou null.
 */
export function parseCardNumber(text: string): ParsedNumber | null {
  return parseCardNumbers(text)[0] ?? null
}

/**
 * Comme parseCardNumber, mais renvoie toutes les lectures possibles, de la plus probable
 * à la moins probable. Utile quand l'OCR colle des caractères parasites
 * (« 4238/1917 » peut être 238/191).
 */
export function parseCardNumbers(text: string): ParsedNumber[] {
  // 1) Format classique avec barre oblique : [préfixe]chiffres / [préfixe]chiffres
  const D = '[0-9OoQDlIi|!SsBZG]'
  const slash = new RegExp(`(?:\\b([A-Z]{2,4}))?\\s?(${D}{1,4})\\s?[/⁄∕]\\s?(?:[A-Z]{2,4})?\\s?(${D}{2,4})`, 'g')
  const found: ParsedNumber[] = []
  for (const m of text.matchAll(slash)) {
    const a = fixDigits(m[2])
    const b = fixDigits(m[3])
    if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) continue
    const prefix = m[1] && /^(TG|GG|SV|RC|SH)$/.test(m[1]) ? m[1] : null
    // Variantes : 4 chiffres = un chiffre parasite collé (avant le numéro, après le total).
    const lefts = a.length <= 3 ? [a] : [a.slice(-3), a.slice(-2)]
    const rights = b.length <= 3 ? [b] : [b.slice(0, 3), b.slice(0, 2)]
    for (const l of lefts) {
      for (const r of rights) {
        const num = parseInt(l, 10)
        const total = parseInt(r, 10)
        if (total < 5 || num === 0) continue
        found.push({ num, total, prefix, raw: (prefix ?? '') + l })
      }
    }
  }
  // On préfère un numéro « plausible » (≤ total + marge pour les cartes secrètes).
  // Le tri est stable : à égalité, l'ordre de lecture est conservé.
  found.sort((x, y) => plausibility(y) - plausibility(x))

  // 2) Cartes promo : « SVP 085 », « SWSH123 », « SM 210 », « XY 150 », « BW 95 »
  const promo = /\b(SVP|SWSH|SM|XY|BW|MEP|HGSS|DP)\s?([0-9]{1,3})\b/.exec(text)
  if (promo) found.push({ num: parseInt(promo[2], 10), total: null, prefix: promo[1], raw: promo[1] + promo[2] })

  const seen = new Set<string>()
  return found.filter((n) => {
    const k = `${n.raw}/${n.total}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function plausibility(n: ParsedNumber): number {
  if (n.total === null) return 0
  let score = 1
  if (n.num <= n.total * 1.6) score += 2
  if (n.total >= 20 && n.total <= 300) score += 1
  return score
}

// Mots imprimés sur les cartes qui ne sont pas des noms de Pokémon.
const STOP_WORDS = new Set(
  [
    'pv', 'hp', 'base', 'de', 'du', 'la', 'le', 'les', 'niveau', 'stage', 'basic', 'evolue', 'evolves', 'from',
    'pokemon', 'dresseur', 'trainer', 'energie', 'energy', 'objet', 'item', 'supporter', 'stade', 'stadium',
    'talent', 'ability', 'attaque', 'outil', 'tool', 'ex', 'gx', 'v', 'vmax', 'vstar', 'et', 'en', 'of',
    'evolution', 'evolue', 'evolves', 'niv', 'illus', 'faiblesse', 'resistance', 'retraite', 'weakness',
    'resistance', 'retreat', 'regle', 'rule', 'carte', 'cartes', 'votre', 'your', 'tera', 'mega',
  ].map(normalize),
)

/** Lignes qui ne contiennent jamais le nom de la carte (« Évolution de : Reptincel »). */
const SKIP_LINE = /(évolu|evolu|evolves|pokémon de base|basic pokémon|illus\.|faiblesse|weakness)/i

/**
 * Extrait les mots qui ressemblent à un nom de carte (en haut de la carte).
 * Renvoie une liste de propositions, de la plus probable à la moins probable.
 */
export function parseNameCandidates(text: string): string[] {
  const out: string[] = []
  for (const line of text.split(/\n+/)) {
    if (SKIP_LINE.test(line)) continue
    const words = line
      .split(/[^A-Za-zÀ-ÖØ-öø-ÿ'’-]+/)
      .map((w) => w.replace(/^[-'’]+|[-'’]+$/g, ''))
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(normalize(w)))
      // Un mot avec trop peu de voyelles est souvent du « bruit » OCR.
      .filter((w) => /[aeiouyàâäéèêëîïôöùûü]/i.test(w))
    // Les noms sont parfois en deux mots (« Dracaufeu obscur », « Mr. Mime »).
    if (words.length >= 2) out.push(words.slice(0, 2).join(' '))
    out.push(...words)
  }
  // Les mots les plus longs d'abord : ce sont souvent les noms de Pokémon.
  const unique = [...new Set(out)]
  return unique.sort((a, b) => b.length - a.length).slice(0, 6)
}

/** Année du copyright imprimé en bas de la carte (« ©2023 Pokémon/Nintendo »). */
export function parseCopyrightYear(text: string, now = new Date().getFullYear()): number | null {
  const years = [...text.matchAll(/(?:19[89]\d|20[0-4]\d)/g)].map((m) => parseInt(m[0], 10)).filter((y) => y <= now)
  return years.length ? Math.max(...years) : null
}

/** Suffixe lu après le nom (« ex », « V », « VMAX », « GX »…), utile pour départager. */
export function parseSuffix(text: string): string | null {
  const m = /[\s-](VMAX|VSTAR|V-UNION|GX|EX|ex|V)\b/.exec(text)
  return m ? m[1].toLowerCase() : null
}

/** Distance de Levenshtein : nombre de lettres à changer pour passer d'un mot à l'autre. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

/**
 * Ressemblance entre le texte lu et un nom de carte, de 0 (rien à voir) à 1 (identique).
 * On compare au début du nom pour ignorer les suffixes (« -ex », « V », « VMAX »).
 */
export function nameSimilarity(read: string, cardName: string): number {
  const a = normalize(read).replace(/ /g, '')
  const full = normalize(cardName).replace(/ /g, '')
  if (!a || !full) return 0
  if (full.startsWith(a) || a.startsWith(full)) return Math.min(a.length, full.length) / Math.max(a.length, full.length) * 0.3 + 0.7
  const b = full.slice(0, Math.max(a.length, 3))
  const d = levenshtein(a, b)
  return Math.max(0, 1 - d / Math.max(a.length, b.length))
}

/** Compare deux numéros imprimés (« 006 » et « 6 » sont identiques ; « TG05 » et « TG5 » aussi). */
export function sameLocalId(a: string, b: string): boolean {
  const split = (s: string) => {
    const m = /^([A-Za-z]*)0*(\d+)([A-Za-z]*)$/.exec(s.trim())
    return m ? `${m[1].toUpperCase()}${m[2]}${m[3].toLowerCase()}` : s.trim().toUpperCase()
  }
  return split(a) === split(b)
}
