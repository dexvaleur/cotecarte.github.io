import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compact, dropEmptyLastPage, padToPages, pageCount, swap } from './binders.ts'

const c = (id: string) => ({ cardId: id, name: id })

test('classeur : pages complètes et cases vides', () => {
  assert.equal(padToPages([], 9).length, 9)
  assert.equal(padToPages([c('a'), c('b')], 4).length, 4)
  assert.equal(padToPages(Array.from({ length: 10 }, (_, i) => c(String(i))), 9).length, 18)
  assert.equal(pageCount(new Array(18), 9), 2)
})

test('classeur : retirer les trous et échanger deux cases', () => {
  const slots = [c('a'), null, c('b'), null]
  assert.deepEqual(
    compact(slots, 4).map((s) => s?.cardId ?? null),
    ['a', 'b', null, null],
  )
  assert.deepEqual(
    swap(slots, 0, 1).map((s) => s?.cardId ?? null),
    [null, 'a', 'b', null],
  )
})

test('classeur : la dernière page vide disparaît', () => {
  const slots = [c('a'), null, null, null, null, null, null, null]
  assert.equal(dropEmptyLastPage(slots, 4).length, 4)
  assert.equal(dropEmptyLastPage([null, null, null, null], 4).length, 4)
})
