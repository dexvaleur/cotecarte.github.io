import { CONDITIONS, type ConditionCode } from '../data/cardInfo'
import { formatEur } from '../lib/format'

/**
 * Vérification guidée de l'état : 4 questions simples.
 * Une photo ne suffit pas pour juger l'état d'une carte de façon fiable,
 * alors on guide l'utilisateur pour qu'il regarde au bon endroit.
 */

const QUESTIONS = [
  {
    key: 'corners',
    title: 'Les coins',
    how: 'Regarde les 4 coins de près, recto et verso.',
    options: ['Pointus et nets', 'Un peu arrondis ou blanchis', 'Abîmés ou cornés'],
  },
  {
    key: 'edges',
    title: 'Les bords',
    how: 'Retourne la carte : le dos bleu montre bien les petits points blancs.',
    options: ['Aucun point blanc', 'Quelques points blancs', 'Beaucoup de blanc'],
  },
  {
    key: 'surface',
    title: 'La surface',
    how: 'Incline la carte sous une lampe pour voir les rayures et traces de doigts.',
    options: ['Aucune rayure', 'Quelques fines rayures', 'Rayures nettes ou taches'],
  },
  {
    key: 'crease',
    title: 'Plis et déchirures',
    how: 'Regarde la carte à contre-jour : un pli forme une ligne brillante.',
    options: ['Aucun', 'Léger pli', 'Pli marqué ou déchirure'],
  },
] as const

export type Answers = Partial<Record<(typeof QUESTIONS)[number]['key'], 0 | 1 | 2>>

export function gradeFromAnswers(a: Answers): ConditionCode | null {
  if (QUESTIONS.some((q) => a[q.key] === undefined)) return null
  if (a.crease === 2) return 'PO'
  if (a.crease === 1) return 'PL'
  const sum = (a.corners ?? 0) + (a.edges ?? 0) + (a.surface ?? 0)
  if (sum === 0) return 'NM'
  if (sum === 1) return 'EX'
  if (sum === 2) return 'GD'
  if (sum <= 4) return 'LP'
  return 'PL'
}

export function ConditionCheck({ answers, onChange }: { answers: Answers; onChange: (a: Answers) => void }) {
  return (
    <div className="space-y-4">
      {QUESTIONS.map((q, qi) => (
        <fieldset key={q.key}>
          <legend className="font-bold">
            {qi + 1}. {q.title}
          </legend>
          <p className="mb-2 text-sm text-muted">{q.how}</p>
          <div className="grid gap-1.5">
            {q.options.map((label, i) => {
              const selected = answers[q.key] === i
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ ...answers, [q.key]: i as 0 | 1 | 2 })}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold ${
                    selected ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface'
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                      selected ? 'border-primary' : 'border-line'
                    }`}
                  >
                    {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </span>
                  {label}
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

export function ConditionResult({ code, refPrice }: { code: ConditionCode; refPrice: number | null }) {
  const c = CONDITIONS[code]
  return (
    <div className="rounded-2xl bg-primary-soft p-4">
      <p className="text-sm font-semibold text-muted">État estimé</p>
      <p className="text-xl font-extrabold text-primary">
        {c.label} ({c.short})
      </p>
      <p className="text-sm">{c.explain}</p>
      {refPrice !== null && (
        <p className="mt-2 text-sm">
          Valeur estimée dans cet état : <b>≈ {formatEur(refPrice * c.factor)}</b>
          <span className="text-muted"> ({Math.round(c.factor * 100)} % du prix Near Mint)</span>
        </p>
      )}
    </div>
  )
}
