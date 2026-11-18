// Tests automatiques : lance-les avec « npm test ».
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  nameSimilarity,
  parseCardNumber,
  parseCardNumbers,
  parseCopyrightYear,
  parseNameCandidates,
  parseSuffix,
  sameLocalId,
} from './parse.ts'

test('numéro classique', () => {
  assert.deepEqual(parseCardNumber('Illus. PLANETA Mochizuki 006/165 MEW'), {
    num: 6,
    total: 165,
    prefix: null,
    raw: '006',
  })
})

test('numéro avec espaces et erreurs OCR (O au lieu de 0, l au lieu de 1)', () => {
  const n = parseCardNumber('G  O25 / l65 ★')
  assert.equal(n?.num, 25)
  assert.equal(n?.total, 165)
})

test('carte secrète : numéro plus grand que le total', () => {
  const n = parseCardNumber('199/165')
  assert.equal(n?.num, 199)
  assert.equal(n?.total, 165)
})

test('galerie de dresseurs TG05/TG30', () => {
  const n = parseCardNumber('TG05/TG30')
  assert.equal(n?.num, 5)
  assert.equal(n?.prefix, 'TG')
  assert.equal(n?.raw, 'TG05')
})

test('carte promo SVP 085', () => {
  const n = parseCardNumber('Pokémon SVP 085')
  assert.equal(n?.num, 85)
  assert.equal(n?.total, null)
  assert.equal(n?.prefix, 'SVP')
})

test('chiffres parasites collés au numéro', () => {
  const all = parseCardNumbers('ex 4238/1917 à')
  assert.ok(all.some((n) => n.num === 238 && n.total === 191))
})

test('ignore la ligne « Évolution de »', () => {
  const c = parseNameCandidates("LP, 'Dracaufeu? - EX LAS:\n4; | Évolution de : Reptincel 377")
  assert.equal(c.includes('Reptincel'), false)
  assert.ok(c.includes('Dracaufeu'))
})

test('suffixe ex / V / VMAX', () => {
  assert.equal(parseSuffix('Dracaufeu - EX'), 'ex')
  assert.equal(parseSuffix('Pikachu VMAX 310 PV'), 'vmax')
  assert.equal(parseSuffix('Pikachu 60 PV'), null)
})

test('année du copyright', () => {
  assert.equal(parseCopyrightYear('©2023 Pokémon/Nintendo/Creatures/GAME FREAK', 2026), 2023)
  assert.equal(parseCopyrightYear('©1995, 96, 98 Nintendo ©1999 Wizards. 58/102', 2026), 1999)
  assert.equal(parseCopyrightYear('Aile de Bravoure', 2026), null)
})

test('pas de numéro', () => {
  assert.equal(parseCardNumber('Aile de Bravoure 60+'), null)
})

test('nom : ignore PV et mots de jeu', () => {
  const c = parseNameCandidates('NIVEAU 2 Dracaufeu ex PV 330')
  assert.equal(c[0].startsWith('Dracaufeu'), true)
  assert.ok(!c.includes('PV'))
})

test('ressemblance de noms', () => {
  assert.ok(nameSimilarity('Dracaufeu', 'Dracaufeu-ex') > 0.9)
  assert.ok(nameSimilarity('Dracaufcu', 'Dracaufeu') > 0.8) // une lettre mal lue
  assert.ok(nameSimilarity('Pikachu', 'Dracaufeu') < 0.4)
})

test('numéros équivalents', () => {
  assert.ok(sameLocalId('006', '6'))
  assert.ok(sameLocalId('TG05', 'TG5'))
  assert.ok(!sameLocalId('16', '6'))
})
