// Outils de traitement d'image (dans le navigateur, avec <canvas>).

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
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
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
 * Détecte la carte dans une photo (posée sur une table, un tapis…).
 * Principe : on estime la couleur du fond grâce aux bords de la photo, puis on cherche
 * le rectangle où les pixels sont différents du fond.
 * Renvoie la carte recadrée, ou null si on n'a rien trouvé de convaincant.
 */
export function detectCard(src: HTMLCanvasElement, minArea = 0.2): HTMLCanvasElement | null {
  const W = 240
  const scale = W / src.width
  const H = Math.round(src.height * scale)
  const small = makeCanvas(W, H)
  const ctx = small.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(src, 0, 0, W, H)
  const d = ctx.getImageData(0, 0, W, H).data

  // 1. Couleur du fond = médiane des pixels du pourtour (3 % de chaque côté).
  const border: number[][] = []
  const m = Math.max(2, Math.round(Math.min(W, H) * 0.03))
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (x < m || y < m || x >= W - m || y >= H - m) {
        const i = (y * W + x) * 4
        border.push([d[i], d[i + 1], d[i + 2]])
      }
  const med = [0, 1, 2].map((k) => border.map((p) => p[k]).sort((a, b) => a - b)[border.length >> 1])

  // 2. Pixels « différents du fond », comptés par ligne et par colonne.
  const rows = new Array<number>(H).fill(0)
  const cols = new Array<number>(W).fill(0)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const dist = Math.abs(d[i] - med[0]) + Math.abs(d[i + 1] - med[1]) + Math.abs(d[i + 2] - med[2])
      if (dist > 70) {
        rows[y]++
        cols[x]++
      }
    }

  // 3. La carte = lignes et colonnes majoritairement « différentes ».
  const top = rows.findIndex((v) => v > W * 0.3)
  const bottom = H - 1 - [...rows].reverse().findIndex((v) => v > W * 0.3)
  const left = cols.findIndex((v) => v > H * 0.3)
  const right = W - 1 - [...cols].reverse().findIndex((v) => v > H * 0.3)
  if (top < 0 || left < 0 || bottom <= top || right <= left) return null

  const bw = right - left + 1
  const bh = bottom - top + 1
  const ratio = bw / bh
  const area = (bw * bh) / (W * H)
  if (ratio < CARD_RATIO * 0.8 || ratio > CARD_RATIO * 1.25 || area < minArea || area > 0.97) return null

  const sx = left / scale
  const sy = top / scale
  const out = makeCanvas(Math.min(bw / scale, 1000), Math.min(bw / scale, 1000) / CARD_RATIO)
  out.getContext('2d')!.drawImage(src, sx, sy, bw / scale, bh / scale, 0, 0, out.width, out.height)
  return out
}

/**
 * Découpe une bande horizontale de la carte (en %), l'agrandit et augmente
 * le contraste en noir et blanc : l'OCR lit beaucoup mieux ainsi.
 */
export function band(src: HTMLCanvasElement, top: number, bottom: number, left = 0, right = 1): HTMLCanvasElement {
  const sx = src.width * left
  const sy = src.height * top
  const sw = src.width * (right - left)
  const sh = src.height * (bottom - top)
  const scale = Math.max(1, 1400 / sw)
  const c = makeCanvas(sw * scale, sh * scale)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height)
  enhance(ctx, c.width, c.height)
  return c
}

/** Niveaux de gris + étirement du contraste. */
function enhance(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  let min = 255
  let max = 0
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = g
    if (g < min) min = g
    if (g > max) max = g
  }
  const range = Math.max(1, max - min)
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) / range) * 255
    d[i] = d[i + 1] = d[i + 2] = v
  }
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
