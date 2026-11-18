import { BookOpen, Settings, WifiOff } from 'lucide-react'
import { Link, Outlet } from 'react-router'
import { useOnline } from '../lib/useOnline'
import { TabBar } from './TabBar'

/** Structure commune à tous les écrans : en-tête, contenu, barre d'onglets. */
export function AppShell() {
  const online = useOnline()

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="pt-safe sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-4">
          <Link to="/scanner" className="flex items-center gap-2 font-extrabold tracking-tight">
            <img src="./favicon.svg" alt="" className="h-8 w-8" />
            <span className="text-lg">
              Poké <span className="text-primary">Card</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <Link
              to="/glossaire"
              aria-label="Glossaire"
              className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface-2"
            >
              <BookOpen size={20} />
            </Link>
            <Link
              to="/reglages"
              aria-label="Réglages"
              className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-surface-2"
            >
              <Settings size={20} />
            </Link>
          </div>
        </div>
        {!online && (
          <div role="status" className="flex items-center gap-2 bg-warn px-4 py-1.5 text-sm font-semibold text-white">
            <WifiOff size={16} /> Hors ligne : tu peux consulter ta collection, le reste reviendra avec le réseau.
          </div>
        )}
      </header>

      <main className="flex-1 px-4 pt-4 pb-28">
        <Outlet />
      </main>

      <TabBar />
    </div>
  )
}
