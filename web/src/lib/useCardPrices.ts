import { useEffect, useState } from 'react'
import { getCard } from '../api/tcgdex'
import { api, API_URL } from './api'
import { refPriceEur } from './prices'

export interface CardPrice {
  eur: number | null
  rarity?: string
  types?: string[]
}

// Résultats gardés en mémoire pendant 30 minutes : changer d'onglet ne relance pas tout.
const memo = new Map<string, { t: number; v: CardPrice }>()
const TTL = 30 * 60 * 1000

/**
 * Prix actuels (en €) de plusieurs cartes.
 * Avec notre serveur : une seule requête pour toutes les cartes.
 * Sans serveur : une requête par carte vers TCGdex (4 à la fois, avec le cache).
 */
export function useCardPrices(cardIds: string[]): { prices: Record<string, CardPrice>; loading: boolean } {
  const key = [...new Set(cardIds)].sort().join(',')
  const [prices, setPrices] = useState<Record<string, CardPrice>>(() => fromMemo(key))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const ids = key ? key.split(',') : []
    const missing = ids.filter((id) => !memo.has(id) || Date.now() - memo.get(id)!.t > TTL)
    if (!missing.length) {
      setPrices(fromMemo(key))
      return
    }
    let cancelled = false
    setLoading(true)
    fetchPrices(missing)
      .then(() => !cancelled && setPrices(fromMemo(key)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [key])

  return { prices, loading }
}

function fromMemo(key: string): Record<string, CardPrice> {
  const out: Record<string, CardPrice> = {}
  for (const id of key ? key.split(',') : []) {
    const m = memo.get(id)
    if (m) out[id] = m.v
  }
  return out
}

async function fetchPrices(ids: string[]) {
  if (API_URL) {
    try {
      for (let i = 0; i < ids.length; i += 300) {
        const { prices } = await api<{ prices: Record<string, CardPrice> }>('/prices/latest', {
          method: 'POST',
          body: { ids: ids.slice(i, i + 300) },
        })
        for (const [id, v] of Object.entries(prices)) memo.set(id, { t: Date.now(), v })
      }
      return
    } catch {
      /* serveur indisponible : on passe par TCGdex directement */
    }
  }
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(4, ids.length) }, async () => {
      while (next < ids.length) {
        const id = ids[next++]
        try {
          const { data } = await getCard(id)
          memo.set(id, { t: Date.now(), v: { eur: refPriceEur(data), rarity: data.rarity, types: data.types } })
        } catch {
          /* carte introuvable ou hors ligne : pas de prix */
        }
      }
    }),
  )
}

/** Historique jour par jour du prix d'une carte (seulement avec notre serveur). */
export function usePriceHistory(cardId: string, days = 30): { label: string; value: number }[] {
  const [points, setPoints] = useState<{ label: string; value: number }[]>([])
  useEffect(() => {
    if (!API_URL) return
    let cancelled = false
    api<{ points: { day: string; trend: number | null }[] }>(`/prices/${encodeURIComponent(cardId)}/history?days=${days}`)
      .then(({ points }) => {
        if (cancelled) return
        setPoints(
          points
            .filter((p) => p.trend !== null)
            .map((p) => ({ label: `${p.day.slice(8, 10)}/${p.day.slice(5, 7)}`, value: p.trend as number })),
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [cardId, days])
  return points
}
