import { createStore, del, entries, set } from 'idb-keyval'
import { useSyncExternalStore } from 'react'

/**
 * Scans ratés : quand le scanner n'a pas ouvert directement la bonne carte et que
 * l'utilisateur l'a trouvée lui-même, on garde la photo et la bonne réponse.
 * Ces exemples servent à améliorer le scanner (partage depuis les Réglages).
 * Gardés sur le téléphone uniquement.
 */
export interface FailedScan {
  id: string
  at: string
  /** Bonne carte (choisie par l'utilisateur) */
  cardId: string
  cardName: string
  /** Carte ouverte à tort par le scanner, s'il y en a eu une */
  openedId?: string
  /** Ce que le scanner a lu */
  read: string
  dataUrl: string
}

const MAX = 30
const store = createStore('pokecard-scanlog', 'scans')
let scans: FailedScan[] = []
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

entries<string, FailedScan>(store)
  .then((all) => {
    scans = all.map(([, v]) => v).sort((a, b) => b.at.localeCompare(a.at))
    notify()
  })
  .catch(() => {})

export function useFailedScans(): FailedScan[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => scans,
  )
}

export async function logFailedScan(scan: Omit<FailedScan, 'id' | 'at'>) {
  const full: FailedScan = { ...scan, id: `${Date.now()}`, at: new Date().toISOString() }
  scans = [full, ...scans]
  const removed = scans.slice(MAX)
  scans = scans.slice(0, MAX)
  notify()
  await set(full.id, full, store).catch(() => {})
  for (const r of removed) await del(r.id, store).catch(() => {})
}

export async function clearFailedScans() {
  const old = scans
  scans = []
  notify()
  for (const s of old) await del(s.id, store).catch(() => {})
}

const safe = (s: string) => s.replace(/[^\w.-]+/g, '_')

/** Fichiers à partager : une image par scan (nom = bonne carte) + un résumé texte. */
export async function failedScanFiles(): Promise<File[]> {
  const files: File[] = []
  for (const s of scans) {
    const blob = await (await fetch(s.dataUrl)).blob()
    files.push(new File([blob], `scan_${safe(s.cardId)}_${s.id}.jpg`, { type: 'image/jpeg' }))
  }
  const summary = scans
    .map((s) => `${s.at.slice(0, 16)} | bonne carte : ${s.cardId} (${s.cardName}) | ouverte : ${s.openedId ?? '-'} | lu : ${s.read}`)
    .join('\n')
  files.push(new File([summary], 'scans_rates.txt', { type: 'text/plain' }))
  return files
}

/** Partage (Android/iOS) ou, à défaut, téléchargement des fichiers un par un. */
export async function shareFailedScans(): Promise<'shared' | 'downloaded'> {
  const files = await failedScanFiles()
  if (navigator.canShare?.({ files })) {
    await navigator.share({ files, title: 'Scans ratés Cote Carte' })
    return 'shared'
  }
  for (const f of files) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(f)
    a.download = f.name
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return 'downloaded'
}
