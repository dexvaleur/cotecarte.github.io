import { NavLink } from 'react-router'
import { useUnread } from '../lib/market'
import { BinderIcon, BoosterIcon, CoinIcon, DexIcon, ProfileIcon } from './TabIcons'

const TABS = [
  { to: '/scanner', label: 'Scanner', Icon: DexIcon },
  { to: '/collection', label: 'Collection', Icon: BinderIcon },
  { to: '/packs', label: 'Packs', Icon: BoosterIcon },
  { to: '/vendre', label: 'Vendre', Icon: CoinIcon },
  { to: '/profil', label: 'Profil', Icon: ProfileIcon },
]

/** Barre d'onglets en bas de l'écran, facile à atteindre avec le pouce. */
export function TabBar() {
  const unread = useUnread()
  return (
    <nav
      aria-label="Navigation principale"
      className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              data-tour={`tab-${to.slice(1)}`}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold transition-colors ${
                  isActive ? 'text-primary' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`relative grid h-9 w-12 place-items-center rounded-full transition-colors ${
                      isActive ? 'bg-primary-soft' : ''
                    }`}
                  >
                    <Icon active={isActive} />
                    {to === '/vendre' && unread > 0 && (
                      <span aria-label={`${unread} message(s) non lu(s)`} className="absolute top-0 right-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white ring-2 ring-surface">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
