import { useEffect, useState } from 'react'
import { api, API_URL, useSession } from './api'
import { load, save } from './storage'

/**
 * Évolution de la valeur de la collection.
 * - Connecté : calculée par le serveur à partir des prix relevés chaque jour.
 * - Sans compte : on note la valeur une fois par jour sur le téléphone, quand l'onglet est ouvert.
 */

type Log = Record<string, number> // « 2026-11-18 » → valeur en €

export function recordLocalValue(value: number) {
  const today = new Date().toISOString().slice(0, 10)
  const log = load<Log>('valueLog', {})
  if (log[today] === value) return
  log[today] = Math.round(value * 100) / 100
  // On garde un an au maximum.
  const days = Object.keys(log).sort()
  for (const d of days.slice(0, Math.max(0, days.length - 365))) delete log[d]
  save('valueLog', log)
}

export interface ValuePoint {
  day: string
  value: number
}

export function useValueHistory(days = 90): ValuePoint[] {
  const session = useSession()
  const [points, setPoints] = useState<ValuePoint[]>([])
  useEffect(() => {
    let cancelled = false
    const local = () =>
      Object.entries(load<Log>('valueLog', {}))
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-days)
        .map(([day, value]) => ({ day, value }))
    if (API_URL && session) {
      api<{ points: ValuePoint[] }>(`/collection/value-history?days=${days}`)
        .then((r) => !cancelled && setPoints(r.points.length >= 2 ? r.points : local()))
        .catch(() => !cancelled && setPoints(local()))
    } else {
      setPoints(local())
    }
    return () => {
      cancelled = true
    }
  }, [session, days])
  return points
}
