import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mergeRecognitions } from './merge.ts'
import type { Candidate, Recognition } from './recognize.ts'

const cand = (id: string, score: number, numberMatch = false): Candidate =>
  ({ id, localId: id, name: id, score, nameScore: 1, numberMatch, imageScore: null }) as Candidate
const rec = (candidates: Candidate[], confident = false): Recognition => ({ preview: 'p', readName: null, readNumber: null, candidates, confident })

test('fusion : une lecture sûre l’emporte', () => {
  const sure = rec([cand('b', 5, true)], true)
  assert.equal(mergeRecognitions(rec([cand('a', 3)]), sure), sure)
})

test('fusion : la carte vue dans les deux images remonte', () => {
  const m = mergeRecognitions(rec([cand('x', 3), cand('y', 2.8)]), rec([cand('z', 3.1), cand('y', 2.9)]))
  assert.equal(m.candidates[0].id, 'y')
  assert.equal(m.confident, false)
})

test('fusion : même 1re carte avec le bon numéro → ouverture directe', () => {
  const m = mergeRecognitions(rec([cand('y', 3, true), cand('x', 1)]), rec([cand('y', 3.2, true), cand('z', 1)]))
  assert.equal(m.candidates[0].id, 'y')
  assert.equal(m.confident, true)
})
