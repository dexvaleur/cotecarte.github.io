import { ComingSoon } from '../components/ui'

export function NewsScreen() {
  return (
    <ComingSoon
      emoji="📰"
      title="Actualités"
      step={5}
      text="Les nouveautés du monde des cartes Pokémon, résumées en 2-3 lignes."
      features={[
        'Nouvelles extensions, dates de sortie et spoilers',
        'Hausses et baisses de prix notables',
        'Événements et annonces officielles',
        'Notifications : nouvelle extension, alerte de prix',
      ]}
    />
  )
}
