// Repérage de la carte dans une photo : fonctions « pures » (sans canvas), testées dans locate.test.ts.

export interface CardBox {
  /** Centre de la carte (en pixels de l'image analysée) */
  cx: number
  cy: number
  /** Direction du grand côté de la carte (vecteur unitaire) */
  ux: number
  uy: number
  /** Largeur (petit côté) et hauteur (grand côté) */
  w: number
  h: number
  /** Qualité de la détection, de 0 à 1 */
  quality: number
}

const CARD_RATIO = 63 / 88

/**
 * Cherche le rectangle « au format carte » dans une image RGBA.
 *
 * 1. On estime la couleur du fond (la table) à partir du pourtour de la photo.
 * 2. On marque les pixels nettement différents du fond.
 * 3. On regroupe les pixels voisins en « taches » et on garde celle qui ressemble
 *    le plus à un rectangle de carte (bonne proportion, bien remplie, pas collée aux bords).
 * 4. On calcule son orientation (analyse en composantes principales) pour la redresser.
 */
export function locateCard(data: Uint8ClampedArray, W: number, H: number): CardBox | null {
  const N = W * H
  const rgb = blur(data, W, H)

  // 1. Couleur du fond : médiane du pourtour (4 % de chaque côté).
  const m = Math.max(2, Math.round(Math.min(W, H) * 0.04))
  const border: number[] = []
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (x < m || y < m || x >= W - m || y >= H - m) border.push(y * W + x)
  const bg = [0, 1, 2].map((k) => median(border.map((i) => rgb[i * 3 + k])))

  // 2. Distance de chaque pixel au fond. On sépare luminosité (Y) et couleur (Cb, Cr) :
  // un reflet de lumière sur la table change surtout la luminosité, une carte change la couleur.
  // La luminosité compte donc moitié moins. Le seuil s'adapte à la texture du fond.
  const [bgY, bgCb, bgCr] = ycc(bg[0], bg[1], bg[2])
  const dist = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const [y, cb, cr] = ycc(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2])
    const dy = (y - bgY) * 0.5
    dist[i] = Math.sqrt(dy * dy + 2 * ((cb - bgCb) ** 2 + (cr - bgCr) ** 2))
  }
  const borderDist = border.map((i) => dist[i]).sort((a, b) => a - b)
  const threshold = Math.max(25, borderDist[Math.floor(borderDist.length * 0.6)] * 2.2)
  let mask: Uint8Array = new Uint8Array(N)
  for (let i = 0; i < N; i++) mask[i] = dist[i] > threshold ? 1 : 0

  // Nettoyage du masque :
  // - « fermeture » (dilater puis éroder) : recolle les petits morceaux de la carte ;
  // - « ouverture » (éroder puis dilater) : coupe les traits fins (reflets sur la table) ;
  // - on remplit les trous à l'intérieur des taches.
  const r = Math.max(2, Math.round(Math.min(W, H) * 0.01))
  mask = erode(dilate(mask, W, H, r), W, H, r)
  mask = dilate(erode(mask, W, H, r + 1), W, H, r + 1)
  mask = fillHoles(mask, W, H)

  // 3. Taches (composantes connexes) et choix de la meilleure.
  const label = new Int32Array(N).fill(-1)
  let best: CardBox | null = null
  let bestScore = 0
  const stack: number[] = []
  for (let start = 0; start < N; start++) {
    if (!mask[start] || label[start] !== -1) continue
    const pixels: number[] = []
    label[start] = start
    stack.push(start)
    let touches = 0
    while (stack.length) {
      const i = stack.pop()!
      pixels.push(i)
      const x = i % W
      const y = (i / W) | 0
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) touches++
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]
      for (const j of nb) if (j >= 0 && mask[j] && label[j] === -1) {
        label[j] = start
        stack.push(j)
      }
    }
    if (pixels.length < N * 0.03) continue

    const box = orientedBox(pixels, W)
    const fill = pixels.length / (box.w * box.h)
    const ratio = box.w / box.h
    const ratioFit = Math.max(0, 1 - Math.abs(ratio - CARD_RATIO) / (CARD_RATIO * 0.3))
    const touchPenalty = touches > (box.w + box.h) * 0.1 ? 0.3 : 1
    const quality = Math.min(1, fill) * ratioFit * touchPenalty
    const score = pixels.length * quality * quality
    if (fill > 0.55 && ratioFit > 0 && score > bestScore) {
      bestScore = score
      best = { ...box, quality }
    }
  }
  return best
}

