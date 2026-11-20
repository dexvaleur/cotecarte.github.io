import { useEffect, useSyncExternalStore } from 'react'
import { api, API_URL, getSession, useSession } from './api'
import { makeCanvas } from '../scan/image'

/**
 * Onglet Vendre : annonces entre membres et messagerie (voir api/src/routes/market.ts).
 */

export type Kind = 'vente' | 'echange' | 'les2'
export type Status = 'active' | 'reservee' | 'vendue'

export const KIND_LABEL: Record<Kind, string> = { vente: 'Vente', echange: 'Échange', les2: 'Vente ou échange' }
export const STATUS_LABEL: Record<Status, string> = { active: 'En ligne', reservee: 'Réservée', vendue: 'Vendue' }

export interface Seller {
  id: string
  pseudo: string
  avatar: unknown
}

export interface Listing {
  id: string
  title: string
  description?: string
  cardId?: string | null
  hashtags: string[]
  kind: Kind
  priceEur: number | null
  condition: string | null
  status: Status
  photoCount: number
  version: number
  createdAt: string
  mine: boolean
  seller: Seller
  conversationId?: string | null
}

export interface ListingInput {
  title: string
  description: string
  hashtags: string[]
  kind: Kind
  priceEur: number | null
  condition: string | null
  cardId: string | null
  photos?: string[]
}

export interface ChatSummary {
  id: string
  role: 'acheteur' | 'vendeur'
  listing: Pick<Listing, 'id' | 'title' | 'priceEur' | 'kind' | 'status' | 'photoCount' | 'version'>
  other: Seller
  lastMessage: string | null
  lastFromMe: boolean
  lastAt: string
  unread: number
}

export interface Message {
  id: number
  mine: boolean
  body: string
  at: string
}

export function photoUrl(l: { id: string; version: number }, pos = 0): string {
  return `${API_URL}/listings/${l.id}/photos/${pos}?v=${l.version}`
}

/** « #dracaufeu » : même nettoyage que le serveur. */
export function cleanTag(t: string): string {
  return t
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, 24)
}

export function priceLabel(l: Pick<Listing, 'kind' | 'priceEur'>): string {
  if (l.kind === 'echange') return 'Échange'
  if (l.priceEur === null) return 'Prix à discuter'
  return l.priceEur.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: l.priceEur % 1 ? 2 : 0 })
}

// ---- Appels au serveur ------------------------------------------------------

export function fetchListings(p: { q?: string; tag?: string; mine?: boolean; seller?: string; before?: string } = {}) {
  const qs = new URLSearchParams()
  if (p.q) qs.set('q', p.q)
  if (p.tag) qs.set('tag', p.tag)
  if (p.mine) qs.set('mine', '1')
  if (p.seller) qs.set('seller', p.seller)
  if (p.before) qs.set('before', p.before)
  return api<{ listings: Listing[]; next: string | null }>(`/listings?${qs}`)
}

export const fetchListing = (id: string) => api<{ listing: Listing; canModerate: boolean }>(`/listings/${id}`)
export const createListing = (body: ListingInput) => api<{ id: string }>('/listings', { method: 'POST', body })
export const editListing = (id: string, body: ListingInput) => api(`/listings/${id}`, { method: 'PUT', body })
export const setListingStatus = (id: string, status: Status) => api(`/listings/${id}/status`, { method: 'PUT', body: { status } })
export const deleteListing = (id: string) => api(`/listings/${id}`, { method: 'DELETE' })
export const reportListing = (id: string, reason: string) => api(`/listings/${id}/report`, { method: 'POST', body: { reason } })
export const openChat = (listingId: string) => api<{ id: string }>(`/listings/${listingId}/chat`, { method: 'POST' })
export const fetchChats = () => api<{ chats: ChatSummary[] }>('/chats')
export const fetchChat = (id: string, after = 0) =>
  api<{ chat: ChatSummary; blocked: 'moi' | 'lui' | null; messages: Message[] }>(`/chats/${id}?after=${after}`)
export const sendMessage = (id: string, body: string) => api<{ message: Message }>(`/chats/${id}/messages`, { method: 'POST', body: { body } })
export const blockUser = (id: string) => api(`/users/${id}/block`, { method: 'POST' })
export const unblockUser = (id: string) => api(`/users/${id}/block`, { method: 'DELETE' })

// ---- Messages non lus (pastille sur l'onglet Vendre) -------------------------

let unread = 0
const listeners = new Set<() => void>()
export function setUnread(n: number) {
  if (n === unread) return
  unread = n
  listeners.forEach((l) => l())
}

export async function refreshUnread() {
  if (!getSession() || !API_URL) return setUnread(0)
  try {
    setUnread((await api<{ count: number }>('/chats/unread')).count)
  } catch {
    /* serveur endormi : on réessaiera */
  }
}

/** Nombre de messages non lus, vérifié toutes les minutes tant que l'appli est ouverte. */
export function useUnread(): number {
  const session = useSession()
  useEffect(() => {
    if (!session) return setUnread(0)
    void refreshUnread()
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshUnread()
    }, 60_000)
    const onShow = () => document.visibilityState === 'visible' && void refreshUnread()
    document.addEventListener('visibilitychange', onShow)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [session])
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => unread,
  )
}

// ---- Photos -----------------------------------------------------------------

/**
 * Réduit une photo avant l'envoi (1280 px max, JPEG) pour qu'elle reste légère :
 * envoi rapide même en 4G, et peu de place sur le serveur.
 */
export async function compressPhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  let max = 1280
  let quality = 0.82
  try {
    for (;;) {
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
      const c = makeCanvas(bmp.width * scale, bmp.height * scale)
      c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
      const url = c.toDataURL('image/jpeg', quality)
      // ~400 Ko maximum une fois décodé (la limite du serveur est 450 Ko).
      if (url.length * 0.75 < 400_000 || max < 500) return url
      max = Math.round(max * 0.8)
      quality = Math.max(0.6, quality - 0.08)
    }
  } finally {
    bmp.close()
  }
}
