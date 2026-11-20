import { useState } from 'react'
import { Link } from 'react-router'
import { normalizeAvatar } from '../lib/avatar'
import { photoUrl, priceLabel, STATUS_LABEL, type Listing, type Seller } from '../lib/market'
import { AccountPanel } from './AccountPanel'
import { AvatarView } from './AvatarView'
import { Card } from './ui'

/** Petite tête d'avatar ronde + pseudo du membre. */
export function MemberAvatar({ member, size = 28 }: { member: Pick<Seller, 'avatar'>; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-primary-soft" style={{ width: size, height: size }}>
      <AvatarView a={normalizeAvatar(member.avatar)} crop="head" className="translate-y-[6%]" size={size * 1.15} />
    </span>
  )
}

/** Photo d'annonce, avec un fond neutre pendant le chargement. */
export function ListingPhoto({ listing, pos = 0, className = '' }: { listing: Pick<Listing, 'id' | 'version' | 'title'>; pos?: number; className?: string }) {
  const [ok, setOk] = useState(true)
  return (
    <div className={`overflow-hidden bg-surface-2 ${className}`}>
      {ok ? (
        <img src={photoUrl(listing, pos)} alt={pos === 0 ? listing.title : ''} loading="lazy" onError={() => setOk(false)} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-2xl" aria-hidden>
          🃏
        </div>
      )}
    </div>
  )
}

export function StatusBadge({ status }: { status: Listing['status'] }) {
  if (status === 'active') return null
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${status === 'vendue' ? 'bg-ink/80' : 'bg-warn'}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

/** Vignette d'annonce dans la grille (photo, prix, titre, vendeur). */
export function ListingTile({ listing }: { listing: Listing }) {
  return (
    <Link to={`/vendre/annonce/${listing.id}`} className="block overflow-hidden rounded-2xl border border-line bg-surface active:scale-[.98]">
      <div className="relative">
        <ListingPhoto listing={listing} className="aspect-[3/4]" />
        <div className="absolute top-2 left-2">
          <StatusBadge status={listing.status} />
        </div>
        {listing.photoCount > 1 && (
          <span className="absolute right-2 bottom-2 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">1/{listing.photoCount}</span>
        )}
      </div>
      <div className="space-y-0.5 p-2.5">
        <p className="text-base leading-tight font-extrabold">{priceLabel(listing)}</p>
        <p className="line-clamp-2 text-sm leading-snug">{listing.title}</p>
        {listing.condition && <p className="text-xs text-muted">État : {listing.condition}</p>}
        <div className="flex items-center gap-1.5 pt-1">
          <MemberAvatar member={listing.seller} size={20} />
          <span className="truncate text-xs text-muted">{listing.seller.pseudo}</span>
        </div>
      </div>
    </Link>
  )
}

/** Bloc « connecte-toi » réutilisé quand une action demande un compte. */
export function LoginGate({ text }: { text: string }) {
  return (
    <Card>
      <p className="mb-3 font-semibold">{text}</p>
      <AccountPanel />
    </Card>
  )
}

/** Bloc « choisis un pseudo » : il s'affiche sur tes annonces et dans le chat. */
export function PseudoGate() {
  return (
    <Card className="text-center">
      <p className="font-bold">Choisis d’abord ton pseudo</p>
      <p className="mt-1 text-sm text-muted">C’est le nom que les autres membres verront sur tes annonces et dans le chat (jamais ton email).</p>
      <Link to="/profil" className="mt-3 inline-block rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-ink">
        Aller dans Profil
      </Link>
    </Card>
  )
}

export function Spinner({ text = 'Chargement…' }: { text?: string }) {
  return (
    <p className="py-10 text-center text-sm text-muted" role="status">
      <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent align-[-3px]" aria-hidden />
      {text}
    </p>
  )
}
