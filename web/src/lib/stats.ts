import { useState } from 'react'
import { API_URL, fetchIsAdmin, getSession } from './api'
import { load, save } from './storage'

/**
 * Statistiques de visite anonymes, sans cookie.
 * On ne garde sur le téléphone que la date du dernier envoi (pour ne compter
 * chaque visiteur qu'une fois par jour). Rien ne permet d'identifier la personne :
 * pas de jeton de connexion, pas d'identifiant, juste des compteurs.
 * Désactivable dans Réglages.
 */

type Metric = 'open' | 'visitor' | 'new' | 'scan'

export function statsEnabled(): boolean {
  return !load('statsOff', false) && !load('statsAdmin', false)
}

/**
 * Les visites de l'administrateur ne comptent pas : dès qu'il se connecte sur un appareil,
 * cet appareil est marqué et n'envoie plus rien (même après déconnexion).
 */
async function isAdminDevice(): Promise<boolean> {
  if (load('statsAdmin', false)) return true
  if (!getSession()) return false
  try {
    if (await fetchIsAdmin()) {
      save('statsAdmin', true)
      return true
    }
  } catch {
    /* serveur endormi : on ne bloque pas */
  }
  return false
}

/** À appeler quand on apprend que l'utilisateur est l'administrateur. */
export function markAdminDevice() {
  save('statsAdmin', true)
}

function send(events: Metric[]) {
  if (!API_URL || !statsEnabled()) return
  fetch(`${API_URL}/stats/hit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ events }),
    keepalive: true,
  }).catch(() => {})
}

const today = () => new Date().toISOString().slice(0, 10)

/** À l'ouverture de l'appli. */
export async function trackOpen() {
  if (await isAdminDevice()) return
  const events: Metric[] = ['open']
  const last = load<string | null>('statsDay', null)
  if (last !== today()) {
    events.push('visitor')
    if (last === null) events.push('new')
    save('statsDay', today())
  }
  send(events)
}

/** Après chaque scan analysé. */
export function trackScan() {
  send(['scan'])
}

export function useStatsChoice() {
  const [enabled, setEnabled] = useState(statsEnabled)
  return {
    enabled,
    setEnabled(on: boolean) {
      save('statsOff', !on)
      setEnabled(on)
    },
  }
}
