// Outils de traitement d'image (dans le navigateur, avec <canvas>).
import { locateCard, type CardBox } from './locate'
import { adaptiveThreshold } from './threshold'

/** Ratio officiel d'une carte Pokémon : 63 mm × 88 mm. */
export const CARD_RATIO = 63 / 88

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

/** Charge un fichier image (galerie) dans un canvas, en tenant compte de la rotation EXIF. */
export async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, 2400 / Math.max(bmp.width, bmp.height))
  const c = makeCanvas(bmp.width * scale, bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return c
}

/**
 * Pour une photo de galerie, on recadre au centre au format carte
 * (on suppose que la carte remplit l'essentiel de la photo).
 */
export function cropToCard(src: HTMLCanvasElement): HTMLCanvasElement {
  const r = src.width / src.height
  let w = src.width
  let h = src.height
  if (r > CARD_RATIO) w = h * CARD_RATIO
  else h = w / CARD_RATIO
  const c = makeCanvas(w, h)
  c.getContext('2d')!.drawImage(src, (src.width - w) / 2, (src.height - h) / 2, w, h, 0, 0, w, h)
  return c
}

/**
 * Trouve la carte dans une photo et la redresse (voir locate.ts).
 * Renvoie deux versions : la carte dans le sens de la photo, et retournée à 180°
 * (l'OCR choisira), ou une seule avec `uprightOnly`. null si rien trouvé.
 */
export function findCard(
  src: HTMLCanvasElement,
  minQuality = 0.5,
  uprightOnly = false,
  /** Part minimale de l'image occupée par la carte (évite de prendre l'illustration pour la carte) */
  minArea = 0,
): HTMLCanvasElement[] | null {
  const scale = Math.min(1, 360 / Math.max(src.width, src.height))
  const W = Math.round(src.width * scale)
  const H = Math.round(src.height * scale)
  const small = makeCanvas(W, H)
  const ctx = small.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(src, 0, 0, W, H)
  const box = locateCard(ctx.getImageData(0, 0, W, H).data, W, H)
  if (!box || box.quality < minQuality) return null
  if ((box.w * box.h) / (W * H) < minArea) return null

  // Dimensions dans l'image d'origine.
  const cx = box.cx / scale
  const cy = box.cy / scale
  const w = box.w / scale
  const h = box.h / scale
  const outW = Math.min(1000, Math.round(w))
  const outH = Math.round(outW / CARD_RATIO)

  const draw = (sign: 1 | -1) => {
    const out = makeCanvas(outW, outH)
    const o = out.getContext('2d')!
    // Axe vertical de la sortie = grand côté de la carte ; axe horizontal = petit côté.
    const ux = box.ux * sign
    const uy = box.uy * sign
    const vx = uy // vecteur perpendiculaire (sens direct, pas de miroir)
    const vy = -ux
    const sx = outW / w
    const sy = outH / h
    o.setTransform(sx * vx, sy * ux, sx * vy, sy * uy, outW / 2 - sx * (vx * cx + vy * cy), outH / 2 - sy * (ux * cx + uy * cy))
    o.imageSmoothingQuality = 'high'
    o.drawImage(src, 0, 0)
    return out
  }
  // La version « droite dans la photo » (haut de la carte vers le haut de l'image) d'abord.
  // Pour une carte couchée (photo prise de côté), on ne peut pas savoir : on garde l'ordre.
  const upright: 1 | -1 = box.uy < -0.5 ? -1 : 1
  // Caméra : la carte est tenue droite dans le cadre, on ne teste pas l'autre sens.
  return uprightOnly ? [draw(upright)] : [draw(upright), draw(upright === 1 ? -1 : 1)]
}

/**
 * Découpe une bande horizontale de la carte (en %), l'agrandit et augmente
 * le contraste en noir et blanc : l'OCR lit beaucoup mieux ainsi.
 */
/**
 * Préparation de l'image pour l'OCR :
 * - « contrast » : niveaux de gris, contraste étiré (Tesseract choisit ensuite son seuil) ;
 * - « adaptive » : noir et blanc avec un seuil local (texte sur bandeau de couleur) ;
 * - « inverted » : comme « contrast », couleurs inversées (texte clair sur fond foncé).
 */
