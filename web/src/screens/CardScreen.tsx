import { ArrowLeft, Camera, Check, Heart, Plus, RefreshCw, Tag, TrendingDown, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/cache'
import { getCard, getSet, setIdOf } from '../api/tcgdex'
import type { Card, SetDetail } from '../api/types'
import { CardImage } from '../components/CardThumb'
import { OwnedCopies } from '../components/OwnedCopies'
import { logFailedScan } from '../lib/scanLog'
import { forgetScan, hasMyPhoto, recentScan, removeMyPhoto, saveMyPhotoFromDataUrl, saveMyPhotoFromFile } from '../lib/myPhotos'
import { type Answers, ConditionCheck, ConditionResult, gradeFromAnswers } from '../components/ConditionCheck'
import { PriceChart } from '../components/PriceChart'
import { Card as Box } from '../components/ui'
import { CONDITIONS, generationOf, rarityInfo, typeColor } from '../data/cardInfo'
import { addToCollection, toggleWish, useCollectionState } from '../lib/collection'
import { formatDate, formatEur, formatEurCompact, formatUsd, timeAgo } from '../lib/format'
import { cardmarketRows, change30d, chartPoints, type PriceRow, refPriceEur, tcgplayerRows } from '../lib/prices'
import { usePriceHistory } from '../lib/useCardPrices'

type Load =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'ok'; card: Card; set: SetDetail | null; stale: boolean; fetchedAt: number }

/** Fiche détaillée d'une carte. */
export function CardScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [load, setLoad] = useState<Load>({ status: 'loading' })

  const fetchAll = useCallback(async () => {
    setLoad({ status: 'loading' })
    try {
      const res = await getCard(id)
      const set = await getSet(setIdOf(id), res.data.lang).then((r) => r.data).catch(() => null)
      setLoad({ status: 'ok', card: res.data, set, stale: res.stale, fetchedAt: res.fetchedAt })
    } catch (e) {
      setLoad({ status: 'error', error: e instanceof ApiError ? e : new ApiError('unavailable') })
    }
  }, [id])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  return (
    <>
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 font-semibold text-muted">
        <ArrowLeft size={18} /> Retour
      </button>
      {load.status === 'loading' && <CardSkeleton />}
      {load.status === 'error' && (
        <Box className="text-center">
          <p className="text-4xl" aria-hidden>
            {load.error.kind === 'offline' ? '📡' : load.error.kind === 'notfound' ? '🔍' : '🛠️'}
          </p>
          <p className="mt-2 font-bold">
            {load.error.kind === 'offline'
              ? 'Pas de connexion'
              : load.error.kind === 'notfound'
                ? 'Carte introuvable'
                : 'Service indisponible'}
          </p>
          <p className="text-muted">{load.error.message}</p>
          {load.error.kind !== 'notfound' && (
            <button onClick={fetchAll} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-bold text-primary-ink">
              <RefreshCw size={18} /> Réessayer
            </button>
          )}
        </Box>
      )}
      {load.status === 'ok' && <CardDetail card={load.card} set={load.set} stale={load.stale} fetchedAt={load.fetchedAt} />}
    </>
  )
}

