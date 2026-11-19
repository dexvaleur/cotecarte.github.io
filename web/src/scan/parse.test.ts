// Tests automatiques : lance-les avec « npm test ».
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  hasMegaPrefix,
  isMarkerWord,
  isTrainerText,
  looseNumbers,
  matchSpecies,
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

// Cas tirés de vraies photos de cartes.
const SPECIES = ['Bulbizarre', 'Herbizarre', 'Florizarre', 'Mimiqui', 'Farfaduvet', 'Pikachu', 'Dracaufeu']

test('vraie photo : « EFlonizanre » → Florizarre', () => {
  assert.equal(matchSpecies('EFlonizanre', SPECIES)?.name, 'Florizarre')
})

test('vraie photo : « Mimiquies » → Mimiqui + suffixe ex', () => {
  const m = matchSpecies('Mimiquies', SPECIES)
  assert.equal(m?.name, 'Mimiqui')
  assert.equal(m?.suffix, 'ex')
})

test('pas de faux nom sur du bruit', () => {
  assert.equal(matchSpecies('SWISA', SPECIES), null)
})

test('vraie photo : numéro sans barre « 069159 »', () => {
  const n = parseCardNumber('2 4 30\n0\n069159\n0')
  assert.equal(n?.num, 69)
  assert.equal(n?.total, 159)
})

test('promo MEP sans total', () => {
  const n = parseCardNumber('MEP FR 013')
  assert.equal(n?.raw, '013')
  assert.equal(n?.total, null)
  assert.deepEqual(looseNumbers('4\n1 4\n013\n222'), ['013', '222'])
})

test('préfixe Méga et noms avec suffixes', () => {
  assert.ok(hasMegaPrefix('VEAU. EFlonizanre @X Méga,'))
  assert.ok(nameSimilarity('Florizarre', 'Méga-Florizarre-ex') === 1)
  assert.ok(nameSimilarity('Mimiqui', 'Mimiqui-ex') === 1)
})

test('vraie photo : logo « V » lu « y » (« Shayminy »)', () => {
  const m = matchSpecies('Shayminy', ['Shaymin', 'Sapereau'])
  assert.equal(m?.name, 'Shaymin')
  assert.equal(m?.suffix, 'v')
})

test('vraie photo : logo « ex » lu « e » (« Mimiquie »)', () => {
  assert.equal(matchSpecies('Mimiquie', ['Mimiqui', 'Mimigal'])?.suffix, 'ex')
})

test('cartes Dresseur : « DRESSEUR » mal lu n’est pas pris pour un nom (Cresselia)', () => {
  for (const w of ['RESSE', 'DRESSE', 'DRESSEUR', 'upporter', 'mObjet', 'Stade']) assert.ok(isMarkerWord(w), w)
  for (const w of ['Cresselia', 'Pikachu', 'Kassis', 'Plage']) assert.ok(!isMarkerWord(w), w)
  assert.deepEqual(parseNameCandidates('Supporter ea DRESSE\n\n| Recherches Professorales'), [
    'Recherches Professorales',
    'Professorales',
    'Recherches',
  ])
})

test('cartes Dresseur : détection du type de carte', () => {
  assert.ok(isTrainerText('Objet ref RES SE\n| Super Bonbon'))
  assert.ok(isTrainerText('_ Supporter mn DRESSE\n| Kassis'))
  assert.ok(!isTrainerText('NIVEAU 2 Dracaufeu ex PV 330'))
})

test('noms en plusieurs mots : « de », « du » ne comptent pas', () => {
  assert.equal(nameSimilarity('Terrain Plage', 'Terrain de Plage'), 1)
  assert.equal(nameSimilarity('Ordres Boss', 'Ordres du Boss'), 1)
})
