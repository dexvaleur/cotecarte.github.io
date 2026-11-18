/**
 * Seuil adaptatif (méthode de Bradley) : chaque pixel est comparé à la moyenne de ses voisins
 * plutôt qu'à un seuil unique pour toute l'image. Ainsi un texte foncé sur un bandeau gris,
 * lui-même entouré de zones claires, reste lisible.
 *
 * `gray` : niveaux de gris (0-255), modifié en place en noir (0) ou blanc (255).
 * `radius` : taille du voisinage ; `sensitivity` : écart minimal pour être « encre » (en %).
 */
export function adaptiveThreshold(gray: Float32Array | Uint8ClampedArray, w: number, h: number, radius: number, sensitivity = 0.12) {
  // Image intégrale : permet de calculer la somme d'un rectangle en 4 lectures.
  const integral = new Float64Array((w + 1) * (h + 1))
  for (let y = 0; y < h; y++) {
    let row = 0
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x]
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row
    }
  }
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius)
    const y1 = Math.min(h - 1, y + radius)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(w - 1, x + radius)
      const count = (x1 - x0 + 1) * (y1 - y0 + 1)
      const sum =
        integral[(y1 + 1) * (w + 1) + x1 + 1] -
        integral[y0 * (w + 1) + x1 + 1] -
        integral[(y1 + 1) * (w + 1) + x0] +
        integral[y0 * (w + 1) + x0]
      out[y * w + x] = gray[y * w + x] * count < sum * (1 - sensitivity) ? 0 : 255
    }
  }
  for (let i = 0; i < out.length; i++) gray[i] = out[i]
}
