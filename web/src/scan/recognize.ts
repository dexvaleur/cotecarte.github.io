import { cardImage, getSet, getSets, searchByName, searchByNumber, setIdOf } from '../api/tcgdex'
import type { CardBrief } from '../api/types'
import { band, dHash, hashSimilarity, loadImage } from './image'
import { readText, readTextWithConfidence, type OcrProgress } from './ocr'
import { splitCardId, type AsianLang } from '../api/cardId'
import { SPECIES, speciesNames } from '../data/species'
import { API_URL } from '../lib/api'
import {
  hasMegaPrefix,
  isTrainerText,
  levenshtein,
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
  /** Image de la carte réellement analysée (redressée, dans le sens retenu) */
  preview: string
  readName: string | null
  readNumber: ParsedNumber | null
  candidates: Candidate[]
  /** true si on est assez sûr pour ouvrir directement la fiche */
  confident: boolean
}

// Code d'extension (« sv4a ») + numéro.
const SET_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/'

/**
 * Cherche l'extension d'après le code lu (« sv4a » → extension « SV4a »), puis la carte
 * avec l'un des numéros lus. Les confusions courantes (O/0, I/l/1) sont corrigées.
 */
async function findBySetCode(lang: AsianLang, text: string, nums: string[]): Promise<{ card: CardBrief; total: number }[]> {
  const tokens = [...new Set(text.match(/[A-Za-z][A-Za-z0-9]{1,6}/g) ?? [])]
  if (!tokens.length || !nums.length) return []
  const clean = (t: string) => t.toLowerCase().replace(/o/g, '0').replace(/[il|]/g, '1')
  const sets = await getSets(lang).catch(() => [])
  const codes = sets.map((s) => ({ set: s, code: clean(splitCardId(s.id).raw) }))
  // Code exact d'abord ; sinon à une lettre près (« sv4e » lu pour « sv4a »), en vérifiant que le numéro existe.
  const variants = tokens.flatMap((t) => [t, t.slice(1), t.slice(0, -1)]).map(clean).filter((v) => v.length >= 2)
  const exact = codes.filter((c) => variants.includes(c.code))
  const close = exact.length ? [] : codes.filter((c) => c.code.length >= 3 && variants.some((v) => v.length === c.code.length && levenshtein(v, c.code) === 1))
  const out: { card: CardBrief; total: number }[] = []
  for (const { set } of [...exact, ...close].slice(0, 6)) {
    try {
      const { data } = await getSet(set.id)
      for (const n of nums) {
        const card = data.cards.find((c) => sameLocalId(c.localId, n))
        if (card) {
          out.push({ card, total: set.cardCount.official })
          break
        }
      }
    } catch {
      /* extension indisponible */
    }
  }
  return out
}

// Chiffres et « / » seulement : avec des lettres, l'OCR confond « 0 » et « D », « 2 » et « Z »…
const NUMBER_CHARS = '0123456789/'

/** Noms de Pokémon reconnus dans un texte, du plus sûr au moins sûr. */
function speciesIn(names: string[]): SpeciesMatch[] {
  const found = names
    .slice(0, 5)
    .map((n) => matchSpecies(n, SPECIES))
    .filter((m): m is SpeciesMatch => m !== null)
    .sort((a, b) => b.score - a.score)
  // Un nom lu à l'identique (« Ogerpon ») : les ressemblances approximatives des autres mots
  // de la ligne sont du bruit (« Masque » de « Masque Turquoise » ≈ « Masquerain »).
  if (found[0]?.score >= 0.97) return found.filter((m) => m.score >= 0.97)
  return found
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
  const trainer = isTrainerText(text) ? 16 : 0
  return confidence + (found.length ? 35 * found[0].score : 0) + known * 8 + hp + trainer
}

/**
 * `views` : une ou plusieurs versions de la carte redressée (ex. dans les deux sens,
 * quand on ne sait pas où est le haut). On garde celle où l'OCR lit le mieux.
 */
/**
 * Langue des cartes scannées. « auto » : cartes françaises, anglaises, allemandes, italiennes,
 * espagnoles, portugaises… (mêmes extensions et numéros partout). Les cartes asiatiques ont
 * leurs propres extensions : on les reconnaît par leur numéro et leur illustration.
 */