export type BandMode = 'contrast' | 'adaptive' | 'inverted'

export function band(
  src: HTMLCanvasElement,
  top: number,
  bottom: number,
  left = 0,
  right = 1,
  mode: BandMode = 'contrast',
): HTMLCanvasElement {
  const sx = src.width * left
  const sy = src.height * top
  const sw = src.width * (right - left)
  const sh = src.height * (bottom - top)
  const scale = Math.max(1, 1400 / sw)
  const c = makeCanvas(sw * scale, sh * scale)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height)
  enhance(ctx, c.width, c.height, mode)
  return c
}

/** Niveaux de gris, puis contraste étiré ou seuil adaptatif selon le mode. */
function enhance(ctx: CanvasRenderingContext2D, w: number, h: number, mode: BandMode) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const gray = new Float32Array(w * h)
  let min = 255
  let max = 0
  for (let i = 0; i < gray.length; i++) {
    const g = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
    gray[i] = g
    if (g < min) min = g
    if (g > max) max = g
  }
  if (mode === 'adaptive') {
    adaptiveThreshold(gray, w, h, Math.max(8, Math.round(Math.min(w, h) / 6)))
  } else {
    const range = Math.max(1, max - min)
    for (let i = 0; i < gray.length; i++) {
      const v = ((gray[i] - min) / range) * 255
      gray[i] = mode === 'inverted' ? 255 - v : v
    }
  }
  for (let i = 0; i < gray.length; i++) d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = gray[i]
  ctx.putImageData(img, 0, 0)
}

/**
 * « Empreinte » d'une image (dHash, 64 bits) : deux images qui se ressemblent
 * ont des empreintes proches. On l'applique à la zone de l'illustration.
 */
export function dHash(src: CanvasImageSource, width: number, height: number): Uint8Array {
  // Zone de l'illustration sur une carte classique (en %).
  const sx = width * 0.08
  const sy = height * 0.1
  const sw = width * 0.84
  const sh = height * 0.4
  // On réduit l'image petit à petit : réduite d'un coup en 9×8, le navigateur ne garde que quelques
  // pixels pris presque au hasard, et deux photos de la même carte donnaient des empreintes différentes.
  let cur: CanvasImageSource = src
  let cx = sx
  let cy = sy
  let cw = sw
  let ch = sh
  while (cw > 36 || ch > 32) {
    const nw = Math.max(9, Math.round(cw / 2))
    const nh = Math.max(8, Math.round(ch / 2))
    const step = makeCanvas(nw, nh)
    const sctx = step.getContext('2d')!
    sctx.imageSmoothingEnabled = true
    sctx.imageSmoothingQuality = 'high'
    sctx.drawImage(cur, cx, cy, cw, ch, 0, 0, nw, nh)
    cur = step
    cx = 0
    cy = 0
    cw = nw
    ch = nh
  }
  const c = makeCanvas(9, 8)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(cur, cx, cy, cw, ch, 0, 0, 9, 8)
  const d = ctx.getImageData(0, 0, 9, 8).data
  const bits = new Uint8Array(64)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = (y * 9 + x) * 4
      const a = d[i] + d[i + 1] + d[i + 2]
      const b = d[i + 4] + d[i + 5] + d[i + 6]
      bits[y * 8 + x] = a > b ? 1 : 0
    }
  }
  return bits
}

/** Ressemblance entre deux empreintes, de 0 à 1. */
export function hashSimilarity(a: Uint8Array, b: Uint8Array): number {
  let same = 0
  for (let i = 0; i < 64; i++) if (a[i] === b[i]) same++
  return same / 64
}

