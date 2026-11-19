import { useSyncExternalStore } from 'react'
import { api, getSession } from './api'
import { type Avatar, BOY, normalizeAvatar } from './avatar'
import { load, save } from './storage'

/**
 * Profil du dresseur : pseudo + avatar.
 * Gardé sur le téléphone, et sur le serveur quand on est connecté (la version la plus récente gagne).
 */

export interface Profile {
  pseudo: string
  avatar: Avatar
  updatedAt: string // date de la dernière modification ('' = jamais modifié)
  dirty?: boolean // modifié hors ligne, pas encore envoyé
}

function read(): Profile {
  const raw = load<Partial<Profile> | null>('profile', null)
  return {
    pseudo: typeof raw?.pseudo === 'string' ? raw.pseudo.slice(0, 24) : '',
    avatar: normalizeAvatar(raw?.avatar ?? BOY),
    updatedAt: raw?.updatedAt ?? '',
    dirty: raw?.dirty,
  }
}

let state = read()
const listeners = new Set<() => void>()

function set(next: Profile) {
  state = next
  save('profile', next)
  listeners.forEach((l) => l())
}

export function useProfile(): Profile {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function updateProfile(patch: Partial<Pick<Profile, 'pseudo' | 'avatar'>>) {
  set({ ...state, ...patch, updatedAt: new Date().toISOString(), dirty: true })
  void push()
}

async function push() {
  if (!getSession() || !state.dirty) return
  const sent = state
  try {
    await api('/profile', { method: 'PUT', body: { pseudo: sent.pseudo, avatar: sent.avatar, updatedAt: sent.updatedAt } })
    if (state === sent) set({ ...state, dirty: false })
  } catch {
    /* hors ligne : on réessaiera à la prochaine synchro */
  }
}

/** À l'ouverture de l'appli ou après connexion : récupère le profil du serveur s'il est plus récent. */
export async function syncProfile() {
  if (!getSession()) return
  try {
    const { profile } = await api<{ profile: { pseudo?: string; avatar?: unknown; updatedAt?: string } | null }>('/profile')
    if (profile?.updatedAt && profile.updatedAt > state.updatedAt) {
      set({ pseudo: (profile.pseudo ?? '').slice(0, 24), avatar: normalizeAvatar(profile.avatar), updatedAt: profile.updatedAt, dirty: false })
    } else if (state.updatedAt) {
      set({ ...state, dirty: true })
      await push()
    }
  } catch {
    /* serveur endormi ou hors ligne */
  }
}
