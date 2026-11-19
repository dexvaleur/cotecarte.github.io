import { ArrowRight, Camera, Sparkles, Sun } from 'lucide-react'
import { useState } from 'react'
import { GLOSSARY } from '../data/glossary'

// Les 5 mots les plus utiles pour débuter, montrés sur le 3ᵉ écran.
const STARTER_TERMS = ['Holo', 'Reverse (Reverse Holo)', 'Full Art', 'Secret Rare', 'Near Mint (NM)']

/** Onboarding de 3 écrans, montré au premier lancement. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const last = step === 2

  return (
    <div className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-xl flex-col px-5">
      <div className="flex h-14 items-center justify-end">
        {!last && (
          <button onClick={onDone} className="rounded-full px-3 py-2 font-semibold text-muted hover:bg-surface-2">
            Passer
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center">
        {step === 0 && <Welcome />}
        {step === 1 && <HowToScan />}
        {step === 2 && <MiniGlossary />}
      </div>

      <div className="py-6">
        <div className="mb-5 flex justify-center gap-2" aria-label={`Étape ${step + 1} sur 3`}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-2 bg-line'}`}
            />
          ))}
        </div>
        <button
          onClick={() => (last ? onDone() : setStep(step + 1))}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-lg font-bold text-primary-ink active:scale-[.98]"
        >
          {last ? "C'est parti !" : 'Suivant'} <ArrowRight size={20} />
        </button>
      </div>
    </div>
  )
}

function Welcome() {
  return (
    <div className="text-center">
      <img src="./favicon.svg" alt="" className="mx-auto mb-6 h-28 w-28 drop-shadow-xl" />
      <h1 className="text-3xl font-extrabold tracking-tight">Bienvenue sur Cote Carte</h1>
      <p className="mt-3 text-lg text-muted">
        Scanne une carte Pokémon et découvre tout de suite ce qu'elle est, sa rareté et combien elle vaut.
      </p>
      <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left">
        <li>📷 Scanne tes cartes</li>
        <li>🗂️ Suis la valeur de ta collection</li>
        <li>🎁 Choisis les bons boosters</li>
        <li>💰 Revends au juste prix</li>
      </ul>
    </div>
  )
}

function HowToScan() {
  const tips = [
    { Icon: Camera, title: 'Cadre bien la carte', text: 'Pose-la à plat et place-la entièrement dans le cadre.' },
    { Icon: Sun, title: 'De la lumière, sans reflet', text: 'Évite le flash sur les cartes brillantes : penche un peu la carte.' },
    {
      Icon: Sparkles,
      title: 'On lit le bas de la carte',
      text: 'Le nom et le numéro (ex. 025/165) servent à la reconnaître.',
    },
  ]
  return (
    <div>
      <h1 className="text-center text-3xl font-extrabold tracking-tight">Comment scanner</h1>
      <p className="mt-2 text-center text-muted">3 réflexes pour un scan réussi du premier coup.</p>
      <ul className="mt-6 space-y-3">
        {tips.map(({ Icon, title, text }) => (
          <li key={title} className="flex gap-4 rounded-3xl border border-line bg-surface p-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Icon size={24} />
            </span>
            <span>
              <span className="block font-bold">{title}</span>
              <span className="text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function MiniGlossary() {
  const terms = GLOSSARY.filter((g) => STARTER_TERMS.includes(g.term))
  return (
    <div>
      <h1 className="text-center text-3xl font-extrabold tracking-tight">Les mots à connaître</h1>
      <p className="mt-2 text-center text-muted">Le glossaire complet reste accessible via l'icône 📖 en haut.</p>
      <dl className="mt-6 space-y-2">
        {terms.map((t) => (
          <div key={t.term} className="rounded-2xl border border-line bg-surface px-4 py-3">
            <dt className="font-bold text-primary">{t.term}</dt>
            <dd className="text-sm">{t.short}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