function CardDetail({ card, set, stale, fetchedAt }: { card: Card; set: SetDetail | null; stale: boolean; fetchedAt: number }) {
  const [answers, setAnswers] = useState<Answers>({})
  const [toast, setToast] = useState<string | null>(null)
  const [imageKind, setImageKind] = useState<'official' | 'mine' | 'none'>('official')
  const photoRef = useRef<HTMLInputElement>(null)
  const { collection, wishlist } = useCollectionState()
  const owned = collection.filter((c) => c.cardId === card.id).reduce((n, c) => n + c.quantity, 0)
  const wished = wishlist.some((w) => w.cardId === card.id)

  const rarity = rarityInfo(card.rarity)
  const ref = refPriceEur(card)
  const grade = gradeFromAnswers(answers)
  const gen = generationOf(card.dexId?.[0])
  const setInfo = set ?? card.set

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  function add() {
    addToCollection({
      cardId: card.id,
      name: card.name,
      image: card.image,
      setId: setInfo.id,
      setName: setInfo.name,
      localId: card.localId,
      rarity: card.rarity,
      types: card.types,
      condition: grade ?? 'NM',
      priceEur: ref,
    })
    setToast(`Ajoutée à ta collection (${CONDITIONS[grade ?? 'NM'].short})`)
    const scan = recentScan()
    if (scan) {
      // Carte sans image officielle, tout juste scannée : on garde la photo du scan.
      if (imageKind === 'none' && !hasMyPhoto(card.id)) saveMyPhotoFromDataUrl(card.id, scan.dataUrl).catch(() => {})
      // Le scanner n'a pas ouvert directement cette carte : on garde l'exemple pour l'améliorer.
      if (scan.openedId !== card.id) {
        logFailedScan({ cardId: card.id, cardName: card.name, openedId: scan.openedId, read: scan.read, dataUrl: scan.dataUrl }).catch(() => {})
      }
      forgetScan()
    }
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await saveMyPhotoFromFile(card.id, file)
      setToast('Photo enregistrée sur ton téléphone')
    } catch {
      setToast('Impossible de lire cette photo')
    }
  }

  return (
    <div className="space-y-4 pb-20">
      {stale && (
        <p role="status" className="rounded-2xl bg-warn/15 px-4 py-2 text-sm font-semibold text-warn">
          Données hors ligne, mises à jour {timeAgo(fetchedAt)}.
        </p>
      )}

      {/* En-tête : image + infos principales */}
      <div className="flex gap-4">
        <div className="w-[42%] shrink-0">
          <CardImage
            image={card.image}
            cardId={card.id}
            alt={card.name}
            quality="high"
            className="shadow-xl"
            onSource={setImageKind}
            placeholderExtra={
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="mx-auto mt-3 flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 font-bold text-primary-ink"
              >
                <Camera size={14} /> Ajouter ma photo
              </button>
            }
          />
          <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
          {imageKind === 'mine' && (
            <p className="mt-1.5 text-center text-xs text-muted">
              Ta photo ·{' '}
              <button type="button" className="font-semibold text-primary" onClick={() => photoRef.current?.click()}>
                Changer
              </button>{' '}
              ·{' '}
              <button type="button" className="font-semibold text-primary" onClick={() => removeMyPhoto(card.id)}>
                Retirer
              </button>
            </p>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl leading-tight font-extrabold tracking-tight">{card.name}</h1>
          <p className="text-sm text-muted">
            {card.category}
            {card.stage ? ` · ${card.stage}` : ''}
            {card.lang === 'en' && ' · fiche en anglais'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {card.types?.map((t) => <TypeChip key={t} type={t} />)}
            {card.hp && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold">{card.hp} PV</span>}
          </div>
          <div className="mt-3">
            <p className="text-xs font-semibold text-muted">Prix du marché</p>
            <p className="text-3xl font-extrabold">{formatEur(ref)}</p>
            <Change card={card} />
          </div>
          {owned > 0 && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-good/15 px-2.5 py-1 text-xs font-bold text-good">
              <Check size={14} /> Tu l’as ({owned})
            </p>
          )}
        </div>
      </div>

      <OwnedCopies items={collection.filter((c) => c.cardId === card.id)} />

      {/* Rareté */}
      <Box>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold">Rareté</h2>
          <span className="flex gap-1" aria-label={`Niveau de rareté ${rarity.level} sur 5`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={`h-2.5 w-5 rounded-full ${i <= rarity.level ? 'bg-accent' : 'bg-surface-2'}`} />
            ))}
          </span>
        </div>
        <p className="mt-1 text-lg font-extrabold text-primary">{rarity.label}</p>
        <p>{rarity.explain}</p>
      </Box>

      {/* Prix */}
      <Prices card={card} />

      {/* État */}
      <Box>
        <h2 className="font-bold">Dans quel état est ta carte ?</h2>
        <p className="mb-3 text-sm text-muted">
          Les prix ci-dessus sont pour une carte Near Mint (quasi parfaite). Réponds à 4 questions pour estimer l’état de la tienne.
        </p>
        <ConditionCheck answers={answers} onChange={setAnswers} />
        {grade && (
          <div className="mt-4">
            <ConditionResult code={grade} refPrice={ref} />
          </div>
        )}
      </Box>

      {/* Infos */}
      <Box>
        <h2 className="mb-2 font-bold">Infos de la carte</h2>
        {setInfo.logo && <img src={`${setInfo.logo}.webp`} alt="" className="mb-2 h-10 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <Info label="Extension" value={`${setInfo.name}${set?.serie ? ` (${set.serie.name})` : ''}`} />
          <Info label="Numéro" value={`${card.localId} / ${setInfo.cardCount.official}`} />
          <Info label="Sortie" value={formatDate(set?.releaseDate)} />
          {gen && <Info label="Génération" value={`${gen}ᵉ génération (Pokédex n° ${card.dexId?.[0]})`} />}
          {card.evolveFrom && <Info label="Évolue de" value={card.evolveFrom} />}
          {card.illustrator && <Info label="Illustrateur" value={card.illustrator} />}
          {card.regulationMark && <Info label="Marque" value={card.regulationMark} />}
        </dl>
      </Box>

      {/* Jeu */}
      {(card.attacks?.length || card.abilities?.length || card.effect) && (
        <Box>
          <h2 className="mb-2 font-bold">{card.category === 'Pokémon' ? 'Attaques et talents' : 'Effet'}</h2>
          {card.effect && <p className="text-sm">{card.effect}</p>}
          <ul className="space-y-3">
            {card.abilities?.map((a) => (
              <li key={a.name}>
                <p className="font-bold">
                  <span className="mr-1 rounded bg-bad px-1.5 py-0.5 text-[10px] text-white uppercase">{a.type ?? 'Talent'}</span>
                  {a.name}
                </p>
                {a.effect && <p className="text-sm text-muted">{a.effect}</p>}
              </li>
            ))}
            {card.attacks?.map((a) => (
              <li key={a.name}>
                <div className="flex items-center gap-2">
                  <span className="flex gap-0.5">
                    {a.cost?.map((c, i) => (
                      <span key={i} title={c} className="h-4 w-4 rounded-full ring-1 ring-black/10" style={{ background: typeColor(c) }} />
                    ))}
                  </span>
                  <span className="flex-1 font-bold">{a.name}</span>
                  {a.damage !== undefined && <span className="font-extrabold">{a.damage}</span>}
                </div>
                {a.effect && <p className="text-sm text-muted">{a.effect}</p>}
              </li>
            ))}
          </ul>
          {card.category === 'Pokémon' && (
            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center text-sm">
              <div>
                <dt className="text-xs text-muted">Faiblesse</dt>
                <dd className="font-bold">{card.weaknesses?.map((w) => `${w.type} ${w.value ?? ''}`).join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Résistance</dt>
                <dd className="font-bold">{card.resistances?.map((w) => `${w.type} ${w.value ?? ''}`).join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Retraite</dt>
                <dd className="font-bold">{card.retreat ?? '—'}</dd>
              </div>
            </dl>
          )}
        </Box>
      )}

      {/* Barre d'actions, collée au-dessus des onglets */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 mx-auto flex max-w-xl gap-2 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pt-4 pb-2">
        <button onClick={add} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-bold text-primary-ink shadow-lg active:scale-[.98]">
          <Plus size={20} /> Ajouter à ma collection
        </button>
        <button
          onClick={() => {
            toggleWish({ cardId: card.id, name: card.name, image: card.image, setName: setInfo.name })
            setToast(wished ? 'Retirée de ta wishlist' : 'Ajoutée à ta wishlist')
          }}
          aria-label={wished ? 'Retirer de la wishlist' : 'Ajouter à la wishlist'}
          aria-pressed={wished}
          className="grid w-14 place-items-center rounded-2xl border border-line bg-surface shadow-lg"
        >
          <Heart size={22} className={wished ? 'fill-bad text-bad' : 'text-muted'} />
        </button>
        <button disabled aria-label="Vendre cette carte (bientôt)" title="Bientôt : étape 6" className="grid w-14 place-items-center rounded-2xl border border-line bg-surface text-muted opacity-60 shadow-lg">
          <Tag size={22} />
        </button>
      </div>

      {toast && (
        <div role="status" className="fixed inset-x-0 top-20 z-30 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm font-bold text-bg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

function Change({ card }: { card: Card }) {
  const c = change30d(card)
  if (c === null || Math.abs(c) < 0.5) return <p className="text-xs text-muted">Stable sur 30 jours</p>
  const up = c > 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <p className={`flex items-center gap-1 text-sm font-bold ${up ? 'text-good' : 'text-bad'}`}>
      <Icon size={16} /> {up ? '+' : ''}
      {c.toFixed(0)} % sur 30 jours
    </p>
  )
}

function Prices({ card }: { card: Card }) {
  const cm = cardmarketRows(card)
  const tp = tcgplayerRows(card)
  const history = usePriceHistory(card.id)
  // Historique jour par jour (notre serveur) dès qu'on a au moins 5 jours, sinon les moyennes.
  const daily = history.length >= 5
  const pts = daily ? history : chartPoints(card)
  if (!cm.length && !tp.length) {
    return (
      <Box>
        <h2 className="font-bold">Prix</h2>
        <p className="text-muted">Aucun prix connu pour cette carte : elle se vend rarement, ou n’est pas listée sur Cardmarket ni TCGplayer.</p>
      </Box>
    )
  }
  return (
    <Box>
      <h2 className="font-bold">Prix</h2>
      {pts.length >= 2 && (
        <div className="mt-2">
          <p className="text-sm font-semibold text-muted">
            {daily ? `Prix jour par jour, ${history.length} derniers jours (Cardmarket)` : 'Évolution du prix moyen (Cardmarket)'}
          </p>
          <PriceChart points={pts} />
          <p className="text-xs text-muted">
            {daily
              ? 'Prix de tendance relevé chaque jour par Poké Card.'
              : 'Moyennes des ventes sur 30 jours, 7 jours et la veille. La courbe jour par jour se remplit au fil des jours.'}
          </p>
        </div>
      )}
      {cm.length > 0 && <PriceTable title="Cardmarket (Europe)" rows={cm} fmt={formatEurCompact} updated={card.pricing?.cardmarket?.updated} />}
      {tp.length > 0 && <PriceTable title="TCGplayer (États-Unis)" rows={tp} fmt={formatUsd} updated={card.pricing?.tcgplayer?.updated as string | undefined} />}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-semibold text-primary">Comment lire ces prix ?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li><b>Marché</b> : le prix auquel la carte se vend vraiment en ce moment. C’est le plus utile.</li>
          <li><b>Bas</b> : l’annonce la moins chère, souvent pour un état moyen.</li>
          <li><b>Moyen</b> : la moyenne de toutes les ventes.</li>
          <li><b>Haut</b> : l’annonce la plus chère (parfois exagérée).</li>
          <li>Les prix TCGplayer sont en dollars américains ($) et concernent surtout les cartes anglaises.</li>
        </ul>
      </details>
    </Box>
  )
}

function PriceTable({ title, rows, fmt, updated }: { title: string; rows: PriceRow[]; fmt: (v: number | null) => string; updated?: string }) {
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-bold">{title}</h3>
        {updated && <span className="text-xs text-muted">màj {formatDate(updated)}</span>}
      </div>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap tabular-nums">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="py-1 font-semibold">Version</th>
              <th className="py-1 text-right font-semibold">Marché</th>
              <th className="py-1 text-right font-semibold">Bas</th>
              <th className="py-1 text-right font-semibold">Moyen</th>
              <th className="py-1 text-right font-semibold">Haut</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <td className="py-1.5 font-semibold">{r.label}</td>
                <td className="py-1.5 text-right font-bold">{fmt(r.market)}</td>
                <td className="py-1.5 text-right">{fmt(r.low)}</td>
                <td className="py-1.5 text-right">{fmt(r.mid)}</td>
                <td className="py-1.5 text-right">{fmt(r.high)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TypeChip({ type }: { type: string }) {
  return (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: typeColor(type) }}>
      {type}
    </span>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </>
  )
}

function CardSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Chargement">
      <div className="flex gap-4">
        <div className="aspect-[63/88] w-[42%] rounded-[5%] bg-surface-2" />
        <div className="flex-1 space-y-2">
          <div className="h-7 w-3/4 rounded bg-surface-2" />
          <div className="h-4 w-1/2 rounded bg-surface-2" />
          <div className="h-10 w-1/2 rounded bg-surface-2" />
        </div>
      </div>
      <div className="h-32 rounded-3xl bg-surface-2" />
      <div className="h-48 rounded-3xl bg-surface-2" />
    </div>
  )
}