/** Charge une image distante (autorisée par CORS) pour la comparer. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = url
  })
}

export function canvasToDataUrl(c: HTMLCanvasElement, maxW = 480): string {
  const scale = Math.min(1, maxW / c.width)
  const small = makeCanvas(c.width * scale, c.height * scale)
  small.getContext('2d')!.drawImage(c, 0, 0, small.width, small.height)
  return small.toDataURL('image/jpeg', 0.8)
}

/**
 * Netteté d'une image : variance du laplacien sur une version réduite en gris.
 * Plus c'est élevé, plus les contours sont nets (une photo bougée ou floue donne une valeur basse).
 */
export function sharpness(src: CanvasImageSource & { width: number; height: number }): number {
  const W = 320
  const H = Math.max(1, Math.round((src.height / src.width) * W))
  const c = makeCanvas(W, H)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(src, 0, 0, W, H)
  const d = ctx.getImageData(0, 0, W, H).data
  const g = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
  let sum = 0
  let sum2 = 0
  let n = 0
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x
      const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - W] - g[i + W]
      sum += lap
      sum2 += lap * lap
      n++
    }
  }
  return n ? sum2 / n - (sum / n) ** 2 : 0
}

// ---- Photo difficile : protection rigide, reflets -----------------------------------

/** Repère la carte sur une version réduite de l'image (plus rapide). */
function locateIn(src: HTMLCanvasElement) {
  const scale = Math.min(1, 360 / Math.max(src.width, src.height))
  const W = Math.round(src.width * scale)
  const H = Math.round(src.height * scale)
  const small = makeCanvas(W, H)
  const ctx = small.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(src, 0, 0, W, H)
  const box = locateCard(ctx.getImageData(0, 0, W, H).data, W, H)
  return box ? { box, scale, W, H } : null
}

/** Découpe le rectangle trouvé et le redresse (sign = -1 : retourné à 180°), au rapport donné. */
function straighten(src: HTMLCanvasElement, box: CardBox, scale: number, sign: 1 | -1, ratio: number): HTMLCanvasElement {
  const cx = box.cx / scale
  const cy = box.cy / scale
  const w = box.w / scale
  const h = box.h / scale
  const outW = Math.min(1000, Math.round(w))
  const outH = Math.round(outW / ratio)
  const out = makeCanvas(outW, outH)
  const o = out.getContext('2d')!
  const ux = box.ux * sign
  const uy = box.uy * sign
  const sx = outW / w
  const sy = outH / h
  o.setTransform(sx * uy, sy * ux, -sx * ux, sy * uy, outW / 2 - sx * (uy * cx - ux * cy), outH / 2 - sy * (ux * cx + uy * cy))
  o.imageSmoothingQuality = 'high'
  o.drawImage(src, 0, 0)
  return out
}

function rotate180(c: HTMLCanvasElement): HTMLCanvasElement {
  const out = makeCanvas(c.width, c.height)
  const o = out.getContext('2d')!
  o.translate(c.width, c.height)
  o.rotate(Math.PI)
  o.drawImage(c, 0, 0)
  return out
}

/**
 * Carte dans une protection rigide (toploader) ? Le rectangle trouvé est alors un peu trop
 * large pour une carte (76 × 101 mm au lieu de 63 × 88).
 */
export function looksSleeved(src: HTMLCanvasElement): boolean {
  const f = locateIn(src)
  return !!f && f.box.quality >= 0.4 && f.box.w / f.box.h > 0.735
}

/**
 * Carte dans une protection : on redresse la protection, puis on cherche les 4 bords droits
 * de la carte à l'intérieur. On connaît sa forme (63 × 88 mm) : on teste toutes les positions
 * et tailles possibles et on garde celle dont les bords sont les plus marqués.
 * Renvoie la carte (et sa version retournée), ou null.
 */
