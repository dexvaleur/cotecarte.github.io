import type { Card, TcgplayerVariant } from '../api/types'
import type { PricePoint } from '../components/PriceChart'

/**
 * Lecture des prix renvoyés par TCGdex.
 * - Cardmarket (Europe, en €) : tendance, prix bas, moyenne, et moyennes sur 1, 7 et 30 jours.
 * - TCGplayer (États-Unis, en $) : prix du marché, bas, moyen et haut, par version de la carte.
 */

/** Prix de référence en euros (pour la valeur de la collection). */
export function refPriceEur(card: Card): number | null {
  const cm = card.pricing?.cardmarket
  if (!cm) return null
  return pick(cm.trend, cm.avg, cm.avg30, cm.avg7)
}

function pick(...vals: (number | null | undefined)[]): number | null {
  for (const v of vals) if (typeof v === 'number' && v > 0) return v
  return null
}

export interface PriceRow {
  label: string
  market: number | null
  low: number | null
  mid: number | null
  high: number | null
}

export function cardmarketRows(card: Card): PriceRow[] {
  const cm = card.pricing?.cardmarket
  if (!cm) return []
  const rows: PriceRow[] = [
    { label: 'Normale', market: pick(cm.trend), low: pick(cm.low), mid: pick(cm.avg), high: null },
  ]
  // Les champs « -holo » de Cardmarket correspondent à la version reverse/brillante.
  if (pick(cm['trend-holo'], cm['avg-holo'], cm['avg30-holo'])) {
    rows.push({
      label: 'Reverse',
      market: pick(cm['trend-holo']),
      low: pick(cm['low-holo']),
      mid: pick(cm['avg-holo'], cm['avg30-holo']),
      high: null,
    })
  }
  return rows.filter((r) => r.market || r.low || r.mid)
}

const TCGP_LABELS: Record<string, string> = {
  normal: 'Normale',
  holofoil: 'Holo',
  reverseHolofoil: 'Reverse',
  '1stEditionHolofoil': '1re édition Holo',
  '1stEditionNormal': '1re édition',
  unlimitedHolofoil: 'Holo (illimitée)',
  unlimited: 'Illimitée',
}

export function tcgplayerRows(card: Card): PriceRow[] {
  const tp = card.pricing?.tcgplayer
  if (!tp) return []
  return Object.entries(tp)
    .filter(([k, v]) => k !== 'updated' && k !== 'unit' && typeof v === 'object' && v)
    .map(([k, v]) => {
      const p = v as TcgplayerVariant
      return {
        label: TCGP_LABELS[k] ?? k,
        market: pick(p.marketPrice),
        low: pick(p.lowPrice),
        mid: pick(p.midPrice),
        high: pick(p.highPrice),
      }
    })
    .filter((r) => r.market || r.low || r.mid || r.high)
}

/** Points de la courbe : moyennes sur 30 j, 7 j, 1 j puis tendance actuelle. */
export function chartPoints(card: Card): PricePoint[] {
  const cm = card.pricing?.cardmarket
  if (!cm) return []
  const pts: [string, number | null][] = [
    ['Moy. 30 j', pick(cm.avg30)],
    ['Moy. 7 j', pick(cm.avg7)],
    ['Hier', pick(cm.avg1)],
    ['Tendance', pick(cm.trend)],
  ]
  return pts.filter((p): p is [string, number] => p[1] !== null).map(([label, value]) => ({ label, value }))
}

/** Variation entre la moyenne sur 30 jours et la tendance actuelle (en %). */
export function change30d(card: Card): number | null {
  const cm = card.pricing?.cardmarket
  const a = pick(cm?.avg30)
  const b = pick(cm?.trend)
  if (!a || !b) return null
  return ((b - a) / a) * 100
}
