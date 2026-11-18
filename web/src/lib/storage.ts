// Petit utilitaire pour lire/écrire dans le stockage du navigateur.
// Le try/catch évite un plantage en navigation privée ou si le stockage est bloqué.

const PREFIX = 'pokecard.'

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* stockage indisponible : on ignore */
  }
}
