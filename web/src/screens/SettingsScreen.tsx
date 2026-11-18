import { Monitor, Moon, RotateCcw, Sun } from 'lucide-react'
import { AccountPanel } from '../components/AccountPanel'
import { Card, ScreenTitle } from '../components/ui'
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

      <Card className="mt-4">
        <button onClick={onReplayOnboarding} className="flex w-full items-center gap-3 font-semibold">
          <RotateCcw size={20} className="text-primary" /> Revoir la présentation
        </button>
      </Card>

      <p className="mt-6 text-center text-xs text-muted">
        Poké Card · application non officielle, non affiliée à The Pokémon Company ou Nintendo.
      </p>
    </>
  )
}
