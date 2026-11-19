import { useSyncExternalStore } from 'react'
import { load, save } from './storage'

/**
 * Lien avec notre serveur (dossier api/).
 * VITE_API_URL est défini au moment de la compilation (fichier .env). S'il est vide,
 * l'appli fonctionne seule : cartes et prix directement depuis TCGdex, collection sur le téléphone.
 */
export const API_URL: string | undefined = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || undefined

export interface Session {
  token: string
  user: { id: string; email: string }
}

let session: Session | null = load<Session | null>('session', null)
const listeners = new Set<() => void>()

export function getSession(): Session | null {
  return session
}

export function setSession(s: Session | null) {
  session = s
  save('session', s)
  listeners.forEach((l) => l())
}

export function useSession(): Session | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => session,
  )
}

export class ApiRequestError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Appel à notre serveur, avec le jeton de session si on est connecté. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!API_URL) throw new ApiRequestError(0, 'Serveur non configuré.')
  let res: Response
  try {
    res = await fetch(API_URL + path, {
      method: init.method ?? 'GET',
      headers: {
        ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(session ? { authorization: `Bearer ${session.token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      // Le serveur gratuit peut mettre ~1 min à se réveiller : au-delà de 90 s, on abandonne.
      signal: AbortSignal.timeout(90_000),
    })
  } catch (e) {
    if ((e as Error)?.name === 'TimeoutError') throw new ApiRequestError(0, 'Le serveur met trop de temps à répondre. Réessaie dans une minute.')
    throw new ApiRequestError(0, navigator.onLine ? 'Le serveur ne répond pas.' : 'Pas de connexion internet.')
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    // Jeton expiré ou compte supprimé : on se déconnecte proprement.
    if (res.status === 401 && session) setSession(null)
    throw new ApiRequestError(res.status, data.error ?? 'Erreur du serveur.')
  }
  return data
}

// ---- Connexion par code ----------------------------------------------------

export async function requestCode(email: string, consent: boolean): Promise<{ devCode?: string }> {
  return api('/auth/request', { method: 'POST', body: { email, consent } })
}

export async function verifyCode(email: string, code: string): Promise<Session> {
  const s = await api<Session>('/auth/verify', { method: 'POST', body: { email, code } })
  setSession(s)
  return s
}

export async function logout() {
  try {
    await api('/auth/logout', { method: 'POST' })
  } finally {
    setSession(null)
  }
}

export async function deleteAccount() {
  await api('/me', { method: 'DELETE' })
  setSession(null)
}
