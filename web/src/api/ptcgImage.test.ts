import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ptcgImageUrl } from './ptcgImage.ts'

test('image de secours pokemontcg.io', () => {
  assert.equal(ptcgImageUrl('swsh9tg-TG07'), 'https://images.pokemontcg.io/swsh9tg/TG07.png')
  assert.equal(ptcgImageUrl('sv03.5-006', 'high'), 'https://images.pokemontcg.io/sv3pt5/6_hires.png')
  assert.equal(ptcgImageUrl('sv01-095'), 'https://images.pokemontcg.io/sv1/95.png')
  assert.equal(ptcgImageUrl('swsh4.5sv-SV051'), 'https://images.pokemontcg.io/swsh45sv/SV051.png')
})
