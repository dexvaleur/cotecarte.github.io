import { ComingSoon } from '../components/ui'

export function CollectionScreen() {
  return (
    <ComingSoon
      emoji="🗂️"
      title="Ma collection"
      step={3}
      text="Toutes tes cartes au même endroit, avec leur valeur qui se met à jour chaque jour."
      features={[
        'Voir tes cartes en liste ou en grille, avec filtres et recherche',
        'Valeur totale de ta collection et son évolution',
        'Tes cartes les plus chères',
        'Progression de chaque extension et cartes manquantes',
        'Une wishlist des cartes que tu veux',
      ]}
    />
  )
}
