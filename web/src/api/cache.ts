import { createStore, get, set } from 'idb-keyval'
import type { Cached } from './types'

/**
 * Cache des appels réseau.
 * 1. En mémoire (instantané, perdu à la fermeture de l'appli)
 * 2. Dans IndexedDB, une petite base de données du navigateur (gardée entre les visites)
 * Si le réseau ou l'API ne répond pas, on renvoie la dernière version connue.
 */

export type ApiErrorKind = 'offline' | 'unavailable' | 'notfound'

export class ApiError extends Error {
  kind: ApiErrorKind
  constructor(kind: ApiErrorKind) {
    super(
      kind === 'offline'
        ? 'Pas de connexion internet.'
        : kind === 'notfound'
          ? 'Introuvable.'
          : 'Le service de cartes ne répond pas pour le moment.',
    )
    this.kind = kind
  }
}

interface Entry {
  t: number // date de téléchargement
  data: unknown
}

const store = typeof indexedDB !== 'undefined' ? createStore('pokecard-cache', 'http') : undefined
const memory = new Map<string, Entry>()
const inflight = new Map<string, Promise<Cached<unknown>>>()

async function readDisk(key: string): Promise<Entry | undefined> {
  try {
    return store ? await get<Entry>(key, store) : undefined
  } catch {
    return undefined
  }
}

async function writeDisk(key: string, entry: Entry) {
  try {
    if (store) await set(key, entry, store)
  } catch {
    /* stockage plein ou bloqué : pas grave, on garde la mémoire */
  }
}

/** Télécharge un JSON en utilisant le cache si la copie a moins de `ttlMs` millisecondes. */
export function cachedJson<T>(url: string, ttlMs: number): Promise<Cached<T>> {
  const pending = inflight.get(url)
  if (pending) return pending as Promise<Cached<T>>

  const run = (async (): Promise<Cached<T>> => {
    const now = Date.now()
    const hit = memory.get(url) ?? (await readDisk(url))
    if (hit && now - hit.t < ttlMs) {
      memory.set(url, hit)
      return { data: hit.data as T, stale: false, fetchedAt: hit.t }
    }

    try {
      const res = await fetch(url)
      if (res.status === 404) throw new ApiError('notfound')
      if (!res.ok) throw new ApiError('unavailable')
      const data = (await res.json()) as T
      const entry = { t: Date.now(), data }
      memory.set(url, entry)
      void writeDisk(url, entry)
      return { data, stale: false, fetchedAt: entry.t }
    } catch (err) {
      if (err instanceof ApiError && err.kind === 'notfound') throw err
      // Réseau coupé ou API en panne : on se rabat sur l'ancienne copie si on en a une.
      if (hit) return { data: hit.data as T, stale: true, fetchedAt: hit.t }
      if (err instanceof ApiError) throw err
      throw new ApiError(navigator.onLine ? 'unavailable' : 'offline')
    }
  })()

  inflight.set(url, run)
  run.finally(() => inflight.delete(url)).catch(() => {})
  return run
}

export const HOUR = 60 * 60 * 1000
export const DAY = 24 * HOUR
