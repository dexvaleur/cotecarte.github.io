import { cardImage, getSet, getSets, searchByName, searchByNumber, setIdOf } from '../api/tcgdex'
import type { CardBrief } from '../api/types'
import { band, dHash, hashSimilarity, loadImage } from './image'
import { readText, type OcrProgress } from './ocr'
import {
  nameSimilarity,
  parseCardNumbers,
  parseCopyrightYear,
  parseNameCandidates,
  parseSuffix,
  sameLocalId,
  type ParsedNumber,
} from './parse'

/**
 * Reconnaissance d'une carte à partir de sa photo (déjà recadrée au format carte).
 *
 * 1. On lit le haut de la carte (le nom) et le bas (le numéro) avec l'OCR.
 * 2. On cherche dans TCGdex par numéro (« 006/165 ») et par nom.
 * 3. On donne un score à chaque carte trouvée, puis on compare les images
 *    pour départager les cartes qui se ressemblent.
 */

export interface Candidate extends CardBrief {
  score: number
  nameScore: number
  numberMatch: boolean
  imageScore: number | null
}

export interface Recognition {
  readName: string | null
  readNumber: ParsedNumber | null
  candidates: Candidate[]
  /** true si on est assez sûr pour ouvrir directement la fiche */
  confident: boolean
}

// Chiffres et « / » seulement : avec des lettres, l'OCR confond « 0 » et « D », « 2 » et « Z »…
const NUMBER_CHARS = '0123456789/'

export async function recognizeCard(card: HTMLCanvasElement, onProgress?: OcrProgress): Promise<Recognition> {
  // --- 1. OCR -----------------------------------------------------------
  // Le nom est en haut à gauche ; le numéro en bas à gauche (cartes récentes)
  // ou en bas à droite (anciennes cartes).
  const topText = await readText(band(card, 0.02, 0.13, 0.03, 0.85), onProgress)
  let bottomText = await readText(band(card, 0.87, 0.995, 0, 0.55), onProgress, NUMBER_CHARS)
  let numbers = parseCardNumbers(bottomText)
  if (!numbers.length) {
    bottomText += '\n' + (await readText(band(card, 0.87, 0.995, 0.45, 1), onProgress, NUMBER_CHARS))
    numbers = parseCardNumbers(bottomText)
  }
  let names = parseNameCandidates(topText)
  let suffix = parseSuffix(topText)
  // Dernière ligne : le copyright (« ©2023 Pokémon… ») donne l'époque de la carte.
  const footer = await readText(band(card, 0.9, 1, 0, 1), onProgress)
  let year = parseCopyrightYear(footer)
  if (!numbers.length) numbers = parseCardNumbers(footer)

  // Plan B : si une zone n'a rien donné, on lit toute la carte.
  if (!numbers.length || names.length === 0) {
    const all = await readText(band(card, 0, 1), onProgress)
    if (!numbers.length) numbers = parseCardNumbers(all)
    year ??= parseCopyrightYear(all)
    if (names.length === 0) {
      names = parseNameCandidates(all.split('\n').slice(0, 6).join('\n'))
      suffix ??= parseSuffix(all)
    }
  }

  // --- 2. Recherche -------------------------------------------------------
  const pool = new Map<string, CardBrief>()
  let readNumber: ParsedNumber | null = numbers[0] ?? null
  let byNumber: CardBrief[] = []
  for (const n of numbers.slice(0, 3)) {
    byNumber = await searchByNumber(n.raw, n.total)
    if (byNumber.length) {
      readNumber = n
      break
    }
  }
  byNumber.forEach((c) => pool.set(c.id, c))

  // Recherche par nom : les premières lettres suffisent (résiste aux erreurs de lecture).
  const words = [...new Set(names.map((n) => n.split(' ')[0]).filter((w) => w.length >= 3))].slice(0, 2)
  for (const word of words) {
    const found = await searchByName(word.slice(0, Math.min(word.length, 6)))
    found.forEach((c) => pool.set(c.id, c))
  }

  // --- 3. Score -----------------------------------------------------------
  // Petit avantage aux extensions récentes (les plus scannées) pour départager les égalités.
  const sets = await getSets('fr').catch(() => [])
  const recency = new Map(sets.map((s, i) => [s.id, i / Math.max(1, sets.length - 1)]))
  const candidates: Candidate[] = [...pool.values()].map((c) => {
    const nameScore = names.length ? Math.max(...names.map((n) => nameSimilarity(n, c.name))) : 0
    const fromNumberSearch = byNumber.some((b) => b.id === c.id)
    // Le numéro « colle » seulement si le total correspond aussi à l'extension
    // (sauf cartes promo, qui n'ont pas de total).
    const numberMatch =
      readNumber !== null &&
      sameLocalId(c.localId, readNumber.raw) &&
      (fromNumberSearch || readNumber.total === null)
    const cardSuffix = parseSuffix(' ' + c.name.replace(/-/g, ' '))
    const suffixBonus = suffix && cardSuffix === suffix ? 0.4 : suffix && !cardSuffix ? -0.2 : 0
    const recent = (recency.get(setIdOf(c.id)) ?? 0) * 0.3
    const score = nameScore * 2 + (numberMatch ? 1.5 : 0) + (fromNumberSearch ? 1 : 0) + suffixBonus + recent
    return { ...c, score, nameScore, numberMatch, imageScore: null }
  })
  candidates.sort((a, b) => b.score - a.score)

  // On garde les meilleurs, puis on compare les images pour les départager.
  const best = candidates.filter((c) => c.score >= 1).slice(0, 10)
  if (year) await compareYears(year, best)
  await compareImages(card, best)
  best.sort((a, b) => b.score - a.score)

  const [first, second] = best
  const gap = first && second ? first.score - second.score : Infinity
  const confident =
    !!first &&
    ((first.numberMatch && first.nameScore >= 0.7 && gap >= 0.5) ||
      (first.nameScore >= 0.85 && (first.imageScore ?? 0) >= 0.85 && gap >= 1))

  // Infos de diagnostic, consultables dans la console du navigateur (window.__pokecardScan).
  ;(globalThis as Record<string, unknown>).__pokecardScan = { topText, bottomText, footer, year, names, suffix, numbers, candidates: best }

  return {
    readName: names[0] ? names[0] + (suffix ? ` ${suffix}` : '') : null,
    readNumber,
    candidates: best,
    confident,
  }
}