export function findSleevedCard(src: HTMLCanvasElement, uprightOnly = false): HTMLCanvasElement[] | null {
  const f = locateIn(src)
  if (!f || f.box.w / f.box.h <= 0.735) return null
  const upright: 1 | -1 = f.box.uy < -0.5 ? -1 : 1
  const sleeve = straighten(src, f.box, f.scale, upright, f.box.w / f.box.h)

  const W = 240
  const H = Math.round((sleeve.height / sleeve.width) * W)
  const small = makeCanvas(W, H)
  const ctx = small.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(sleeve, 0, 0, W, H)
  const d = ctx.getImageData(0, 0, W, H).data
  const diff = (a: number, b: number) => Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2])
  // Force d'un bord vertical à la colonne x (moyenne sur la hauteur utile), idem à l'horizontale.
  const col = new Float32Array(W)
  const row = new Float32Array(H)
  for (let x = 1; x < W - 1; x++) {
    let sum = 0
    for (let y = Math.round(H * 0.15); y < H * 0.85; y++) sum += diff((y * W + x - 1) * 4, (y * W + x + 1) * 4)
    col[x] = sum / (H * 0.7)
  }
  for (let y = 1; y < H - 1; y++) {
    let sum = 0
    for (let x = Math.round(W * 0.15); x < W * 0.85; x++) sum += diff(((y - 1) * W + x) * 4, ((y + 1) * W + x) * 4)
    row[y] = sum / (W * 0.7)
  }
  const at = (p: Float32Array, i: number) => Math.max(p[i - 1] ?? 0, p[i], p[i + 1] ?? 0)
  const median = (p: Float32Array) => [...p].sort((a, b) => a - b)[Math.floor(p.length / 2)] || 1
  const mc = median(col)
  const mr = median(row)
  // Meilleure paire de bords pour un écart donné (gauche/droite ou haut/bas).
  const pair = (p: Float32Array, size: number, n: number) => {
    let pos = -1
    let v0 = 0
    for (let a = 1; a + size < n - 1; a++) {
      const v = Math.min(at(p, a), at(p, a + size))
      if (v > v0) [pos, v0] = [a, v]
    }
    return { pos, v: v0 }
  }
  const options: { x0: number; cw: number; y0: number; ch: number; score: number }[] = []
  for (let cw = Math.round(W * 0.74); cw <= W * 0.97; cw++) {
    const x = pair(col, cw, W)
    if (x.pos < 0) continue
    // Hauteur ≈ largeur / 0,716, avec un peu de marge (photo un peu de biais).
    let y = { pos: -1, v: 0, ch: 0 }
    for (let ch = Math.round((cw / CARD_RATIO) * 0.96); ch <= (cw / CARD_RATIO) * 1.05 && ch < H - 2; ch++) {
      const r = pair(row, ch, H)
      if (r.v > y.v) y = { ...r, ch }
    }
    if (y.pos < 0) continue
    options.push({ x0: x.pos, cw, y0: y.pos, ch: y.ch, score: Math.min(x.v / mc, y.v / mr) })
  }
  const top = Math.max(0, ...options.map((o) => o.score))
  if (top < 1.8) return null
  // Le cadre intérieur de la carte (autour de l'illustration) forme aussi un rectangle net :
  // parmi les bons candidats, on garde le plus grand, qui est le bord de la carte.
  const best = options.filter((o) => o.score >= Math.max(1.8, top * 0.6)).sort((a, b) => b.cw - a.cw)[0]
  const k = sleeve.width / W
  const outW = Math.min(1000, Math.round(best.cw * k))
  const card = makeCanvas(outW, Math.round(outW / CARD_RATIO))
  card.getContext('2d')!.drawImage(sleeve, best.x0 * k, best.y0 * k, best.cw * k, best.ch * k, 0, 0, card.width, card.height)
  return uprightOnly ? [card] : [card, rotate180(card)]
}

/**
 * Part de la carte « brûlée » par un reflet (pixels blancs saturés), de 0 à 1.
 * Au-delà de ~3 %, le nom ou le numéro risquent d'être illisibles.
 */
export function glareRatio(src: CanvasImageSource & { width: number; height: number }): number {
  const W = 120
  const H = Math.max(1, Math.round((src.height / src.width) * W))
  const c = makeCanvas(W, H)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(src, 0, 0, W, H)
  const d = ctx.getImageData(0, 0, W, H).data
  let n = 0
  for (let i = 0; i < W * H; i++) if (d[i * 4] >= 250 && d[i * 4 + 1] >= 250 && d[i * 4 + 2] >= 250) n++
  return n / (W * H)
}
