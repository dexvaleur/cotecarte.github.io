// Mise en forme des nombres et des dates « à la française ».

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const eurShort = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const num2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

export function formatEur(v: number | null | undefined, short = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return short && v >= 10 ? eurShort.format(v) : eur.format(v)
}

/** Dollars, version courte pour les tableaux : « 7,55 $ », « 1 001 $ ». */
export function formatUsd(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return `${v >= 100 ? num0.format(v) : num2.format(v)} $`
}

/** Euros, version courte pour les tableaux : sans centimes au-delà de 100 €. */
export function formatEurCompact(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return `${v >= 100 ? num0.format(v) : num2.format(v)} €`
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function timeAgo(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60000)
  if (min < 1) return 'à l’instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.round(h / 24)} j`
}
