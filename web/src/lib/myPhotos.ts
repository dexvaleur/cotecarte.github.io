import { createStore, del, entries, set } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import { canvasToDataUrl, fileToCanvas, findCard, loadImage, makeCanvas } from '../scan/image'

/**
 * « Mes photos » : pour les cartes sans image officielle (souvent les toutes nouvelles),
 * on affiche la photo prise par l'utilisateur. Gardées sur le téléphone uniquement.
 */

const store = createStore('pokecard-photos', 'photos')
let photos = new Map<string, string>()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

entries<string, string>(store)
  .then((all) => {
    photos = new Map(all)
    notify()
  })
  .catch(() => {})

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Photo de l'utilisateur pour cette carte (ou undefined). */
export function useMyPhoto(cardId?: string): string | undefined {
  return useSyncExternalStore(subscribe, () => (cardId ? photos.get(cardId) : undefined))
}

export function hasMyPhoto(cardId: string): boolean {
  return photos.has(cardId)
}

async function put(cardId: string, dataUrl: string) {
  photos = new Map(photos).set(cardId, dataUrl)
  notify()
  await set(cardId, dataUrl, store).catch(() => {})
}

export async function removeMyPhoto(cardId: string) {
  photos = new Map(photos)
  photos.delete(cardId)
  notify()
  await del(cardId, store).catch(() => {})
}

/** Photo choisie par l'utilisateur : on recadre la carte comme au scan (sinon photo entière). */
export async function saveMyPhotoFromFile(cardId: string, file: File) {
  const canvas = await fileToCanvas(file)
  const card = findCard(canvas, 0.4, true)?.[0] ?? canvas
  await put(cardId, canvasToDataUrl(card, 400))
}

/** Photo recadrée venant du scan (déjà une image de la carte). */
export async function saveMyPhotoFromDataUrl(cardId: string, dataUrl: string) {
  const img = await loadImage(dataUrl)
  const c = makeCanvas(img.naturalWidth, img.naturalHeight)
  c.getContext('2d')!.drawImage(img, 0, 0)
  await put(cardId, canvasToDataUrl(c, 400))
}

/** Dernière carte scannée, pour l'enregistrer comme photo si on l'ajoute à la collection. */
let lastScan: { dataUrl: string; at: number } | null = null
export function rememberScanPhoto(dataUrl: string) {
  lastScan = { dataUrl, at: Date.now() }
}
export function recentScanPhoto(): string | undefined {
  return lastScan && Date.now() - lastScan.at < 15 * 60 * 1000 ? lastScan.dataUrl : undefined
}
