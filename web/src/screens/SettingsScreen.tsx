import { Monitor, Moon, RotateCcw, Share2, Sun, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AccountPanel } from '../components/AccountPanel'
import { Card, ScreenTitle } from '../components/ui'
import { LegalLinks } from './LegalScreen'
import { clearFailedScans, shareFailedScans, useFailedScans } from '../lib/scanLog'
import { type ThemeChoice, useTheme } from '../lib/theme'

const THEMES: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Clair', Icon: Sun },
  { value: 'dark', label: 'Sombre', Icon: Moon },
  { value: 'system', label: 'Auto', Icon: Monitor },
]

export function SettingsScreen({ onReplayOnboarding }: { onReplayOnboarding: () => void }) {
  const { choice, setChoice } = useTheme()

  return (
    <>
      <ScreenTitle title="Réglages" />

      <Card>
        <h2 className="mb-3 font-bold">Apparence</h2>
        <div role="radiogroup" aria-label="Thème" className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-1">
          {THEMES.map(({ value, label, Icon }) => (
            <button
              key={value}
              role="radio"
              aria-checked={choice === value}
              onClick={() => setChoice(value)}
              className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-sm font-semibold ${
                choice === value ? 'bg-surface text-primary shadow-sm' : 'text-muted'
              }`}
            >
              <Icon size={20} /> {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">« Auto » suit le réglage de ton téléphone.</p>
      </Card>

      <Card className="mt-4">
        <h2 className="mb-2 font-bold">Compte</h2>
        <AccountPanel />
      </Card>

      <ScanHelp />

      <Card className="mt-4">
        <button onClick={onReplayOnboarding} className="flex w-full items-center gap-3 font-semibold">
          <RotateCcw size={20} className="text-primary" /> Revoir la présentation
        </button>
      </Card>

      <p className="mt-6 text-center text-xs text-muted">
        Poké Card · application de fan non officielle, non affiliée à Nintendo, Creatures, GAME FREAK ou The Pokémon
        Company. Pokémon © Nintendo / Creatures / GAME FREAK.
      </p>
      <LegalLinks className="mt-2" />
    </>
  )
}

/** Scans ratés gardés sur le téléphone, à partager pour améliorer le scanner. */
function ScanHelp() {
  const scans = useFailedScans()
  const [msg, setMsg] = useState<string | null>(null)
  return (
    <Card className="mt-4">
      <h2 className="mb-1 font-bold">Améliorer le scanner</h2>
      <p className="text-sm text-muted">
        Quand le scanner ne trouve pas directement ta carte et que tu l’ajoutes toi-même, la photo est gardée ici
        (sur ton téléphone uniquement).
      </p>
      <p className="mt-2 font-semibold">
        {scans.length ? `${scans.length} scan${scans.length > 1 ? 's' : ''} raté${scans.length > 1 ? 's' : ''}` : 'Aucun scan raté pour l’instant 🎉'}
      </p>
      {scans.length > 0 && (
        <>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {scans.slice(0, 8).map((s) => (
              <img key={s.id} src={s.dataUrl} alt={s.cardName} className="w-14 shrink-0 rounded-lg" />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() =>
                shareFailedScans()
                  .then((r) => setMsg(r === 'shared' ? null : 'Fichiers téléchargés.'))
                  .catch(() => setMsg('Partage annulé.'))
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 font-bold text-primary-ink"
            >
              <Share2 size={18} /> Partager
            </button>
            <button
              onClick={() => confirm('Effacer les scans ratés gardés ?') && clearFailedScans()}
              aria-label="Effacer les scans ratés"
              className="rounded-2xl border border-line px-4 text-muted"
            >
              <Trash2 size={18} />
            </button>
          </div>
          {msg && <p className="mt-2 text-sm text-muted">{msg}</p>}
        </>
      )}
    </Card>
  )
}
