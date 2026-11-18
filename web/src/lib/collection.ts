import { useSyncExternalStore } from 'react'
import type { ConditionCode } from '../data/cardInfo'
import { load, save } from './storage'

/**
 * Collection et wishlist, gardées sur le téléphone pour l'instant.
 * À l'étape 3, elles seront synchronisées avec le serveur (compte par email).
 */

export interface CollectionItem {
  uid: string // identifiant unique de l'exemplaire
  cardId: string
  name: string
  image?: string
  setName: string
  localId: string
  rarity?: string
  condition: ConditionCode
  quantity: number
  priceEur: number | null // prix de référence au moment de l'ajout
  addedAt: string
}

export interface WishItem {
  cardId: string
  name: string
  image?: string
  setName: string
  addedAt: string
}

interface State {
  collection: CollectionItem[]
  wishlist: WishItem[]
}

let state: State = {
  collection: load<CollectionItem[]>('collection', []),
  wishlist: load<WishItem[]>('wishlist', []),
}
const listeners = new Set<() => void>()

function update(next: Partial<State>) {
  state = { ...state, ...next }
  if (next.collection) save('collection', state.collection)
  if (next.wishlist) save('wishlist', state.wishlist)
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useCollectionState(): State {
  return useSyncExternalStore(subscribe, () => state)
}

export function addToCollection(item: Omit<CollectionItem, 'uid' | 'addedAt' | 'quantity'>) {
  // Même carte dans le même état : on augmente la quantité.
  const same = state.collection.find((c) => c.cardId === item.cardId && c.condition === item.condition)
  if (same) {
    update({
      collection: state.collection.map((c) => (c === same ? { ...c, quantity: c.quantity + 1 } : c)),
    })
    return
  }
  const uid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
  update({
    collection: [...state.collection, { ...item, uid, quantity: 1, addedAt: new Date().toISOString() }],
    // Une carte obtenue sort de la wishlist.
    wishlist: state.wishlist.filter((w) => w.cardId !== item.cardId),
  })
}

export function toggleWish(item: Omit<WishItem, 'addedAt'>) {
  const has = state.wishlist.some((w) => w.cardId === item.cardId)
  update({
    wishlist: has
      ? state.wishlist.filter((w) => w.cardId !== item.cardId)
      : [...state.wishlist, { ...item, addedAt: new Date().toISOString() }],
  })
}

export function ownedCount(cardId: string): number {
  return state.collection.filter((c) => c.cardId === cardId).reduce((n, c) => n + c.quantity, 0)
}
