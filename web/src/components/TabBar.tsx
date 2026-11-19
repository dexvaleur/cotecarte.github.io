import { NavLink } from 'react-router'
import { BinderIcon, BoosterIcon, CoinIcon, DexIcon, ProfileIcon, RadioIcon } from './TabIcons'

const TABS = [
  { to: '/scanner', label: 'Scanner', Icon: DexIcon },
  { to: '/collection', label: 'Collection', Icon: BinderIcon },
  { to: '/packs', label: 'Packs', Icon: BoosterIcon },
  { to: '/actus', label: 'Actus', Icon: RadioIcon },
  { to: '/vendre', label: 'Vendre', Icon: CoinIcon },
  { to: '/profil', label: 'Profil', Icon: ProfileIcon },
]

/** Barre d'onglets en bas de l'écran, facile à atteindre avec le pouce. */
export function TabBar() {
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
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold transition-colors ${
                  isActive ? 'text-primary' : 'text-muted'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`grid h-9 w-12 place-items-center rounded-full transition-colors ${
                      isActive ? 'bg-primary-soft' : ''
                    }`}
                  >
                    <Icon active={isActive} />
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
