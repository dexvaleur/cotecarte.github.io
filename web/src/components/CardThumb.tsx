import { ImageOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { enImageBase } from '../api/enImage'
import { ptcgImageUrl } from '../api/ptcgImage'
import { useMyPhoto } from '../lib/myPhotos'
import { cardImage, getSets, setIdOf } from '../api/tcgdex'
import type { CardBrief } from '../api/types'

/**
 * Image de carte, avec plusieurs replis :
 * 1. image TCGdex ;
 * 2. si TCGdex n'en a pas en français (ou si elle ne charge pas) : image anglaise de TCGdex ;
 * 3. puis image pokemontcg.io (il faut `cardId`) ;
 * 4. puis la photo de l'utilisateur ; sinon : « Image indisponible ».
 */
export function CardImage({
  image,
  cardId,
  alt,
  quality = 'low',
  className = '',
  placeholderExtra,
  onSource,
}: {
  image?: string
  cardId?: string
  alt: string
  quality?: 'low' | 'high'
  className?: string
  /** Contenu ajouté sous « Image indisponible » (ex. bouton « Ajouter ma photo ») */
  placeholderExtra?: React.ReactNode
  /** Indique quelle image est affichée : officielle, photo perso, ou aucune */
  onSource?: (kind: 'official' | 'mine' | 'none') => void
}) {
  const myPhoto = useMyPhoto(cardId)
  const sources = [
    cardImage(image, quality),
    cardId ? cardImage(enImageBase(cardId, image), quality) : undefined,
    cardId ? ptcgImageUrl(cardId, quality) : undefined,
    myPhoto,
  ].filter(
    (u): u is string => !!u,
  )
  const [attempt, setAttempt] = useState(0)
  // Nouvelle carte affichée dans le même composant : on repart de la 1re source.
  useEffect(() => setAttempt(0), [image, cardId])
  const src = sources[attempt]
  const kind = !src ? 'none' : src === myPhoto ? 'mine' : 'official'
  useEffect(() => onSource?.(kind), [kind, onSource])
  if (!src) {
    return (
      <div className={`grid aspect-[63/88] place-items-center rounded-[5%] bg-surface-2 text-muted ${className}`}>
        <div className="text-center text-xs">
          <ImageOff className="mx-auto mb-1" size={22} />
          Image indisponible
          {placeholderExtra}
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
      onLoad={(e) => {
        // pokemontcg.io renvoie un dos de carte (640×892) quand il n'a pas l'image : on le traite comme une absence.
        const img = e.currentTarget
        if (isCardBack(img.naturalWidth, img.naturalHeight)) setAttempt((a) => a + 1)
      }}
      className={`aspect-[63/88] w-full rounded-[5%] bg-surface-2 object-cover ${className}`}
    />
  )
}

/** Dos de carte renvoyé par pokemontcg.io à la place d'une image manquante. */
export function isCardBack(width: number, height: number): boolean {
  return width === 640 && height === 892
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
