import { Link } from 'react-router'
import { CardImage } from '../components/CardThumb'
import { Badge, Card, ComingSoon, ScreenTitle } from '../components/ui'
import { CONDITIONS } from '../data/cardInfo'
import { useCollectionState } from '../lib/collection'
import { formatEur } from '../lib/format'

/**
 * Version simple de la collection (étape 2) : liste des cartes ajoutées.
 * Filtres, valeur dans le temps, extensions et compte arrivent à l'étape 3.
 */
export function CollectionScreen() {
  const { collection, wishlist } = useCollectionState()

  if (collection.length === 0 && wishlist.length === 0) {
    return (
      <ComingSoon
        emoji="🗂️"
        title="Ma collection"
        step={3}
        text="Scanne une carte puis touche « Ajouter à ma collection » : elle apparaîtra ici."
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

  const count = collection.reduce((n, c) => n + c.quantity, 0)
  const total = collection.reduce((s, c) => s + (c.priceEur ?? 0) * CONDITIONS[c.condition].factor * c.quantity, 0)

  return (
    <>
      <ScreenTitle title="Ma collection" />
      <Card className="mb-4 bg-gradient-to-br from-primary to-[#b24cf5] text-white">
        <p className="text-sm font-semibold opacity-90">Valeur estimée</p>
        <p className="text-3xl font-extrabold">{formatEur(total)}</p>
        <p className="text-sm opacity-90">
          {count} carte{count > 1 ? 's' : ''} · prix au moment de l’ajout, selon l’état
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {collection.map((c) => (
          <Link key={c.uid} to={`/carte/${encodeURIComponent(c.cardId)}`} className="relative block">
            <CardImage image={c.image} alt={c.name} />
            {c.quantity > 1 && (
              <span className="absolute top-1 right-1 rounded-full bg-ink px-2 text-xs font-bold text-bg">×{c.quantity}</span>
            )}
            <p className="mt-1 truncate text-xs font-bold">{c.name}</p>
            <p className="text-[11px] text-muted">{CONDITIONS[c.condition].short} · {formatEur(c.priceEur)}</p>
          </Link>
        ))}
      </div>

      {wishlist.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 font-bold">Wishlist ❤️</h2>
          <div className="grid grid-cols-4 gap-2">
            {wishlist.map((w) => (
              <Link key={w.cardId} to={`/carte/${encodeURIComponent(w.cardId)}`}>
                <CardImage image={w.image} alt={w.name} />
              </Link>
            ))}
          </div>
        </>
      )}

      <Card className="mt-6">
        <Badge tone="accent">Étape 3</Badge>
        <p className="mt-2 text-sm text-muted">
          Bientôt : filtres, recherche, évolution de la valeur, progression par extension et sauvegarde dans ton compte.
          Pour l’instant, ta collection est gardée sur ce téléphone.
        </p>
      </Card>
    </>
  )
}
