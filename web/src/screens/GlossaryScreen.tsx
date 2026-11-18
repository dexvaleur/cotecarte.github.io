import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ScreenTitle } from '../components/ui'
import { CATEGORY_LABEL, GLOSSARY } from '../data/glossary'

// Pour chercher sans tenir compte des accents ni des majuscules.
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function GlossaryScreen() {
  const [q, setQ] = useState('')
  const results = useMemo(
    () => GLOSSARY.filter((g) => norm(g.term + ' ' + g.short).includes(norm(q))),
    [q],
  )

  return (
    <>
      <ScreenTitle title="Glossaire" subtitle="Les mots du collectionneur, expliqués simplement." />
      <label className="mb-4 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 focus-within:border-primary">
        <Search size={18} className="text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher un mot (holo, ETB…)"
          className="w-full bg-transparent outline-none placeholder:text-muted focus-visible:outline-none"
        />
      </label>
      <dl className="space-y-2">
        {results.map((g) => (
          <div key={g.term} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <dt className="font-bold text-primary">{g.term}</dt>
              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted">
                {CATEGORY_LABEL[g.category]}
              </span>
            </div>
            <dd className="mt-1">{g.short}</dd>
            {g.tip && <dd className="mt-1 text-sm text-muted">💡 {g.tip}</dd>}
          </div>
        ))}
        {results.length === 0 && <p className="text-center text-muted">Aucun mot trouvé pour « {q} ».</p>}
      </dl>
    </>
  )
}
