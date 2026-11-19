import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BOY, GIRL, normalizeAvatar, randomAvatar, shade, withGender } from './avatar.ts'

test('avatar : valeurs inconnues remplacées, bonnes valeurs gardées', () => {
  const a = normalizeAvatar({ gender: 'girl', hair: 'mohawk', skin: '#123456', height: 3, top: 'sweat' })
  assert.equal(a.hair, GIRL.hair)
  assert.equal(a.skin, '#123456')
  assert.equal(a.height, GIRL.height)
  assert.equal(a.top, 'sweat')
  assert.deepEqual(normalizeAvatar(null), BOY)
  assert.deepEqual(normalizeAvatar(randomAvatar()).gender !== undefined, true)
})

test('avatar : changer de genre garde les vêtements', () => {
  const a = withGender({ ...BOY, topColor: '#ffffff' }, 'girl')
  assert.equal(a.hair, GIRL.hair)
  assert.equal(a.topColor, '#ffffff')
})

test('avatar : assombrir et éclaircir une couleur', () => {
  assert.equal(shade('#ffffff', -0.5), '#808080')
  assert.equal(shade('#000000', 0.5), '#808080')
})
