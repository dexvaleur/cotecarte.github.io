import type { BinderSlot } from './collection.ts'

/** Outils pour les classeurs : pages complètes, cases vides, échanges de place. */

export const BINDER_COLORS = ['#5b4cf5', '#e8572a', '#2f8fe0', '#3fa34d', '#e9b400', '#e46fb3', '#3d4566', '#b08a1e']

export const PAGE_FORMATS: { perPage: 4 | 9 | 12; label: string; hint: string; cols: number }[] = [
  { perPage: 9, label: '9 cases', hint: '3 × 3, le classeur classique', cols: 3 },
  { perPage: 4, label: '4 cases', hint: '2 × 2, petit classeur', cols: 2 },
  { perPage: 12, label: '12 cases', hint: '3 × 4, grand classeur', cols: 3 },
]

export const colsOf = (perPage: number) => PAGE_FORMATS.find((f) => f.perPage === perPage)?.cols ?? 3

/** Complète avec des cases vides jusqu'à la fin de la page (au moins une page). */
export function padToPages(slots: (BinderSlot | null)[], perPage: number): (BinderSlot | null)[] {
  const out = [...slots]
  if (!out.length) out.push(null)
  while (out.length % perPage) out.push(null)
  return out
}

export function pageCount(slots: unknown[], perPage: number): number {
  return Math.max(1, Math.ceil(slots.length / perPage))
}

/** Retire les cases vides : les cartes se suivent sans trou. */
export function compact(slots: (BinderSlot | null)[], perPage: number): (BinderSlot | null)[] {
  return padToPages(
    slots.filter((s): s is BinderSlot => s !== null),
    perPage,
  )
}

/** Échange deux cases (une carte et une case vide, ou deux cartes). */
export function swap<T>(slots: T[], a: number, b: number): T[] {
  const out = [...slots]
  ;[out[a], out[b]] = [out[b], out[a]]
  return out
}

/** Supprime la dernière page si elle est vide. */
export function dropEmptyLastPage(slots: (BinderSlot | null)[], perPage: number): (BinderSlot | null)[] {
  let out = slots
  while (out.length > perPage && out.slice(-perPage).every((s) => s === null)) out = out.slice(0, -perPage)
  return out
}
