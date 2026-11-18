import { ArrowLeft, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/cache'
import { getSet } from '../api/tcgdex'
import type { SetDetail } from '../api/types'
import { CardImage } from '../components/CardThumb'
import { useCollectionState } from '../lib/collection'
import { formatDate } from '../lib/format'

/**
 * Détail d'une extension : toutes ses cartes, celles qu'on a (en couleur)
 * et celles qui manquent (en gris), avec la progression en %.
 */
export function SetScreen() {
  const { setId = '' } = useParams()
  const navigate = useNavigate()
  const { collection } = useCollectionState()
  const [set, setSet] = useState<SetDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [onlyMissing, setOnlyMissing] = useState(false)

  useEffect(() => {
    getSet(setId)
      .then((r) => setSet(r.data))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Extension introuvable.'))
  }, [setId])

  const owned = new Set(collection.filter((c) => c.setId === setId).map((c) => c.localId.replace(/^0+/, '')))
  const isOwned = (localId: string) => owned.has(localId.replace(/^0+/, ''))

  return (
    <>
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 font-semibold text-muted">
        <ArrowLeft size={18} /> Retour
      </button>
      {error && <p className="rounded-2xl bg-bad/10 p-4 text-center font-semibold text-bad">{error}</p>}
      {!set && !error && <p className="text-center text-muted">Chargement…</p>}
      {set && (
        <>
          {set.logo && <img src={`${set.logo}.webp`} alt="" className="mb-2 h-14 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />}
          <h1 className="text-2xl font-extrabold tracking-tight">{set.name}</h1>
          <p className="text-sm text-muted">
            {set.serie?.name} · sortie le {formatDate(set.releaseDate)}
          </p>
          <Progress set={set} ownedCount={set.cards.filter((c) => isOwned(c.localId)).length} />

          <label className="mt-4 mb-2 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]" />
            Afficher seulement les cartes manquantes
          </label>
          <div className="grid grid-cols-4 gap-2">
            {set.cards
              .filter((c) => !onlyMissing || !isOwned(c.localId))
              .map((c) => {
                const have = isOwned(c.localId)
                const secret = /^\d+$/.test(c.localId) && parseInt(c.localId, 10) > set.cardCount.official
                return (
                  <Link key={c.id} to={`/carte/${encodeURIComponent(c.id)}`} className="relative block">
                    <div className={have ? '' : 'opacity-35 grayscale'}>
                      <CardImage image={c.image} alt={c.name} />
                    </div>
                    {have && (
                      <span className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-good text-white" aria-label="Possédée">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                    <p className="mt-0.5 truncate text-[11px] font-semibold">
                      {c.localId} {secret && '★'}
                    </p>
                  </Link>
                )
              })}
          </div>
        </>
      )}
    </>
  )
}

function Progress({ set, ownedCount }: { set: SetDetail; ownedCount: number }) {
  const official = set.cardCount.official
  const pct = official ? Math.min(100, Math.round((ownedCount / official) * 100)) : 0
  const missing = Math.max(0, official - ownedCount)
  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-bold">
          {ownedCount} / {official} cartes
        </p>
        <p className="text-2xl font-extrabold text-primary">{pct} %</p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {missing ? `Il te manque ${missing} carte${missing > 1 ? 's' : ''} pour compléter l’extension.` : 'Extension complète, bravo ! 🎉'}
        {set.cardCount.total > official && ` Plus ${set.cardCount.total - official} cartes secrètes (★) en bonus.`}
      </p>
    </div>
  )
}
