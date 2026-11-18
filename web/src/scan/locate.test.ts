import assert from 'node:assert/strict'
import { test } from 'node:test'
import { locateCard } from './locate.ts'

/** Fabrique une image : fond gris bruité + rectangle coloré tourné d'un angle donné. */
function synth(W: number, H: number, cx: number, cy: number, w: number, h: number, angleDeg: number) {
  const data = new Uint8ClampedArray(W * H * 4)
  const a = (angleDeg * Math.PI) / 180
  let seed = 1
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      // Coordonnées dans le repère du rectangle
      const dx = x - cx
      const dy = y - cy
      const along = dx * Math.sin(a) + dy * Math.cos(a)
      const across = dx * Math.cos(a) - dy * Math.sin(a)
      const inside = Math.abs(along) < h / 2 && Math.abs(across) < w / 2
      const g = 100 + rnd() * 25 // texture du bois
      data[i] = inside ? 200 : g
      data[i + 1] = inside ? 120 + (x % 30) * 2 : g
      data[i + 2] = inside ? 220 : g + 5
      data[i + 3] = 255
    }
  return data
}

test('trouve une carte droite au milieu de la table', () => {
  const box = locateCard(synth(240, 320, 120, 160, 90, 126, 0), 240, 320)
  assert.ok(box)
  assert.ok(Math.abs(box.cx - 120) < 4 && Math.abs(box.cy - 160) < 4)
  assert.ok(Math.abs(box.w - 90) < 8 && Math.abs(box.h - 126) < 8)
  assert.ok(Math.abs(box.uy) > 0.99) // grand côté vertical
})

test('trouve une carte inclinée de 12°', () => {
  const box = locateCard(synth(240, 320, 110, 170, 80, 112, 12), 240, 320)
  assert.ok(box)
  const angle = (Math.atan2(box.ux, box.uy) * 180) / Math.PI
  assert.ok(Math.abs(Math.abs(angle) - 12) < 3 || Math.abs(Math.abs(angle) - 168) < 3, `angle ${angle}`)
  assert.ok(Math.abs(box.h / box.w - 112 / 80) < 0.12)
})

test('trouve une carte couchée (photo prise de côté)', () => {
  const box = locateCard(synth(320, 240, 160, 120, 100, 140, 90), 320, 240)
  assert.ok(box)
  assert.ok(Math.abs(box.ux) > 0.99) // grand côté horizontal
  assert.ok(box.h > box.w)
})

test('rien à trouver sur une table vide', () => {
  assert.equal(locateCard(synth(200, 200, -500, -500, 10, 10, 0), 200, 200), null)
})
