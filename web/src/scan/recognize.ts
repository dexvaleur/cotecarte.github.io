import { cardImage, getSet, getSets, searchByName, searchByNumber, setIdOf } from '../api/tcgdex'
import type { CardBrief } from '../api/types'
import { band, dHash, hashSimilarity, loadImage } from './image'
import { readText, readTextWithConfidence, type OcrProgress } from './ocr'
import { SPECIES } from '../data/species'
import {
  hasMegaPrefix,
  looseNumbers,
  matchSpecies,
  nameSimilarity,
  normalize,
  parseCardNumbers,
  parseCopyrightYear,
  parseNameCandidates,
  parseSuffix,
  sameLocalId,
  type ParsedNumber,
  type SpeciesMatch,
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

/** Noms de Pokémon reconnus dans un texte, du plus sûr au moins sûr. */
function speciesIn(names: string[]): SpeciesMatch[] {
  return names
    .slice(0, 5)
    .map((n) => matchSpecies(n, SPECIES))
    .filter((m): m is SpeciesMatch => m !== null)
    .sort((a, b) => b.score - a.score)
}

// Mots toujours imprimés en haut d'une carte (dans le bon sens).
const CARD_WORDS = new Set(['pv', 'hp', 'base', 'basic', 'niveau', 'stage', 'evolution', 'evolves', 'de', 'from', 'vstar', 'vmax', 'mega', 'talent', 'dresseur', 'trainer', 'energie', 'energy', 'objet', 'item', 'supporter', 'stade', 'stadium', 'pokemon'])

/**
 * Note de « lisibilité » d'un texte lu en haut de carte : sert à savoir si la carte est
 * dans le bon sens. Un nom de Pokémon, « PV 250 », « Évolution de »… sont bon signe.
 */
function textQuality(text: string, confidence: number): number {
  const found = speciesIn(parseNameCandidates(text))
  const words = normalize(text).split(' ')
  const known = Math.min(3, words.filter((w) => CARD_WORDS.has(w)).length)
  const hp = /\b(PV|HP)\s?\d{2,3}\b|\b\d{2,3}\s?(PV|HP)\b/i.test(text) ? 25 : 0
  return confidence + (found.length ? 35 * found[0].score : 0) + known * 8 + hp
}

/**
 * `views` : une ou plusieurs versions de la carte redressée (ex. dans les deux sens,
 * quand on ne sait pas où est le haut). On garde celle où l'OCR lit le mieux.
 */
export async function recognizeCard(views: HTMLCanvasElement[], onProgress?: OcrProgress): Promise<Recognition> {
  // --- 1. OCR -----------------------------------------------------------
  // Le nom est en haut à gauche ; le numéro en bas à gauche (cartes récentes)
  // ou en bas à droite (anciennes cartes).
  let card = views[0]
  let topText = ''
  let bestView = -Infinity
  let presetBottom: string | null = null
  for (const view of views) {
    // On lit le haut de la carte ; si aucun nom n'est reconnu, on réessaie avec un seuil adaptatif.
    const r = await readTextWithConfidence(band(view, 0.02, 0.13, 0.03, 0.85), onProgress)
    let text = r.text
    let score = textQuality(text, r.confidence)
    if (!speciesIn(parseNameCandidates(text)).length) {
      const a = await readTextWithConfidence(band(view, 0.02, 0.13, 0.03, 0.85, 'adaptive'), onProgress)
      text += '\n' + a.text
      score = Math.max(score, textQuality(a.text, a.confidence))
    }
    // Si on hésite entre deux sens, le numéro en bas de carte aide à trouver le bon.
    let bottom: string | null = null
    if (views.length > 1) {
      bottom = await readText(band(view, 0.87, 0.995, 0, 0.55), onProgress, NUMBER_CHARS)
      if (parseCardNumbers(bottom).some((n) => n.total)) score += 40
    }
    if (score > bestView) {
      bestView = score
      card = view
      topText = text
      presetBottom = bottom
    }
    // Lecture très claire dans ce sens : inutile d'essayer l'autre.
    if (score >= 140) break
  }

  // Numéro : contraste simple, puis seuil adaptatif, puis côté droit (anciennes cartes).
  let bottomText = presetBottom ?? (await readText(band(card, 0.87, 0.995, 0, 0.55), onProgress, NUMBER_CHARS))
  let numbers = parseCardNumbers(bottomText)
  for (const [left, right, mode] of [
    [0, 0.55, 'adaptive'],
    [0.45, 1, 'contrast'],
  ] as const) {
    if (numbers.some((n) => n.total)) break
    bottomText += '\n' + (await readText(band(card, 0.87, 0.995, left, right, mode), onProgress, NUMBER_CHARS))
    numbers = parseCardNumbers(bottomText)
  }

  // Nom : si aucun nom de Pokémon n'est reconnu, on relit avec un seuil adaptatif
  // (texte sur un bandeau de couleur), puis en couleurs inversées (texte blanc).
  let names = parseNameCandidates(topText)
  for (const mode of ['adaptive', 'inverted'] as const) {
    if (speciesIn(names).length) break
    const again = await readText(band(card, 0.02, 0.13, 0.03, 0.85, mode), onProgress)
    topText += '\n' + again
    names = [...new Set([...names, ...parseNameCandidates(again)])]
  }

  // Dernière ligne : le copyright (« ©2023 Pokémon… ») donne l'époque ; parfois aussi le numéro promo.
  const footer = await readText(band(card, 0.9, 1, 0, 1), onProgress)
  let year = parseCopyrightYear(footer)
  if (!numbers.length) numbers = parseCardNumbers(footer)

  // Plan B : si une zone n'a rien donné, on lit toute la carte.
  let allText = ''
  if (!numbers.length || names.length === 0) {
    allText = await readText(band(card, 0, 1), onProgress)
    if (!numbers.length) numbers = parseCardNumbers(allText)
    year ??= parseCopyrightYear(allText)
    if (names.length === 0) names = parseNameCandidates(allText.split('\n').slice(0, 6).join('\n'))
  }

  // Ce qu'on a compris : nom de Pokémon corrigé, suffixe (ex, V…), « Méga », numéros isolés.
  const species = speciesIn(names)
  const suffix = parseSuffix(topText) ?? species[0]?.suffix ?? (allText ? parseSuffix(allText) : null)
  const mega = hasMegaPrefix(topText)
  const loose = looseNumbers(bottomText + '\n' + footer)

  // --- 2. Recherche -------------------------------------------------------
  const pool = new Map<string, CardBrief>()
  let readNumber: ParsedNumber | null = numbers[0] ?? null
  let byNumber: CardBrief[] = []
  for (const n of numbers.slice(0, 3)) {
    if (n.total === null) continue
    byNumber = await searchByNumber(n.raw, n.total)
    if (byNumber.length) {
      readNumber = n
      break
    }
  }
  byNumber.forEach((c) => pool.set(c.id, c))

  // Recherche par nom : d'abord les noms de Pokémon reconnus (orthographe exacte),
  // sinon les premières lettres du texte lu (résiste aux erreurs de lecture).
  const queries = species.length
    ? [...new Set(species.map((m) => m.name))].slice(0, 2)
    : [...new Set(names.map((n) => n.split(' ')[0]).filter((w) => w.length >= 3))].slice(0, 2).map((w) => w.slice(0, 6))
  for (const q of queries) {
    const found = await searchByName(q)
    found.forEach((c) => pool.set(c.id, c))
  }

  // --- 3. Score -----------------------------------------------------------
  // Petit avantage aux extensions récentes (les plus scannées) pour départager les égalités.
  const sets = await getSets('fr').catch(() => [])
  const recency = new Map(sets.map((s, i) => [s.id, i / Math.max(1, sets.length - 1)]))
  const candidates: Candidate[] = [...pool.values()].map((c) => {
    const nameScore = Math.max(
      0,
      ...names.map((n) => nameSimilarity(n, c.name)),
      ...species.map((m) => m.score * nameSimilarity(m.name, c.name)),
    )
    const fromNumberSearch = byNumber.some((b) => b.id === c.id)
    // Le numéro « colle » seulement si le total correspond aussi à l'extension
    // (sauf cartes promo, qui n'ont pas de total).
    const numberMatch =
      readNumber !== null &&
      sameLocalId(c.localId, readNumber.raw) &&
      (fromNumberSearch || readNumber.total === null)
    const looseMatch = !numberMatch && loose.some((n) => sameLocalId(c.localId, n))
    const cardSuffix = parseSuffix(' ' + c.name.replace(/-/g, ' '))
    const suffixBonus = suffix && cardSuffix === suffix ? 0.4 : suffix && !cardSuffix ? -0.2 : 0
    const cardMega = /^m[ée]ga[- ]/i.test(c.name)
    const megaBonus = mega && cardMega ? 0.5 : mega && !cardMega ? -0.3 : 0
    const recent = (recency.get(setIdOf(c.id)) ?? 0) * 0.3
    const score =
      nameScore * 2 +
      (numberMatch ? 1.5 : looseMatch ? 0.8 : 0) +
      (fromNumberSearch ? 1 : 0) +
      suffixBonus +
      megaBonus +
      recent
    return { ...c, score, nameScore, numberMatch: numberMatch || looseMatch, imageScore: null }
  })
  candidates.sort((a, b) => b.score - a.score)

  // On garde les meilleurs, puis on compare époque et images pour les départager.
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
  ;(globalThis as Record<string, unknown>).__pokecardScan = {
    cardPreview: card.toDataURL('image/jpeg', 0.7),
    topText,
    bottomText,
    footer,
    year,
    names,
    species,
    suffix,
    mega,
    loose,
    numbers,
    candidates: best,
  }

  const shownName = species[0]?.name ?? names[0]
  return {
    readName: shownName ? `${mega ? 'Méga-' : ''}${shownName}${suffix ? ` ${suffix}` : ''}` : null,
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
