import { useState } from 'react'
import { API_URL } from './api'
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
  return !load('statsOff', false)
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
export function trackOpen() {
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
