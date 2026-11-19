import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enImageBase } from './enImage.ts'

test('image anglaise de repli', () => {
  assert.equal(enImageBase('dp6-012'), 'https://assets.tcgdex.net/en/dp/dp6/012')
  assert.equal(enImageBase('sv03.5-006'), 'https://assets.tcgdex.net/en/sv/sv03.5/006')
  assert.equal(enImageBase('inconnue-001'), undefined)
  assert.equal(enImageBase('sv03.5-006', 'https://assets.tcgdex.net/en/sv/sv03.5/006'), undefined)
})
