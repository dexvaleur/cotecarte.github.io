import type { Candidate, Recognition } from './recognize'

/**
 * Combine deux lectures de la même carte (deux images de la rafale).
 * Une carte proposée par les deux lectures est plus probable : petit bonus.
 * On n'ouvre directement la fiche que si les deux lectures sont d'accord sur la 1re place
 * et que le numéro correspond.
 */
export function mergeRecognitions(a: Recognition, b: Recognition): Recognition {
  if (b.confident) return b
  if (a.confident) return a
  const byId = new Map<string, Candidate & { seen: number }>()
  for (const c of [...a.candidates, ...b.candidates]) {
    const prev = byId.get(c.id)
    if (!prev) {
      byId.set(c.id, { ...c, seen: 1 })
      continue
    }
    byId.set(c.id, {
      ...prev,
      score: Math.max(prev.score, c.score) + 0.6,
      nameScore: Math.max(prev.nameScore, c.nameScore),
      numberMatch: prev.numberMatch || c.numberMatch,
      imageScore: prev.imageScore ?? c.imageScore,
      seen: 2,
    })
  }
  const candidates = [...byId.values()].sort((x, y) => y.score - x.score).map(({ seen: _seen, ...c }) => c)
  const top = candidates[0]
  const bothFirst = !!top && a.candidates[0]?.id === top.id && b.candidates[0]?.id === top.id
  const gap = candidates.length > 1 ? top.score - candidates[1].score : Infinity
  const better = (b.candidates[0]?.score ?? 0) > (a.candidates[0]?.score ?? 0) ? b : a
  return {
    preview: better.preview,
    readName: a.readName ?? b.readName,
    readNumber: a.readNumber ?? b.readNumber,
    candidates,
    confident: bothFirst && top.numberMatch && gap >= 1,
  }
}
