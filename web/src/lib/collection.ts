import { useSyncExternalStore } from 'react'
import type { ConditionCode } from '../data/cardInfo'
import { api, API_URL, getSession } from './api'
import { load, save } from './storage'

/**
 * Collection et wishlist.
 *
 * Principe (« local d'abord ») :
 * 1. Chaque modification est appliquée tout de suite sur le téléphone → l'appli reste rapide
 *    et marche hors ligne.
 * 2. Elle est aussi mise dans une file d'attente (« outbox »), envoyée au serveur dès qu'on a
 *    du réseau et qu'on est connecté.
 * 3. À l'ouverture de l'appli, on récupère la version du serveur (source de vérité).
 */

export interface CollectionItem {
  uid: string // identifiant unique de l'exemplaire (créé sur le téléphone)
  cardId: string
  name: string
  image?: string
  setId: string
  setName: string
  localId: string
  rarity?: string
  types?: string[]
  condition: ConditionCode
  quantity: number
  priceEur: number | null // prix de référence au moment de l'ajout
  purchasePrice?: number | null // prix payé (utile pour la revente)
  addedAt: string
}

export interface WishItem {
  cardId: string
  name: string
  image?: string
  setName: string
  addedAt: string
}

/** Une case de classeur : la carte qu'on veut y ranger (possédée ou non). */
export interface BinderSlot {
  cardId: string
  name: string
  image?: string
  setName?: string
  localId?: string
}

/** Un classeur : des pages de 4, 9 ou 12 cases. null = case vide. */
export interface Binder {
  id: string
  name: string
  color: string
  perPage: 4 | 9 | 12
  slots: (BinderSlot | null)[]
  createdAt: string
  updatedAt: string
}

type Op =
  | { type: 'putBinder'; binder: Binder }
  | { type: 'deleteBinder'; id: string }
  | { type: 'putItem'; item: CollectionItem }
  | { type: 'deleteItem'; uid: string }
  | { type: 'putWish'; wish: WishItem }
  | { type: 'deleteWish'; cardId: string }

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'offline' | 'error'

interface State {
  collection: CollectionItem[]
  wishlist: WishItem[]
  binders: Binder[]
  outbox: Op[]
  sync: SyncStatus
  lastSync: string | null
  syncError: string | null
}

const setIdOf = (cardId: string) => cardId.slice(0, cardId.lastIndexOf('-'))

// Les anciennes versions n'enregistraient pas setId : on le complète.
const migrateItems = (items: CollectionItem[]) => items.map((i) => ({ ...i, setId: i.setId ?? setIdOf(i.cardId) }))

let state: State = {
  collection: migrateItems(load<CollectionItem[]>('collection', [])),
  wishlist: load<WishItem[]>('wishlist', []),
  binders: load<Binder[]>('binders', []),
  outbox: load<Op[]>('outbox', []),
  sync: 'local',
  lastSync: load<string | null>('lastSync', null),
  syncError: null,
}
const listeners = new Set<() => void>()

function update(next: Partial<State>) {
  state = { ...state, ...next }
  if (next.collection) save('collection', state.collection)
  if (next.wishlist) save('wishlist', state.wishlist)
  if (next.binders) save('binders', state.binders)
  if (next.outbox) save('outbox', state.outbox)
  if (next.lastSync !== undefined) save('lastSync', state.lastSync)
  listeners.forEach((l) => l())
}

export function useCollectionState(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

function enqueue(op: Op) {
  update({ outbox: [...state.outbox, op] })
  void flush()
}

const newUid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16))

// ---- Modifications ----------------------------------------------------------

// ---- Classeurs ----------------------------------------------------------------

export function createBinder(data: Pick<Binder, 'name' | 'color' | 'perPage' | 'slots'>): string {
  const now = new Date().toISOString()
  const binder: Binder = { ...data, id: newUid(), createdAt: now, updatedAt: now }
  update({ binders: [...state.binders, binder] })
  enqueue({ type: 'putBinder', binder })
  return binder.id
}

export function updateBinder(id: string, patch: Partial<Pick<Binder, 'name' | 'color' | 'perPage' | 'slots'>>) {
  const current = state.binders.find((b) => b.id === id)
  if (!current) return
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
  update({ binders: state.binders.map((b) => (b.id === id ? next : b)) })
  // Plusieurs modifications d'affilée : seule la dernière version a besoin de partir au serveur.
  // (On ne touche pas à la première opération de la file : elle est peut-être en cours d'envoi.)
  const [first, ...rest] = state.outbox
  if (first) update({ outbox: [first, ...rest.filter((o) => !(o.type === 'putBinder' && o.binder.id === id))] })
  enqueue({ type: 'putBinder', binder: next })
}

