import assert from 'node:assert/strict'
import { test } from 'node:test'
import { arrange, dexNumber, type SortableRow } from './collectionSort.ts'

test('numéro de Pokédex à partir du nom de la carte', () => {
  assert.equal(dexNumber('Bulbizarre'), 1)
  assert.equal(dexNumber('Dracaufeu-ex'), 6)
  assert.equal(dexNumber('Méga-Florizarre-ex'), 3)
  assert.equal(dexNumber('Goupix d’Alola'), 37)
  assert.equal(dexNumber('Pikachu V'), 25)
  assert.equal(dexNumber('Charizard VMAX'), 6)
  assert.equal(dexNumber('Rugit-Lune-ex'), 1005)
  assert.equal(dexNumber('Recherches Professorales'), null)
})

const row = (name: string, unit: number, extra: Partial<SortableRow> & { qty?: number; set?: string; num?: string } = {}): SortableRow => ({
  item: {
    uid: name + (extra.set ?? ''),
    name,
    setId: extra.set ?? 'sv01',
    setName: extra.set === 'old' ? 'Ancienne' : 'Écarlate et Violet',
    localId: extra.num ?? '1',
    addedAt: '2026-01-01',
    quantity: extra.qty ?? 1,
  },
  rarity: extra.rarity,
  types: extra.types ?? [],
  unit,
})

test('tris simples', () => {
  const rows = [row('Pikachu', 2), row('Dracaufeu', 50), row('Bulbizarre', 0.2, { qty: 3 })]
  const names = (mode: Parameters<typeof arrange>[1]) => arrange(rows, mode)[0].rows.map((r) => r.item.name)
  assert.deepEqual(names('value'), ['Dracaufeu', 'Pikachu', 'Bulbizarre'])
  assert.deepEqual(names('cheap'), ['Bulbizarre', 'Pikachu', 'Dracaufeu'])
  assert.deepEqual(names('dex'), ['Bulbizarre', 'Dracaufeu', 'Pikachu'])
  assert.deepEqual(names('dupes')[0], 'Bulbizarre')
})

test('groupes par type, extension et rareté', () => {
  const rows = [
    row('Salamèche', 1, { types: ['Feu'], rarity: 'Commune', set: 'old', num: '10' }),
    row('Carapuce', 1, { types: ['Eau'], rarity: 'Commune', num: '2' }),
    row('Dracaufeu-ex', 80, { types: ['Feu'], rarity: 'Illustration spéciale rare', num: '199' }),
    row('Poké Ball', 0.1, { rarity: 'Commune', num: '185' }),
  ]
  const byType = arrange(rows, 'type')
  assert.deepEqual(byType.map((g) => g.title), ['Feu', 'Eau', 'Dresseurs et Énergies'])
  assert.deepEqual(byType[0].rows.map((r) => r.item.name), ['Salamèche', 'Dracaufeu-ex'])
  assert.equal(byType[0].value, 81)

  const bySet = arrange(rows, 'set', new Map([['old', 0], ['sv01', 5]]))
  assert.deepEqual(bySet.map((g) => g.title), ['Écarlate et Violet', 'Ancienne'])
  assert.deepEqual(bySet[0].rows.map((r) => r.item.localId), ['2', '185', '199'])

  const byRarity = arrange(rows, 'rarity')
  assert.equal(byRarity[0].title, 'Illustration spéciale rare')
})
