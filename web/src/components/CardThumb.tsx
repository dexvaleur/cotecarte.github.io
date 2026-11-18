import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ptcgImageUrl } from '../api/ptcgImage'
import { cardImage, getSets, setIdOf } from '../api/tcgdex'
import type { CardBrief } from '../api/types'

/**
 * Image de carte, avec deux replis :
 * 1. image TCGdex ;
 * 2. si TCGdex n'en a pas (ou si elle ne charge pas) : image pokemontcg.io (il faut `cardId`) ;
 * 3. sinon : « Image indisponible ».
 */
export function CardImage({
  image,
  cardId,
  alt,
  quality = 'low',
  className = '',
}: {
  image?: string
  cardId?: string
  alt: string
  quality?: 'low' | 'high'
  className?: string
}) {
  const sources = [cardImage(image, quality), cardId ? ptcgImageUrl(cardId, quality) : undefined].filter(
    (u): u is string => !!u,
  )
  const [attempt, setAttempt] = useState(0)
  // Nouvelle carte affichée dans le même composant : on repart de la 1re source.
  useEffect(() => setAttempt(0), [image, cardId])
  const src = sources[attempt]
  if (!src) {
    return (
      <div className={`grid aspect-[63/88] place-items-center rounded-[5%] bg-surface-2 text-muted ${className}`}>
        <div className="text-center text-xs">
          <ImageOff className="mx-auto mb-1" size={22} />
          Image indisponible
        </div>
      </div>
    )
  }
  return (
    <img
      key={src}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setAttempt((a) => a + 1)}
      className={`aspect-[63/88] w-full rounded-[5%] bg-surface-2 object-cover ${className}`}
    />
  )
}

/** Noms des extensions (« sv03.5 » → « 151 »), chargés une fois. */
let setNamesCache: Map<string, string> | null = null
export function useSetNames(): Map<string, string> {
  const [names, setNames] = useState<Map<string, string>>(setNamesCache ?? new Map())
  useEffect(() => {
    if (setNamesCache) return
    getSets('fr')
      .then((sets) => {
        setNamesCache = new Map(sets.map((s) => [s.id, s.name]))
        setNames(setNamesCache)
      })
      .catch(() => {})
  }, [])
  return names
}

/** Vignette cliquable d'une carte (résultats de recherche). */
export function CardThumb({ card, setName, extra }: { card: CardBrief; setName?: string; extra?: React.ReactNode }) {
  return (
    <Link to={`/carte/${encodeURIComponent(card.id)}`} className="block rounded-2xl p-1 active:scale-[.98]">
      <CardImage image={card.image} cardId={card.id} alt={card.name} />
      <p className="mt-1.5 truncate text-sm font-bold">{card.name}</p>
      <p className="truncate text-xs text-muted">
        {setName ?? setIdOf(card.id)} · n° {card.localId}
      </p>
      {extra}
    </Link>
  )
}