/**
 * Compare l'année du copyright avec la date de sortie de l'extension de chaque candidate.
 * Une carte de 2023 ne peut pas venir d'une extension de 2002 !
 */
async function compareYears(year: number, list: Candidate[]) {
  await Promise.all(
    list.map(async (c) => {
      try {
        const { data } = await getSet(setIdOf(c.id))
        const released = data.releaseDate ? parseInt(data.releaseDate.slice(0, 4), 10) : null
        if (!released) return
        const diff = Math.abs(released - year)
        c.score += diff <= 1 ? 0.8 : diff <= 3 ? 0 : -0.5
      } catch {
        /* extension inconnue : pas de bonus */
      }
    }),
  )
}

/**
 * Adresse du serveur qui relaie les images (étape 3).
 * Le serveur d'images de TCGdex envoie son en-tête d'autorisation CORS en double :
 * le navigateur affiche les images mais interdit de les analyser. Notre serveur
 * relaiera donc les images avec un en-tête correct. Sans lui, on saute cette étape.
 */
const IMAGE_PROXY: string | undefined = import.meta.env.VITE_IMAGE_PROXY

/** Compare l'illustration de la photo avec celle de chaque carte candidate. */
async function compareImages(photo: HTMLCanvasElement, list: Candidate[]) {
  if (!IMAGE_PROXY) return
  const mine = dHash(photo, photo.width, photo.height)
  await Promise.all(
    list.map(async (c) => {
      const url = cardImage(c.image, 'low')
      if (!url) return
      try {
        const img = await loadImage(IMAGE_PROXY + encodeURIComponent(url))
        const sim = hashSimilarity(mine, dHash(img, img.naturalWidth, img.naturalHeight))
        c.imageScore = sim
        // ~0,5 = images sans rapport ; 1 = identiques.
        c.score += Math.max(-0.5, Math.min(2, (sim - 0.65) * 5))
      } catch {
        /* image indisponible : on garde le score sans comparaison */
      }
    }),
  )
}
