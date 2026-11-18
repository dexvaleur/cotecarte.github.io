import { ComingSoon } from '../components/ui'

export function PacksScreen() {
  return (
    <ComingSoon
      emoji="🎁"
      title="Conseils packs"
      step={4}
      text="Quel booster, display ou ETB acheter selon ton budget et ton objectif."
      features={[
        'Recommandations adaptées à ton budget et ton objectif',
        'Chances de tirer une carte rare dans chaque produit',
        'Valeur moyenne attendue d’un booster',
        'Avis clair : bon plan, à éviter ou attendre',
      ]}
    />
  )
}