export type ScanLang = 'auto' | AsianLang

export async function recognizeCard(views: HTMLCanvasElement[], onProgress?: OcrProgress, lang: ScanLang = 'auto'): Promise<Recognition> {
  const asian = lang !== 'auto'
  // --- 1. OCR -----------------------------------------------------------
  // Le nom est en haut à gauche ; le numéro en bas à gauche (cartes récentes)
  // ou en bas à droite (anciennes cartes).
  let card = views[0]
  let topText = ''
  let bestView = -Infinity
  let presetBottom: string | null = null
  const viewLog: { index: number; score: number; bottom: string | null }[] = []
  for (const [index, view] of views.entries()) {
    // On lit le haut de la carte ; si aucun nom n'est reconnu, on réessaie avec un seuil adaptatif.
    const r = await readTextWithConfidence(band(view, 0.02, 0.13, 0.03, 0.85), onProgress)
    let text = r.text
    // Petit avantage au sens de la photo (la 1re version) : il faut un indice net pour retourner la carte.
    let score = textQuality(text, r.confidence) + (index === 0 ? 20 : 0)
    if (!speciesIn(parseNameCandidates(text)).length) {
      const a = await readTextWithConfidence(band(view, 0.02, 0.13, 0.03, 0.85, 'adaptive'), onProgress)
      text += '\n' + a.text
      score = Math.max(score, textQuality(a.text, a.confidence) + (index === 0 ? 20 : 0))
    }
    // Si on hésite entre deux sens, le numéro en bas de carte aide à trouver le bon.
    let bottom: string | null = null
    if (views.length > 1) {
      bottom = await readText(band(view, 0.87, 0.995, 0, 0.55), onProgress, NUMBER_CHARS)
      // Seulement un numéro plausible (« 030/106 ») : à l'envers, on lit parfois des chiffres au hasard (« 0/0 »).
      // Le numéro doit être isolé : « 0012/7325 » (bruit lu à l'envers) ne compte pas.
      const plausibleNumber = (t: string) =>
        /(^|[^\d])\d{1,3}\s?\/\s?\d{2,3}([^\d]|$)/.test(t) &&
        parseCardNumbers(t).some((n) => n.total && n.total >= 10 && n.total <= 400 && n.num <= n.total * 1.6)
      if (plausibleNumber(bottom)) score += 40
      else if (asian) {
        // Cartes asiatiques : le haut ne se lit pas, donc on regarde de plus près le bas.
        // La ligne du numéro seule, puis l'année du copyright (« ©2024 ») tout en bas : seulement dans le bon sens.
        const line = await readText(band(view, 0.9, 0.975, 0.1, 0.42), onProgress, NUMBER_CHARS)
        bottom += '\n' + line
        if (plausibleNumber(line)) score += 40
        else if (/20[0-3]\d/.test(await readText(band(view, 0.955, 1, 0.15, 0.85), onProgress, NUMBER_CHARS))) score += 30
      }
    }
    viewLog.push({ index, score: Math.round(score), bottom })
    if (score > bestView) {
      bestView = score
      card = view
      topText = text
      presetBottom = bottom
    }
    // Lecture très claire dans ce sens : inutile d'essayer l'autre.
    if (score >= 140) break
  }

  // Carte Dresseur / Énergie : le nom n'est pas un Pokémon, inutile de chercher dans la liste des espèces.
  const trainer = isTrainerText(topText)

  // Numéro : contraste simple, puis seuil adaptatif, puis côté droit (anciennes cartes).
  // Cartes Dresseur : le cadre de texte de la règle touche le numéro, on lit une zone plus étroite
  // (et en couleurs inversées pour les cartes illustrées en entier, où le numéro est blanc).
  let bottomText = presetBottom ?? (await readText(band(card, 0.87, 0.995, 0, 0.55), onProgress, NUMBER_CHARS))
  let numbers = parseCardNumbers(bottomText)
  const attempts: (readonly [number, number, number, number, 'contrast' | 'adaptive' | 'inverted'])[] = trainer
    ? [
        [0.9, 0.98, 0, 0.36, 'contrast'],
        [0.9, 0.98, 0, 0.36, 'adaptive'],
        [0.9, 0.98, 0, 0.36, 'inverted'],
        [0.87, 0.995, 0.45, 1, 'contrast'],
      ]
    : [
        [0.87, 0.995, 0, 0.55, 'adaptive'],
        [0.87, 0.995, 0.45, 1, 'contrast'],
      ]
  // Dernier recours : juste la ligne du numéro, après le code de l'extension (cartes récentes,
  // utile quand le texte voisin gêne, ex. le texte d'ambiance des cartes japonaises).
  attempts.push([0.9, 0.975, 0.1, 0.42, 'contrast'], [0.9, 0.975, 0.1, 0.42, 'adaptive'])
  // Un numéro « plausible » : le total lu, et un numéro pas trop loin de ce total (« 100/18 » est sans doute mal lu).
  const plausible = () => numbers.some((n) => n.total && n.total >= 10 && n.total <= 400 && n.num <= n.total * 1.6)
  for (const [top, bottom, left, right, mode] of attempts) {
    if (plausible()) break
    bottomText += '\n' + (await readText(band(card, top, bottom, left, right, mode), onProgress, NUMBER_CHARS))
    numbers = parseCardNumbers(bottomText)
  }

  // Nom : si aucun nom de Pokémon n'est reconnu, on relit avec un seuil adaptatif
  // (texte sur un bandeau de couleur), puis en couleurs inversées (texte blanc).
  let names = parseNameCandidates(topText)
  // Cartes asiatiques : le nom n'est pas en lettres latines, inutile d'insister.
  if (asian) names = []
  for (const mode of ['adaptive', 'inverted'] as const) {
    if (asian || (trainer ? names.length > 0 : speciesIn(names).length)) break
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
  const species = trainer ? [] : speciesIn(names)
  // Suffixe (ex, V…) : seulement à côté du nom. Ailleurs sur la carte, des mots comme
  // « Règle V » ou « Pokémon-ex » donneraient de fausses pistes.
  const suffix = trainer ? null : (parseSuffix(topText) ?? species.find((m) => m.suffix)?.suffix ?? null)
  // « Méga Signal » est un Objet : le « Méga » ne compte que pour les Pokémon.
  const mega = !trainer && hasMegaPrefix(topText)
  // Nombres isolés : seulement dans la zone du numéro (la ligne du copyright est pleine de chiffres).
  const loose = looseNumbers(bottomText)

  // --- 2. Recherche -------------------------------------------------------
  const pool = new Map<string, CardBrief>()
  let readNumber: ParsedNumber | null = numbers[0] ?? null
  let byNumber: CardBrief[] = []
  for (const n of numbers.slice(0, 3)) {
    if (n.total === null) continue
    byNumber = await searchByNumber(n.raw, n.total, 0, asian ? lang : 'fr')
    if (byNumber.length) {
      readNumber = n
      break
    }
  }
  // Rien trouvé : le total a peut-être été mal lu d'un chiffre (6 ↔ 8, 3 ↔ 8…).
  if (!byNumber.length) {
    for (const n of numbers.slice(0, 2)) {
      if (n.total === null) continue
      byNumber = (await searchByNumber(n.raw, n.total, 2, asian ? lang : 'fr')).filter((c) => sameLocalId(c.localId, n.raw))
      if (byNumber.length) {
        readNumber = n
        break
      }
    }
  }
  // Cartes asiatiques : le code de l'extension est imprimé à côté du numéro (« sv8 », « SV4a ») et
  // c'est exactement l'identifiant de l'extension. Très utile quand le total est mal lu.
  let codeText = ''
  if (asian && !byNumber.some((c) => readNumber && sameLocalId(c.localId, readNumber.raw))) {
    // Le code est en blanc sur un petit cadre noir : on lit aussi en couleurs inversées.
    for (const mode of ['contrast', 'inverted'] as const) {
      codeText += (await readText(band(card, 0.9, 0.975, 0, 0.45, mode), onProgress, SET_CODE_CHARS)) + '\n'
      const found = await findBySetCode(lang, codeText, [...numbers.map((n) => n.raw), ...looseNumbers(bottomText + '\n' + codeText)])
      if (found.length) {
        byNumber = found.map((f) => f.card)
        readNumber = { num: parseInt(found[0].card.localId, 10) || 0, raw: found[0].card.localId, total: found[0].total, prefix: null }
        break
      }
    }
  }
  // Mode automatique, aucune extension internationale ne correspond au numéro : c'est peut-être
  // une carte japonaise (les plus courantes après les européennes). L'illustration départagera.
  if (!byNumber.length && !asian) {
    for (const n of numbers.slice(0, 2)) {
      if (n.total === null || n.total < 10 || n.num > n.total * 1.6) continue
      byNumber = await searchByNumber(n.raw, n.total, 0, 'ja').catch(() => [])
      if (byNumber.length) {
        readNumber = n
        break
      }
    }
  }
  byNumber.forEach((c) => pool.set(c.id, c))

  // Recherche par nom : d'abord les noms de Pokémon reconnus (orthographe exacte),
  // sinon les premières lettres du texte lu (résiste aux erreurs de lecture).
  // Nom lu dans une autre langue (« Glurak ») : on cherche avec le nom français et anglais.
  const speciesFr = species.map((m) => speciesNames(m.name)?.fr ?? m.name)
  const queries = species.length
    ? [...new Set(speciesFr)].slice(0, 2)
    : [...new Set(names.map((n) => n.split(' ')[0]).filter((w) => w.length >= 3))].slice(0, 2).map((w) => w.slice(0, 6))
  // Nom en un mot qui en fait deux dans la base (« Pokéball » → « Poké Ball ») : on cherche aussi le début du mot.
  if (!species.length && names[0] && names[0].length >= 7 && !names[0].includes(' ')) queries.push(names[0].slice(0, 4))
  for (const q of asian ? [] : queries) {
    const found = await searchByName(q)
    found.forEach((c) => pool.set(c.id, c))
  }

  // --- 3. Score -----------------------------------------------------------
  // Petit avantage aux extensions récentes (les plus scannées) pour départager les égalités.
  const sets = await getSets('fr').catch(() => [])
  const recency = new Map(sets.map((s, i) => [s.id, i / Math.max(1, sets.length - 1)]))
  const officialCount = new Map(sets.map((s) => [s.id, s.cardCount.official]))
  // Position approximative d'une année dans la liste des extensions (1999 → début, cette année → fin).
  const eraOf = (y: number) => Math.min(1, Math.max(0, (y - 1999) / Math.max(1, new Date().getFullYear() - 1999)))
  const candidates: Candidate[] = [...pool.values()].map((c) => {
    const nameScore = Math.max(
      0,
      ...names.map((n) => nameSimilarity(n, c.name)),
      ...species.map((m) => {
        const t = speciesNames(m.name)
        return m.score * Math.max(nameSimilarity(m.name, c.name), t ? Math.max(nameSimilarity(t.fr, c.name), nameSimilarity(t.en, c.name)) : 0)
      }),
    )
    const fromNumberSearch = byNumber.some((b) => b.id === c.id)
    // Le numéro « colle » seulement si le total correspond aussi à l'extension
    // (sauf cartes promo, qui n'ont pas de total).
    const numberMatch =
      readNumber !== null &&
      sameLocalId(c.localId, readNumber.raw) &&
      (fromNumberSearch || readNumber.total === null)
    const looseMatch = !numberMatch && loose.some((n) => sameLocalId(c.localId, n))
    // Numéro lu à un chiffre près (« 100/167 » pour « 190/167 »), dans la bonne extension :
    // fréquent avec un reflet ou une protection en plastique.
    const nearMatch =
      !numberMatch &&
      readNumber !== null &&
      readNumber.total !== null &&
      officialCount.get(setIdOf(c.id)) === readNumber.total &&
      /^\d+$/.test(c.localId) &&
      c.localId.replace(/^0+/, '').length === String(readNumber.num).length &&
      levenshtein(c.localId.replace(/^0+/, ''), String(readNumber.num)) === 1
    const cardSuffix = parseSuffix(' ' + c.name.replace(/-/g, ' '))
    // Suffixe lu = même suffixe sur la carte : bonus. Pas de suffixe lu : léger désavantage aux
    // cartes qui en ont un (le logo peut avoir été mal lu, donc seulement un peu).
    const suffixBonus = suffix ? (cardSuffix === suffix ? 0.4 : !cardSuffix ? -0.2 : 0) : cardSuffix ? -0.15 : 0
    const cardMega = /^m[ée]ga[- ]/i.test(c.name)
    const megaBonus = mega && cardMega ? 0.5 : mega && !cardMega ? -0.3 : 0
    // Année du copyright lue : avantage aux extensions de cette époque (et non plus aux plus récentes).
    const pos = recency.get(setIdOf(c.id)) ?? 0
    const recent = (year ? 1 - Math.abs(pos - eraOf(year)) : pos) * 0.3
    // Le numéro compte d'autant plus que le nom concorde : un numéro mal lu ne doit pas
    // faire passer devant une carte au nom sans rapport (ex. « 143/117 » lu à la place de « 013/172 »).
    // Carte asiatique : pas de nom lisible, le numéro (avec l'illustration) fait foi.
    const agree = splitCardId(c.id).lang ? 1 : 0.3 + 0.7 * nameScore
    const score =
      nameScore * 2.5 +
      (numberMatch ? 1.5 : nearMatch ? 0.8 : looseMatch ? 0.4 : 0) * agree +
      (fromNumberSearch ? 1 : 0) * agree +
      suffixBonus +
      megaBonus +
      recent
    // numberMatch reste « strict » (numéro + total) : un nombre isolé n'est qu'un indice,
    // jamais suffisant pour ouvrir directement une fiche.
    return { ...c, score, nameScore, numberMatch, imageScore: null }
  })
  candidates.sort((a, b) => b.score - a.score)

  // On garde les meilleurs, puis on compare époque et images pour les départager.
  // Nom sûr mais numéro illisible : on garde toutes les versions de la carte (jusqu'à 30),
  // l'utilisateur choisira (ou tapera le numéro pour filtrer).
  // Un numéro dont la carte ne porte pas le nom lu est sans doute mal lu : on garde la liste large.
  const strict = candidates.some((c) => c.numberMatch && c.nameScore >= 0.6)
  const limit = species.length && !strict ? 30 : 10
  // L'année du copyright départage d'abord une liste plus large : une extension récente pleine
  // de Pikachu ne doit pas cacher le Pikachu de 1999 qu'on a en main.
  let best = candidates.filter((c) => c.score >= 1).slice(0, 80)
  if (year) {
    await compareYears(year, best)
    best.sort((a, b) => b.score - a.score)
  }
  best = best.slice(0, limit)
  await compareImages(card, best)
  best.sort((a, b) => b.score - a.score)

  const [first, second] = best
  const gap = first && second ? first.score - second.score : Infinity
  const confident =
    !!first &&
    ((first.numberMatch && first.nameScore >= 0.7 && gap >= 0.5) ||
      (first.nameScore >= 0.85 && (first.imageScore ?? 0) >= 0.85 && gap >= 1) ||
      (first.nameScore >= 0.85 && (first.imageScore ?? 0) >= 0.88 && gap >= 0.5) ||
      // Nom illisible (carte asiatique, nom dans une autre langue) : numéro exact + illustration identique.
      (first.numberMatch && (first.imageScore ?? 0) >= 0.85 && gap >= 0.5))

  // Infos de diagnostic, consultables dans la console du navigateur (window.__pokecardScan).
  ;(globalThis as Record<string, unknown>).__pokecardScan = {
    cardPreview: card.toDataURL('image/jpeg', 0.7),
    topText,
    bottomText,
    codeText,
    viewLog,
    footer,
    year,
    names,
    trainer,
    species,
    suffix,
    mega,
    loose,
    numbers,
    candidates: best,
  }

  const shownName = species[0]?.name ?? names[0]
  return {
    preview: card.toDataURL('image/jpeg', 0.8),
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
 * les relaie avec un en-tête correct (route /img). Sans serveur, on saute cette étape.
 */
const IMAGE_PROXY: string | undefined = API_URL ? `${API_URL}/img?u=` : undefined

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
