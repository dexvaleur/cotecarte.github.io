import { ArrowLeft, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../api/cache'
import { searchByName, searchByNumber, setIdOf } from '../api/tcgdex'
import type { CardBrief } from '../api/types'
import { CardThumb, useSetNames } from '../components/CardThumb'
import { parseCardNumber } from '../scan/parse'

/** Recherche manuelle : le plan B quand le scan ne reconnaît pas la carte. */
export function SearchScreen() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [name, setName] = useState(params.get('q') ?? '')
  const [number, setNumber] = useState(params.get('n') ?? '')
  const [state, setState] = useState<{ loading: boolean; results: CardBrief[] | null; error: string | null }>({
    loading: false,
    results: null,
    error: null,
  })
  const setNames = useSetNames()

  // On lance la recherche 400 ms après la dernière frappe (pas à chaque lettre).
  useEffect(() => {
    const q = name.trim()
    const parsed = parseCardNumber(number.replace(/\s/g, '').toUpperCase())
    if (q.length < 2 && !parsed?.total) {
      setState({ loading: false, results: null, error: null })
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      setState((s) => ({ ...s, loading: true, error: null }))
      setParams({ ...(q ? { q } : {}), ...(number ? { n: number } : {}) }, { replace: true })
      try {
        let results: CardBrief[]
        if (parsed?.total) {
          results = await searchByNumber(parsed.raw, parsed.total)
          if (q) results = results.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
        } else {
          results = await searchByName(q)
          // Numéro seul sans total (ex. « 25 ») : on filtre la liste.
          const n = number.trim()
          if (n) results = results.filter((c) => c.localId.replace(/^0+/, '') === n.replace(/^0+/, ''))
        }
        if (!cancelled) setState({ loading: false, results, error: null })
      } catch (e) {
        if (!cancelled)
          setState({ loading: false, results: null, error: e instanceof ApiError ? e.message : 'Recherche impossible.' })
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, number])

  return (
    <>
      <button onClick={() => navigate(-1)} className="mb-3 flex items-center gap-1 font-semibold text-muted">
        <ArrowLeft size={18} /> Retour
      </button>
      <h1 className="text-2xl font-extrabold tracking-tight">Rechercher une carte</h1>
      <p className="mb-4 text-muted">Tape le nom (en français ou en anglais) et, si tu veux, le numéro en bas de la carte.</p>

      <div className="grid grid-cols-[1fr_7.5rem] gap-2">
        <label className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-3 focus-within:border-primary">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pikachu, Dracaufeu…"
            aria-label="Nom de la carte"
            className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted focus-visible:outline-none"
          />
        </label>
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Numéro"
          inputMode="text"
          aria-label="Numéro de la carte"
          className="min-w-0 rounded-2xl border border-line bg-surface px-3 py-3 outline-none placeholder:text-muted focus-visible:border-primary focus-visible:outline-none"
        />
      </div>

      <div className="mt-4">
        {state.loading && <p className="text-center text-muted">Recherche…</p>}
        {state.error && <p className="rounded-2xl bg-bad/10 p-3 text-center font-semibold text-bad">{state.error}</p>}
        {state.results && !state.loading && (
          <>
            <p className="mb-2 text-sm text-muted">
              {state.results.length === 0
                ? 'Aucune carte trouvée. Vérifie l’orthographe ou essaie le nom anglais.'
                : `${state.results.length} carte${state.results.length > 1 ? 's' : ''} trouvée${state.results.length > 1 ? 's' : ''}${state.results.length > 60 ? ' (les 60 plus récentes affichées)' : ''}`}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {state.results.slice(0, 60).map((c) => (
                <CardThumb key={c.id} card={c} setName={setNames.get(setIdOf(c.id))} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
