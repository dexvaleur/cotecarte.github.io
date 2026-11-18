import { ComingSoon } from '../components/ui'

export function SellScreen() {
  return (
    <ComingSoon
      emoji="💰"
      title="Vendre"
      step={6}
      text="Revends tes cartes au bon prix, avec une annonce prête à publier."
      features={[
        'Prix de vente conseillé selon l’état et le marché',
        'Annonce générée pour Cardmarket, Vinted, eBay ou Leboncoin',
        'Suivi de tes ventes et de ton bénéfice',
        'Conseils : emballage, frais, erreurs à éviter',
      ]}
    />
  )
}