export function deleteBinder(id: string) {
  update({ binders: state.binders.filter((b) => b.id !== id) })
  enqueue({ type: 'deleteBinder', id })
}

/** Ajoute des cartes dans les premières cases vides, puis à la suite. */
export function addToBinder(id: string, cards: BinderSlot[]) {
  const b = state.binders.find((x) => x.id === id)
  if (!b || !cards.length) return
  const slots = [...b.slots]
  for (const c of cards) {
    const free = slots.indexOf(null)
    if (free === -1) slots.push(c)
    else slots[free] = c
  }
  // Toujours des pages complètes.
  while (slots.length % b.perPage) slots.push(null)
  updateBinder(id, { slots })
}

export function addToCollection(item: Omit<CollectionItem, 'uid' | 'addedAt' | 'quantity'>) {
  // Même carte dans le même état : on augmente la quantité.
  const same = state.collection.find((c) => c.cardId === item.cardId && c.condition === item.condition)
  if (same) return updateItem(same.uid, { quantity: same.quantity + 1 })
  const full: CollectionItem = { ...item, uid: newUid(), quantity: 1, addedAt: new Date().toISOString() }
  update({ collection: [...state.collection, full] })
  enqueue({ type: 'putItem', item: full })
  // Une carte obtenue sort de la wishlist.
  if (state.wishlist.some((w) => w.cardId === item.cardId)) removeWish(item.cardId)
}

export function updateItem(uid: string, patch: Partial<Pick<CollectionItem, 'quantity' | 'condition' | 'purchasePrice' | 'priceEur' | 'rarity' | 'types'>>) {
  const current = state.collection.find((c) => c.uid === uid)
  if (!current) return
  if (patch.quantity !== undefined && patch.quantity < 1) return removeItem(uid)
  const next = { ...current, ...patch }
  update({ collection: state.collection.map((c) => (c.uid === uid ? next : c)) })
  enqueue({ type: 'putItem', item: next })
}

export function removeItem(uid: string) {
  update({ collection: state.collection.filter((c) => c.uid !== uid) })
  enqueue({ type: 'deleteItem', uid })
}

/**
 * Garder un seul exemplaire d'une carte : on garde celui en meilleur état
 * (factor le plus haut) avec quantité 1, et on retire les autres.
 */
export function keepOnlyOne(cardId: string, factorOf: (c: CollectionItem) => number) {
  const copies = state.collection.filter((c) => c.cardId === cardId)
  if (!copies.length) return
  const best = copies.reduce((a, b) => (factorOf(b) > factorOf(a) ? b : a))
  for (const c of copies) if (c.uid !== best.uid) removeItem(c.uid)
  if (best.quantity !== 1) updateItem(best.uid, { quantity: 1 })
}

/** Retirer tous les exemplaires d'une carte. */
export function removeCard(cardId: string) {
  for (const c of state.collection.filter((i) => i.cardId === cardId)) removeItem(c.uid)
}

export function toggleWish(item: Omit<WishItem, 'addedAt'>) {
  if (state.wishlist.some((w) => w.cardId === item.cardId)) return removeWish(item.cardId)
  const wish = { ...item, addedAt: new Date().toISOString() }
  update({ wishlist: [...state.wishlist, wish] })
  enqueue({ type: 'putWish', wish })
}

export function removeWish(cardId: string) {
  update({ wishlist: state.wishlist.filter((w) => w.cardId !== cardId) })
  enqueue({ type: 'deleteWish', cardId })
}

export function ownedCount(cardId: string): number {
  return state.collection.filter((c) => c.cardId === cardId).reduce((n, c) => n + c.quantity, 0)
}

// ---- Synchronisation avec le serveur ---------------------------------------

const canSync = () => !!API_URL && !!getSession()

function toServerItem(i: CollectionItem) {
  return {
    cardId: i.cardId,
    name: i.name,
    image: i.image ?? null,
    setId: i.setId,
    setName: i.setName,
    localId: i.localId,
    rarity: i.rarity ?? null,
    types: i.types ?? [],
    condition: i.condition,
    quantity: i.quantity,
    priceEur: i.priceEur,
    purchasePrice: i.purchasePrice ?? null,
    addedAt: i.addedAt,
  }
}

let flushing: Promise<void> | null = null

/** Envoie la file d'attente au serveur, dans l'ordre. */
export function flush(): Promise<void> {
  if (!canSync()) return Promise.resolve()
  if (!navigator.onLine) {
    update({ sync: 'offline' })
    return Promise.resolve()
  }
  if (flushing) return flushing
  // Attention : on enregistre la promesse AVANT qu'elle se termine, puis on la libère
  // dans .finally(). (Si la file est vide, la fonction se termine immédiatement :
  // libérer la place à l'intérieur laisserait « flushing » bloqué pour toujours.)
  flushing = sendOutbox().finally(() => {
    flushing = null
    // Une modification arrivée pendant l'envoi : on relance.
    if (state.outbox.length && state.sync === 'synced') void flush()
  })
  return flushing
}