/** Rectangle orienté qui entoure une tache (centre, direction du grand côté, dimensions). */
function orientedBox(pixels: number[], W: number): Omit<CardBox, 'quality'> {
  let sx = 0
  let sy = 0
  for (const i of pixels) {
    sx += i % W
    sy += (i / W) | 0
  }
  const n = pixels.length
  const mx = sx / n
  const my = sy / n
  let cxx = 0
  let cyy = 0
  let cxy = 0
  for (const i of pixels) {
    const dx = (i % W) - mx
    const dy = ((i / W) | 0) - my
    cxx += dx * dx
    cyy += dy * dy
    cxy += dx * dy
  }
  // Direction principale (grand axe), puis affinage : on teste les angles voisins
  // et on garde celui qui donne le rectangle le plus serré.
  const phi0 = 0.5 * Math.atan2(2 * cxy, cxx - cyy)
  const q = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * p)))]
  const measure = (phi: number) => {
    const ux = Math.cos(phi)
    const uy = Math.sin(phi)
    const along: number[] = []
    const across: number[] = []
    for (const i of pixels) {
      const dx = (i % W) - mx
      const dy = ((i / W) | 0) - my
      along.push(dx * ux + dy * uy)
      across.push(-dx * uy + dy * ux)
    }
    along.sort((a, b) => a - b)
    across.sort((a, b) => a - b)
    // On ignore 1 % de pixels extrêmes de chaque côté.
    const a0 = q(along, 0.01)
    const a1 = q(along, 0.99)
    const b0 = q(across, 0.01)
    const b1 = q(across, 0.99)
    return { ux, uy, a0, a1, b0, b1, area: (a1 - a0) * (b1 - b0) }
  }
  let best = measure(phi0)
  for (let deg = -15; deg <= 15; deg += 1.5) {
    if (deg === 0) continue
    const m = measure(phi0 + (deg * Math.PI) / 180)
    if (m.area < best.area) best = m
  }
  const { ux, uy, a0, a1, b0, b1 } = best
  let h = a1 - a0 + 1
  let w = b1 - b0 + 1
  // Centre du rectangle (pas forcément le centre de gravité).
  const ca = (a0 + a1) / 2
  const cb = (b0 + b1) / 2
  const cx = mx + ca * ux - cb * uy
  const cy = my + ca * uy + cb * ux
  let dirX = ux
  let dirY = uy
  if (w > h) {
    // La tache est plus large que haute : le grand axe est l'autre.
    ;[w, h] = [h, w]
    dirX = -uy
    dirY = ux
  }
  return { cx, cy, ux: dirX, uy: dirY, w, h }
}

function blur(data: Uint8ClampedArray, W: number, H: number): Float32Array {
  let cur = new Float32Array(W * H * 3)
  for (let i = 0; i < W * H; i++) for (let k = 0; k < 3; k++) cur[i * 3 + k] = data[i * 4 + k]
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(cur.length)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        for (let k = 0; k < 3; k++) {
          let s = 0
          let c = 0
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx
              const yy = y + dy
              if (xx >= 0 && yy >= 0 && xx < W && yy < H) {
                s += cur[(yy * W + xx) * 3 + k]
                c++
              }
            }
          next[(y * W + x) * 3 + k] = s / c
        }
    cur = next
  }
  return cur
}

function dilate(mask: Uint8Array, W: number, H: number, r: number): Uint8Array {
  return morph(mask, W, H, r, 1)
}
function erode(mask: Uint8Array, W: number, H: number, r: number): Uint8Array {
  return morph(mask, W, H, r, 0)
}
/** Dilatation (value=1) ou érosion (value=0) avec un carré de rayon r. */
function morph(mask: Uint8Array, W: number, H: number, r: number, value: 0 | 1): Uint8Array {
  const out = new Uint8Array(mask.length)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let hit = value === 0 ? 1 : 0
      for (let dy = -r; dy <= r && hit !== value; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const xx = Math.min(W - 1, Math.max(0, x + dx))
          const yy = Math.min(H - 1, Math.max(0, y + dy))
          if (mask[yy * W + xx] === value) {
            hit = value
            break
          }
        }
      out[y * W + x] = hit
    }
  return out
}

/** Conversion RVB → luminosité (Y) + deux composantes de couleur (Cb, Cr). */
function ycc(r: number, g: number, b: number): [number, number, number] {
  return [0.299 * r + 0.587 * g + 0.114 * b, -0.169 * r - 0.331 * g + 0.5 * b, 0.5 * r - 0.419 * g - 0.081 * b]
}

/** Remplit les trous : tout ce qui n'est pas relié au bord de l'image par du « fond ». */
function fillHoles(mask: Uint8Array, W: number, H: number): Uint8Array {
  const outside = new Uint8Array(mask.length)
  const stack: number[] = []
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x)
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1)
  while (stack.length) {
    const i = stack.pop()!
    if (outside[i] || mask[i]) continue
    outside[i] = 1
    const x = i % W
    if (x > 0) stack.push(i - 1)
    if (x < W - 1) stack.push(i + 1)
    if (i >= W) stack.push(i - W)
    if (i < W * (H - 1)) stack.push(i + W)
  }
  const out = new Uint8Array(mask.length)
  for (let i = 0; i < mask.length; i++) out[i] = outside[i] ? 0 : 1
  return out
}

function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b)
  return s[s.length >> 1] ?? 0
}
