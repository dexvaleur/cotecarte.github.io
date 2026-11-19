import { AvatarView } from './AvatarView'
import { useProfile } from '../lib/profile'
/**
 * Icônes des onglets, dessinées comme des objets d'aventure :
 * Pokédex (scanner), classeur (collection), booster (packs), radio (actus), pièce (vendre).
 * Dessins originaux, en couleur. Inactives, elles sont un peu atténuées.
 */

interface IconProps {
  active: boolean
}

const SIZE = 28

function Frame({ active, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 32 32"
      aria-hidden
      className={`transition ${active ? 'scale-110 drop-shadow-sm' : 'opacity-85 saturate-[.8]'}`}
    >
      {children}
    </svg>
  )
}

/** Pokédex rouge, grosse lentille bleue et voyants. */
export function DexIcon({ active }: IconProps) {
  return (
    <Frame active={active}>
      <rect x="4" y="2.5" width="24" height="27" rx="4" fill="#e3343f" />
      <rect x="4" y="2.5" width="24" height="27" rx="4" fill="none" stroke="#9e1b25" strokeWidth="1.5" />
      <path d="M4 12h9l3-3h12" fill="none" stroke="#9e1b25" strokeWidth="1.5" />
      <circle cx="9.5" cy="7.5" r="3.6" fill="#fff" />
      <circle cx="9.5" cy="7.5" r="2.7" fill="#2f8ff0" />
      <circle cx="8.6" cy="6.6" r="0.9" fill="#d8efff" />
      <circle cx="16" cy="5" r="1.1" fill="#ff8a8a" />
      <circle cx="19.5" cy="5" r="1.1" fill="#ffd23f" />
      <circle cx="23" cy="5" r="1.1" fill="#57d36b" />
      <rect x="8" y="15" width="16" height="9.5" rx="1.8" fill="#dff3ff" stroke="#9e1b25" strokeWidth="1.2" />
      <path d="M9.5 19.5h13" stroke="#2f8ff0" strokeWidth="1.4" strokeLinecap="round" />
    </Frame>
  )
}

/** Classeur bleu avec anneaux et pochettes de cartes. */
export function BinderIcon({ active }: IconProps) {
  return (
    <Frame active={active}>
      <rect x="4" y="3" width="24" height="26" rx="3" fill="#2f6fde" stroke="#1b448f" strokeWidth="1.4" />
      <rect x="4" y="3" width="5" height="26" rx="2" fill="#1b448f" />
      <circle cx="6.5" cy="9" r="1.2" fill="#c9d7f5" />
      <circle cx="6.5" cy="16" r="1.2" fill="#c9d7f5" />
      <circle cx="6.5" cy="23" r="1.2" fill="#c9d7f5" />
      <rect x="11" y="6" width="6.5" height="9" rx="1" fill="#ffd23f" stroke="#fff" strokeWidth="1" />
      <rect x="19" y="6" width="6.5" height="9" rx="1" fill="#ff7b5c" stroke="#fff" strokeWidth="1" />
      <rect x="11" y="17" width="6.5" height="9" rx="1" fill="#57d36b" stroke="#fff" strokeWidth="1" />
      <rect x="19" y="17" width="6.5" height="9" rx="1" fill="#c38bff" stroke="#fff" strokeWidth="1" />
    </Frame>
  )
}

/** Booster brillant, bords dentelés et étoile. */
export function BoosterIcon({ active }: IconProps) {
  return (
    <Frame active={active}>
      <defs>
        <linearGradient id="tab-foil" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe066" />
          <stop offset=".5" stopColor="#ff9f43" />
          <stop offset="1" stopColor="#b55cff" />
        </linearGradient>
      </defs>
      <path
        d="M7 4l1.5-1.5L10 4l1.5-1.5L13 4l1.5-1.5L16 4l1.5-1.5L19 4l1.5-1.5L22 4l1.5-1.5L25 4v24l-1.5 1.5L22 28l-1.5 1.5L19 28l-1.5 1.5L16 28l-1.5 1.5L13 28l-1.5 1.5L10 28l-1.5 1.5L7 28z"
        fill="url(#tab-foil)"
        stroke="#8a3fc4"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M7 7.5h18M7 24.5h18" stroke="#fff" strokeOpacity=".7" strokeWidth="1.2" />
      <path d="M16 10l1.8 4 4.2.4-3.2 2.8 1 4.2-3.8-2.3-3.8 2.3 1-4.2-3.2-2.8 4.2-.4z" fill="#fff" stroke="#8a3fc4" strokeWidth=".9" strokeLinejoin="round" />
      <path d="M9.5 9.5l2 2" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </Frame>
  )
}

/** Radio verte d'aventurier, antenne et haut-parleur. */
export function RadioIcon({ active }: IconProps) {
  return (
    <Frame active={active}>
      <path d="M21 10l4-7" stroke="#2c7a3a" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="25" cy="3" r="1.4" fill="#ff5c5c" />
      <rect x="3.5" y="10" width="25" height="18" rx="4" fill="#3bb35a" stroke="#1f6b31" strokeWidth="1.4" />
      <circle cx="11" cy="19" r="5.2" fill="#1f6b31" />
      <circle cx="11" cy="19" r="3.2" fill="#2c8c45" />
      <circle cx="11" cy="19" r="1.2" fill="#a8ecb8" />
      <rect x="18.5" y="14" width="7" height="4.5" rx="1" fill="#e8ffe9" stroke="#1f6b31" strokeWidth="1" />
      <path d="M20 16.2h4" stroke="#3bb35a" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="20" cy="23" r="1.3" fill="#ffd23f" />
      <circle cx="24" cy="23" r="1.3" fill="#ffd23f" />
    </Frame>
  )
}

/** Pièce d'or avec étoile. */
export function CoinIcon({ active }: IconProps) {
  return (
    <Frame active={active}>
      <defs>
        <linearGradient id="tab-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset="1" stopColor="#f0a500" />
        </linearGradient>
      </defs>
      <ellipse cx="16" cy="17.5" rx="12.5" ry="12" fill="#b77800" />
      <circle cx="16" cy="15.5" r="12.5" fill="url(#tab-gold)" stroke="#b77800" strokeWidth="1.4" />
      <circle cx="16" cy="15.5" r="9" fill="none" stroke="#c98a00" strokeWidth="1.2" strokeDasharray="2 1.6" />
      <path d="M16 9.5l1.7 3.6 3.9.4-2.9 2.6.8 3.9-3.5-2-3.5 2 .8-3.9-2.9-2.6 3.9-.4z" fill="#fff6c9" stroke="#b77800" strokeWidth=".9" strokeLinejoin="round" />
      <path d="M8.5 10.5a9 9 0 0 1 4-3.5" stroke="#fff" strokeOpacity=".8" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </Frame>
  )
}

/** Profil : la tête de l'avatar du dresseur dans un rond. */
export function ProfileIcon({ active }: IconProps) {
  const { avatar } = useProfile()
  return (
    <span
      className={`grid h-7 w-7 place-items-center overflow-hidden rounded-full border-2 bg-primary-soft transition ${active ? 'scale-110 border-primary' : 'border-line opacity-85'}`}
    >
      <AvatarView a={avatar} crop="head" className="h-8 w-8 translate-y-0.5" />
    </span>
  )
}