async function sendOutbox() {
  update({ sync: 'syncing', syncError: null })
  try {
    while (state.outbox.length) {
      const op = state.outbox[0]
      try {
        await send(op)
      } catch (err) {
        const status = (err as { status?: number }).status ?? 0
        // Erreur réseau ou serveur : on garde l'opération et on réessaiera plus tard.
        if (status === 0 || status >= 500 || status === 401) throw err
        // Requête refusée (données invalides…) : on l'abandonne pour ne pas bloquer la file.
      }
      update({ outbox: state.outbox.slice(1) })
    }
    update({ sync: 'synced', lastSync: new Date().toISOString() })
  } catch (err) {
    update({ sync: navigator.onLine ? 'error' : 'offline', syncError: (err as Error).message })
  }
}

const toServerBinder = (b: Binder) => ({
  name: b.name,
  color: b.color,
  perPage: b.perPage,
  slots: b.slots.map((s) => (s ? { cardId: s.cardId, name: s.name, image: s.image ?? null, setName: s.setName ?? null, localId: s.localId ?? null } : null)),
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
})

const fromServerBinder = (b: Binder): Binder => ({
  ...b,
  slots: b.slots.map((s) =>
    s ? { cardId: s.cardId, name: s.name, image: s.image ?? undefined, setName: s.setName ?? undefined, localId: s.localId ?? undefined } : null,
  ),
})

function send(op: Op): Promise<unknown> {
  switch (op.type) {
    case 'putBinder':
      return api(`/binders/${op.binder.id}`, { method: 'PUT', body: toServerBinder(op.binder) })
    case 'deleteBinder':
      return api(`/binders/${op.id}`, { method: 'DELETE' })
    case 'putItem':
      return api(`/collection/items/${op.item.uid}`, { method: 'PUT', body: toServerItem(op.item) })
    case 'deleteItem':
      return api(`/collection/items/${op.uid}`, { method: 'DELETE' })
    case 'putWish':
      return api(`/wishlist/${encodeURIComponent(op.wish.cardId)}`, {
        method: 'PUT',
        body: { name: op.wish.name, image: op.wish.image ?? null, setName: op.wish.setName, addedAt: op.wish.addedAt },
      })
    case 'deleteWish':
      return api(`/wishlist/${encodeURIComponent(op.cardId)}`, { method: 'DELETE' })
  }
}

/** Envoie les modifications en attente, puis récupère la version du serveur. */
export async function syncNow(): Promise<void> {
  if (!canSync()) return
  await flush()
  if (state.outbox.length) return // pas réussi à tout envoyer : on garde la version locale
  try {
    const data = await api<{ items: CollectionItem[]; wishlist: WishItem[]; binders?: Binder[] }>('/collection')
    update({
      collection: migrateItems(data.items),
      wishlist: data.wishlist,
      // Ancien serveur (sans classeurs) : on garde ceux du téléphone.
      binders: data.binders ? data.binders.map(fromServerBinder).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : state.binders,
      sync: 'synced',
      lastSync: new Date().toISOString(),
    })
  } catch (err) {
    update({ sync: navigator.onLine ? 'error' : 'offline', syncError: (err as Error).message })
  }
}

/** Juste après la connexion : on envoie au compte les cartes déjà sur le téléphone. */
export async function importLocalThenSync(): Promise<void> {
  if (!canSync()) return
  update({ sync: 'syncing' })
  try {
    if (state.collection.length || state.wishlist.length || state.binders.length) {
      await api('/collection/import', {
        method: 'POST',
        body: {
          items: state.collection.map((i) => ({ uid: i.uid, ...toServerItem(i) })),
          wishlist: state.wishlist.map((w) => ({ cardId: w.cardId, name: w.name, image: w.image ?? null, setName: w.setName, addedAt: w.addedAt })),
          binders: state.binders.map((b) => ({ id: b.id, ...toServerBinder(b) })),
        },
      })
    }
    update({ outbox: [] })
    await syncNow()
  } catch (err) {
    update({ sync: 'error', syncError: (err as Error).message })
  }
}

/** À la déconnexion, la collection est retirée du téléphone (elle reste sur le compte). */
export function clearLocal() {
  update({ collection: [], wishlist: [], binders: [], outbox: [], sync: 'local', lastSync: null, syncError: null })
}

// Synchronisation automatique : au démarrage et au retour du réseau.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void syncNow())
  setTimeout(() => void syncNow(), 500)
}
