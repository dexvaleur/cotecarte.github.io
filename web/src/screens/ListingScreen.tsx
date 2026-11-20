import { ArrowLeft, Flag, MessageCircle, Pencil, ShieldCheck, Trash2, TrendingUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ListingPhoto, LoginGate, MemberAvatar, PseudoGate, Spinner } from '../components/market'
import { Card } from '../components/ui'
import { CONDITIONS, type ConditionCode } from '../data/cardInfo'
import { useSession } from '../lib/api'
import { formatEur, timeAgo } from '../lib/format'
import {
  deleteListing,
  fetchListing,
  KIND_LABEL,
  openChat,
  priceLabel,
  reportListing,
  setListingStatus,
  STATUS_LABEL,
  type Listing,
  type Status,
} from '../lib/market'
import { useProfile } from '../lib/profile'
import { useCardPrices } from '../lib/useCardPrices'

/** Fiche d'une annonce : photos, prix, description, hashtags, vendeur et bouton « Discuter ». */
export function ListingScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const session = useSession()
  const profile = useProfile()
  const [listing, setListing] = useState<Listing | null>(null)
  const [canModerate, setCanModerate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [gate, setGate] = useState<'login' | 'pseudo' | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetchListing(id)
      .then((d) => {
        setListing(d.listing)
        setCanModerate(d.canModerate)
      })
      .catch((e: Error) => setError(e.message))
  }, [id, session])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  if (error) return <Card>{error}</Card>
  if (!listing) return <Spinner />

  const contact = async () => {
    if (!session) return setGate('login')
    if (!profile.pseudo.trim()) return setGate('pseudo')
    if (listing.conversationId) return navigate(`/vendre/chat/${listing.conversationId}`)
    setBusy(true)
    try {
      const { id: chatId } = await openChat(listing.id)
      navigate(`/vendre/chat/${chatId}`)
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('pseudo')) setGate('pseudo')
      else setToast(msg)
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = async (status: Status) => {
    try {
      await setListingStatus(listing.id, status)
      setListing({ ...listing, status })
      setToast(status === 'vendue' ? 'Bravo pour la vente ! 🎉' : `Annonce : ${STATUS_LABEL[status].toLowerCase()}`)
    } catch (e) {
      setToast((e as Error).message)
    }
  }

  const remove = async () => {
    if (!confirm('Supprimer définitivement cette annonce ? Les discussions liées seront aussi supprimées.')) return
    try {
      await deleteListing(listing.id)
      navigate('/vendre?vue=mes', { replace: true })
    } catch (e) {
      setToast((e as Error).message)
    }
  }

  const report = async () => {
    if (!session) return setGate('login')
    const reason = prompt('Pourquoi signales-tu cette annonce ? (fausse carte, arnaque, contenu choquant…)')
    if (!reason?.trim()) return
    try {
      await reportListing(listing.id, reason.trim().slice(0, 300))
      setToast('Merci, l’annonce a été signalée.')
    } catch (e) {
      setToast((e as Error).message)
    }
  }

  const cond = listing.condition && CONDITIONS[listing.condition as ConditionCode]

  return (
    <div className="pb-24">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => navigate(-1)} aria-label="Retour" className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface">
          <ArrowLeft size={20} />
        </button>
        <span className="text-sm text-muted">Publiée {timeAgo(new Date(listing.createdAt).getTime())}</span>
        {!listing.mine && (
          <button onClick={() => void report()} className="ml-auto flex items-center gap-1 text-sm text-muted">
            <Flag size={15} /> Signaler
          </button>
        )}
      </div>

      <Photos listing={listing} />

      <Card className="mt-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl leading-tight font-extrabold">{listing.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {KIND_LABEL[listing.kind]}
              {cond && ` · ${cond.short} (${cond.label})`}
            </p>
          </div>
          <p className="shrink-0 text-2xl font-extrabold text-primary">{priceLabel(listing)}</p>
        </div>
        {listing.status !== 'active' && (
          <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold text-white ${listing.status === 'vendue' ? 'bg-ink/80' : 'bg-warn'}`}>
            {listing.status === 'vendue' ? 'Cette carte a été vendue.' : 'Réservée : le vendeur est en discussion avec un acheteur.'}
          </p>
        )}
        {listing.cardId && <MarketPrice cardId={listing.cardId} />}
        {listing.description && <p className="mt-3 whitespace-pre-wrap">{listing.description}</p>}
        {listing.hashtags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {listing.hashtags.map((t) => (
              <Link key={t} to={`/vendre?tag=${encodeURIComponent(t)}`} className="rounded-full bg-primary-soft px-2.5 py-1 text-sm font-semibold text-primary">
                #{t}
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Link
        to={`/vendre?vendeur=${listing.seller.id}&nom=${encodeURIComponent(listing.seller.pseudo)}`}
        className="mt-3 flex items-center gap-3 rounded-3xl border border-line bg-surface p-3"
      >
        <MemberAvatar member={listing.seller} size={48} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{listing.seller.pseudo}</p>
          <p className="text-sm text-muted">{listing.mine ? 'C’est toi !' : 'Voir toutes ses annonces'}</p>
        </div>
      </Link>

      {!listing.mine && (
        <Card className="mt-3">
          <p className="mb-1 flex items-center gap-2 font-bold">
            <ShieldCheck size={18} className="text-good" /> Acheter sans risque
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            <li>Préfère la remise en main propre, dans un lieu public, ou un envoi suivi.</li>
            <li>Demande des photos en plus (dos de la carte, bords) si tu as un doute.</li>
            <li>Méfie-toi d’un prix bien plus bas que la cote : c’est souvent une fausse carte ou une arnaque.</li>
            <li>Ne donne jamais ton code de connexion, ni tes coordonnées bancaires dans le chat.</li>
          </ul>
        </Card>
      )}

      {gate && <div className="mt-3">{gate === 'login' ? <LoginGate text="Connecte-toi pour discuter avec le vendeur." /> : <PseudoGate />}</div>}

      {listing.mine && (
        <Card className="mt-3">
          <p className="mb-2 font-bold">Gérer mon annonce</p>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
            {(['active', 'reservee', 'vendue'] as const).map((s) => (
              <button
                key={s}
                onClick={() => void changeStatus(s)}
                aria-pressed={listing.status === s}
                className={`rounded-xl py-2 text-sm font-bold ${listing.status === s ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <button onClick={() => void remove()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm font-semibold text-bad">
            <Trash2 size={16} /> Supprimer l’annonce
          </button>
        </Card>
      )}
      {canModerate && !listing.mine && (
        <button onClick={() => void remove()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-bad py-2.5 text-sm font-semibold text-bad">
          <Trash2 size={16} /> Supprimer (modération)
        </button>
      )}

      {/* Barre d'action collée au-dessus des onglets */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 mx-auto flex max-w-xl gap-2 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pt-4 pb-2">
        {listing.mine ? (
          <Link to={`/vendre/annonce/${listing.id}/modifier`} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-bold text-primary-ink shadow-lg">
            <Pencil size={18} /> Modifier l’annonce
          </Link>
        ) : (
          <button
            onClick={() => void contact()}
            disabled={busy || listing.status === 'vendue'}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-bold text-primary-ink shadow-lg active:scale-[.98] disabled:opacity-60"
          >
            <MessageCircle size={20} /> {listing.conversationId ? 'Reprendre la discussion' : `Discuter avec ${listing.seller.pseudo}`}
          </button>
        )}
      </div>

      {toast && (
        <div role="status" className="fixed inset-x-0 top-20 z-30 mx-auto w-fit max-w-[90%] rounded-full bg-ink px-4 py-2 text-center text-sm font-bold text-bg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

/** Carrousel de photos : on glisse avec le doigt, des points indiquent la photo affichée. */
function Photos({ listing }: { listing: Listing }) {
  const [index, setIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const n = Math.max(1, listing.photoCount)
  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl border border-line [scrollbar-width:none]"
      >
        {Array.from({ length: n }, (_, i) => (
          <ListingPhoto key={i} listing={listing} pos={i} className="aspect-[4/5] w-full shrink-0 snap-center" />
        ))}
      </div>
      {n > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {Array.from({ length: n }, (_, i) => (
            <button
              key={i}
              aria-label={`Photo ${i + 1}`}
              onClick={() => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: 'smooth' })}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-2 bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** La cote de la carte liée : l'acheteur voit tout de suite si le prix est correct. */
function MarketPrice({ cardId }: { cardId: string }) {
  const { prices } = useCardPrices([cardId])
  const eur = prices[cardId]?.eur
  return (
    <Link to={`/carte/${cardId}`} className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
      <TrendingUp size={16} className="text-primary" />
      <span>
        Cote DexValeur : <b>{eur ? formatEur(eur) : '…'}</b> <span className="text-muted">(état parfait)</span>
      </span>
      <span className="ml-auto font-semibold text-primary">Voir</span>
    </Link>
  )
}
