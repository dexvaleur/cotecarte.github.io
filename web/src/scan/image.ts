// Outils de traitement d'image (dans le navigateur, avec <canvas>).
import { locateCard } from './locate'
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
  const c = makeCanvas(9, 8)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, 9, 8)
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
