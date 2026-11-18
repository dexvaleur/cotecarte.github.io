import { useEffect, useState } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'pokecard.theme'

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Applique la classe "dark" sur <html> selon le choix et le réglage du téléphone. */
function apply(choice: ThemeChoice) {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = choice === 'dark' || (choice === 'system' && systemDark)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0e1020' : '#5b4cf5')
}

/** Hook React : renvoie le thème choisi et une fonction pour le changer. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice)

  useEffect(() => {
    apply(choice)
    try {
      localStorage.setItem(KEY, choice)
    } catch {
      /* ignore */
    }
    // En mode "système", on suit les changements du téléphone en direct.
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => choice === 'system' && apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [choice])

  return { choice, setChoice }
}
