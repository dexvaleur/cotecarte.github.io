import { ArrowLeftRight, BookOpen, Check, ChevronLeft, ChevronRight, ExternalLink, Pencil, Plus, Search, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getSet, getSets, searchByName } from '../api/tcgdex'
import type { CardBrief, SetBrief } from '../api/types'
import { CardImage } from '../components/CardThumb'
import { Card, ScreenTitle } from '../components/ui'
import { CONDITIONS } from '../data/cardInfo'
import { BINDER_COLORS, colsOf, compact, dropEmptyLastPage, padToPages, PAGE_FORMATS, pageCount, swap } from '../lib/binders'
import {
  addToBinder,
  type Binder,
  type BinderSlot,
  type CollectionItem,
  createBinder,
  deleteBinder,
  updateBinder,
  useCollectionState,
} from '../lib/collection'
import { arrange, type SortableRow, type SortMode } from '../lib/collectionSort'
import { formatEur } from '../lib/format'
import { useCardPrices } from '../lib/useCardPrices'

/**
 * Classeurs : comme un vrai classeur de cartes, avec des pages de 4, 9 ou 12 cases.
 * Une case contient une carte (en couleur si on l'a, en gris si elle manque) ou reste vide.
 */

const slotOfItem = (i: CollectionItem): BinderSlot => ({ cardId: i.cardId, name: i.name, image: i.image, setName: i.setName, localId: i.localId })
const slotOfBrief = (c: CardBrief, setName?: string): BinderSlot => ({ cardId: c.id, name: c.name, image: c.image, setName, localId: c.localId })

/** Cartes différentes de la collection, avec leur valeur (pour les trier). */
function useOwnedRows() {
  const { collection } = useCollectionState()
  const { prices } = useCardPrices(collection.map((c) => c.cardId))
  return useMemo(() => {
    const byCard = new Map<string, SortableRow & { item: CollectionItem }>()
    for (const i of collection) {
      const p = prices[i.cardId]
      const unit = (p?.eur ?? i.priceEur ?? 0) * CONDITIONS[i.condition].factor
      const prev = byCard.get(i.cardId)
      if (prev) {
        prev.item = { ...prev.item, quantity: prev.item.quantity + i.quantity }
        prev.unit = Math.max(prev.unit, unit)
      } else {
        byCard.set(i.cardId, { item: { ...i }, rarity: i.rarity ?? p?.rarity, types: i.types?.length ? i.types : (p?.types ?? []), unit })
      }
    }
    return [...byCard.values()]
  }, [collection, prices])
}

function binderStats(b: Binder, owned: Set<string>, prices: Record<string, { eur: number | null }>) {
  const cards = b.slots.filter((s): s is BinderSlot => s !== null)
  const have = cards.filter((s) => owned.has(s.cardId))
  const value = have.reduce((sum, s) => sum + (prices[s.cardId]?.eur ?? 0), 0)
  return { cards: cards.length, have: have.length, missing: cards.length - have.length, value, pages: pageCount(b.slots, b.perPage) }
}

// ---- Liste (onglet de la collection) ---------------------------------------------

export function BindersList() {
  const { binders, collection } = useCollectionState()
  const owned = useMemo(() => new Set(collection.map((c) => c.cardId)), [collection])
  const ids = useMemo(() => binders.flatMap((b) => b.slots.filter(Boolean).map((s) => s!.cardId)), [binders])
  const { prices } = useCardPrices(ids)

  return (
    <div className="space-y-3">
      <Link
        to="/classeurs/nouveau"
        className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-primary-ink"
      >
        <Plus size={20} /> Nouveau classeur
      </Link>

      {!binders.length && (
        <Card className="text-center">
          <BookOpen className="mx-auto text-primary" size={32} />
          <p className="mt-2 font-bold">Range tes cartes comme dans un vrai classeur</p>
          <p className="mt-1 text-sm text-muted">
            Un classeur par extension, par type, pour tes plus belles cartes… Les cartes qui te manquent apparaissent en gris :
            tu vois tout de suite ce qu’il reste à trouver.
          </p>
        </Card>
      )}

      {binders.map((b) => {
        const st = binderStats(b, owned, prices)
        const preview = b.slots.filter((s): s is BinderSlot => s !== null).slice(0, 3)
        return (
          <Link key={b.id} to={`/classeurs/${b.id}`} className="flex overflow-hidden rounded-2xl border border-line bg-surface active:scale-[.99]">
            <div className="w-3 shrink-0" style={{ background: b.color }} aria-hidden />
            <div className="min-w-0 flex-1 p-3">
              <p className="truncate font-extrabold">{b.name}</p>
              <p className="text-xs text-muted">
                {st.have} / {st.cards} carte{st.cards > 1 ? 's' : ''} · {st.pages} page{st.pages > 1 ? 's' : ''} de {b.perPage}
              </p>
              <p className="mt-1 text-sm font-bold">{formatEur(st.value)}</p>
              {st.cards > 0 && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${Math.round((st.have / st.cards) * 100)}%`, background: b.color }} />
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1 pr-3">
              {preview.map((s) => (
                <div key={s.cardId} className={`w-10 ${owned.has(s.cardId) ? '' : 'opacity-40 grayscale'}`}>
                  <CardImage image={s.image} cardId={s.cardId} alt="" />
                </div>
              ))}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ---- Création ------------------------------------------------------------------

type Start = 'empty' | 'set' | 'type' | 'all' | 'wish'
const FILL_ORDERS: { id: SortMode; label: string }[] = [
  { id: 'dex', label: 'Pokédex' },
  { id: 'set', label: 'Par extension' },
  { id: 'type', label: 'Par type' },
  { id: 'value', label: 'Plus chères d’abord' },
  { id: 'name', label: 'A → Z' },
]

export function NewBinderScreen() {
  const navigate = useNavigate()
  const { collection, wishlist } = useCollectionState()
  const rows = useOwnedRows()
  const [name, setName] = useState('')
  const [color, setColor] = useState(BINDER_COLORS[0])
  const [perPage, setPerPage] = useState<4 | 9 | 12>(9)
  const [start, setStart] = useState<Start>('empty')
  const [setId, setSetId] = useState('')
  const [type, setType] = useState('')
  const [order, setFillOrder] = useState<SortMode>('dex')
  const [sets, setSets] = useState<SetBrief[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSets('fr')
      .then((s) => setSets([...s].reverse()))
      .catch(() => {})
  }, [])
  const mySets = new Set(collection.map((c) => c.setId))
  const types = [...new Set(rows.flatMap((r) => r.types))].sort()
  const setsOrder = useMemo(() => new Map([...sets].reverse().map((s, i) => [s.id, i])), [sets])

  const defaultName = () => {
    if (start === 'set') return sets.find((s) => s.id === setId)?.name ?? 'Mon classeur'
    if (start === 'type' && type) return `Mes cartes ${type}`
    if (start === 'wish') return 'Cartes à trouver'
    if (start === 'all') return 'Ma collection'
    return 'Mon classeur'
  }

  async function create() {
    setBusy(true)
    setError(null)
    try {
      let slots: (BinderSlot | null)[] = []
      if (start === 'set') {
        if (!setId) throw new Error('Choisis une extension.')
        const { data } = await getSet(setId)
        slots = [...data.cards]
          .sort((a, b) => a.localId.localeCompare(b.localId, 'fr', { numeric: true }))
          .map((c) => slotOfBrief(c, data.name))
      } else if (start === 'type' || start === 'all') {
        if (start === 'type' && !type) throw new Error('Choisis un type.')
        const picked = start === 'type' ? rows.filter((r) => r.types.includes(type)) : rows
        slots = arrange(picked, order, setsOrder)
          .flatMap((g) => g.rows)
          .map((r) => slotOfItem(r.item as CollectionItem))
      } else if (start === 'wish') {
        slots = wishlist.map((w) => ({ cardId: w.cardId, name: w.name, image: w.image, setName: w.setName }))
      }
      const id = createBinder({ name: name.trim() || defaultName(), color, perPage, slots: padToPages(slots, perPage) })
      navigate(`/classeurs/${id}`, { replace: true })
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const STARTS: { id: Start; label: string; hint: string; disabled?: boolean }[] = [
    { id: 'empty', label: 'Vide', hint: 'Tu ajoutes les cartes toi-même, où tu veux.' },
    { id: 'set', label: 'Une extension complète', hint: 'Toutes les cartes de l’extension, dans l’ordre des numéros. Celles qui te manquent sont en gris.' },
    { id: 'type', label: 'Mes cartes d’un type', hint: 'Par exemple toutes tes cartes Feu.', disabled: !rows.length },
    { id: 'all', label: 'Toute ma collection', hint: 'Une case par carte différente, dans l’ordre de ton choix.', disabled: !rows.length },
    { id: 'wish', label: 'Ma wishlist', hint: 'Les cartes que tu cherches, pour les repérer d’un coup d’œil.', disabled: !wishlist.length },
  ]

  return (
    <>
      <ScreenTitle title="Nouveau classeur" />
      <Card className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Nom</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder={defaultName()}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 outline-none focus:border-primary"
          />
        </label>

        <div>
          <span className="mb-1 block text-sm font-bold">Couleur</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Couleur">
            {BINDER_COLORS.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={`grid h-9 w-9 place-items-center rounded-full ${color === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''}`}
                style={{ background: c }}
              >
                {color === c && <Check size={16} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm font-bold">Format des pages</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Format des pages">
            {PAGE_FORMATS.map((f) => (
              <button
                key={f.perPage}
                role="radio"
                aria-checked={perPage === f.perPage}
                onClick={() => setPerPage(f.perPage)}
                className={`rounded-xl border px-2 py-2 text-center ${perPage === f.perPage ? 'border-primary bg-primary-soft text-primary' : 'border-line'}`}
              >
                <span className="block font-bold">{f.label}</span>
                <span className="block text-[11px] leading-tight text-muted">{f.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm font-bold">Pour commencer</span>
          <div className="space-y-2" role="radiogroup" aria-label="Contenu de départ">
            {STARTS.map((s) => (
              <button
                key={s.id}
                role="radio"
                aria-checked={start === s.id}
                disabled={s.disabled}
                onClick={() => setStart(s.id)}
                className={`block w-full rounded-xl border px-3 py-2 text-left disabled:opacity-40 ${start === s.id ? 'border-primary bg-primary-soft' : 'border-line'}`}
              >
                <span className="block font-bold">{s.label}</span>
                <span className="block text-xs text-muted">{s.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {start === 'set' && (
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Extension</span>
            <select value={setId} onChange={(e) => setSetId(e.target.value)} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5">
              <option value="">Choisir…</option>
              {sets.some((s) => mySets.has(s.id)) && (
                <optgroup label="Extensions de ta collection">
                  {sets
                    .filter((s) => mySets.has(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.cardCount.total} cartes)
                      </option>
                    ))}
                </optgroup>
              )}
              <optgroup label="Toutes les extensions (des plus récentes aux plus anciennes)">
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.cardCount.total} cartes)
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
        )}

        {start === 'type' && (
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5">
              <option value="">Choisir…</option>
              {types.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        )}

        {(start === 'type' || start === 'all') && (
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Ordre des cartes</span>
            <select value={order} onChange={(e) => setFillOrder(e.target.value as SortMode)} className="w-full rounded-xl border border-line bg-surface px-3 py-2.5">
              {FILL_ORDERS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {error && <p className="text-sm font-semibold text-bad">{error}</p>}
        <button onClick={() => void create()} disabled={busy} className="w-full rounded-2xl bg-primary py-3 font-bold text-primary-ink disabled:opacity-60">
          {busy ? 'Création…' : 'Créer le classeur'}
        </button>
      </Card>
    </>
  )
}

// ---- Un classeur ---------------------------------------------------------------

export function BinderScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { binders, collection } = useCollectionState()
  const binder = binders.find((b) => b.id === id)
  const owned = useMemo(() => new Set(collection.map((c) => c.cardId)), [collection])
  const ids = useMemo(() => (binder?.slots ?? []).filter(Boolean).map((s) => s!.cardId), [binder])
  const { prices } = useCardPrices(ids)
  const rows = useOwnedRows()

  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [moving, setMoving] = useState<number | null>(null)
  const [picker, setPicker] = useState<{ at: number | null } | null>(null)
  const [editing, setEditing] = useState(false)
  const touch = useRef<number | null>(null)

  if (!binder) {
    return (
      <Card className="text-center">
        <p className="font-bold">Ce classeur n’existe plus.</p>
        <Link to="/collection" className="mt-2 inline-block font-bold text-primary">
          Retour à la collection
        </Link>
      </Card>
    )
  }

  const pages = pageCount(binder.slots, binder.perPage)
  const current = Math.min(page, pages - 1)
  const start = current * binder.perPage
  const pageSlots = binder.slots.slice(start, start + binder.perPage)
  const st = binderStats(binder, owned, prices)
  const setSlots = (slots: (BinderSlot | null)[]) => updateBinder(binder.id, { slots })

  function tapSlot(index: number) {
    if (moving !== null) {
      if (moving !== index) setSlots(swap(binder!.slots, moving, index))
      setMoving(null)
      return
    }
    if (binder!.slots[index]) setSelected(index)
    else setPicker({ at: index })
  }

  function sortBinder(mode: SortMode) {
    const cards = binder!.slots.filter((s): s is BinderSlot => s !== null)
    const info = new Map(rows.map((r) => [r.item.cardId, r]))
    const asRows = cards.map((s, i) => {
      const r = info.get(s.cardId)
      return {
        slot: s,
        item: {
          uid: String(i),
          name: s.name,
          setId: s.cardId.slice(0, s.cardId.lastIndexOf('-')),
          setName: s.setName ?? '',
          localId: s.localId ?? '',
          addedAt: r?.item.addedAt ?? '',
          quantity: 1,
        },
        rarity: r?.rarity,
        types: r?.types ?? [],
        unit: prices[s.cardId]?.eur ?? r?.unit ?? 0,
      }
    })
    setSlots(padToPages(arrange(asRows, mode).flatMap((g) => g.rows.map((r) => r.slot)), binder!.perPage))
    setPage(0)
    setEditing(false)
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => navigate('/collection')} aria-label="Retour" className="grid h-9 w-9 place-items-center rounded-full border border-line">
          <ChevronLeft size={20} />
        </button>
        <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: binder.color }} aria-hidden />
        <h1 className="min-w-0 flex-1 truncate text-2xl font-extrabold tracking-tight">{binder.name}</h1>
        <button onClick={() => setEditing(true)} aria-label="Modifier le classeur" className="grid h-9 w-9 place-items-center rounded-full border border-line">
          <Pencil size={18} />
        </button>
      </div>
      <p className="mb-3 text-sm text-muted">
        <b className="text-ink">{st.have}</b> / {st.cards} carte{st.cards > 1 ? 's' : ''} possédée{st.have > 1 ? 's' : ''}
        {st.missing > 0 && ` · ${st.missing} à trouver`} · <b className="text-ink">{formatEur(st.value)}</b>
      </p>

      {moving !== null && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">
          <ArrowLeftRight size={18} /> Touche la case où la mettre (tu peux changer de page).
          <button onClick={() => setMoving(null)} className="ml-auto underline">
            Annuler
          </button>
        </div>
      )}

      {/* La page, comme une feuille de classeur */}
      <div
        className="rounded-3xl p-2.5 shadow-sm"
        style={{ background: `color-mix(in srgb, ${binder.color} 22%, var(--color-surface))` }}
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return
          const dx = e.changedTouches[0].clientX - touch.current
          touch.current = null
          if (dx < -50 && current < pages - 1) setPage(current + 1)
          if (dx > 50 && current > 0) setPage(current - 1)
        }}
      >
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${colsOf(binder.perPage)}, minmax(0, 1fr))` }}>
          {pageSlots.map((s, i) => {
            const index = start + i
            const have = s && owned.has(s.cardId)
            return (
              <button
                key={index}
                onClick={() => tapSlot(index)}
                aria-label={s ? `${s.name}${have ? '' : ' (manquante)'}` : 'Case vide : ajouter une carte'}
                className={`relative aspect-[63/88] overflow-hidden rounded-lg border border-white/40 bg-surface/60 shadow-inner ${
                  moving === index ? 'ring-4 ring-primary' : moving !== null ? 'ring-2 ring-primary/30' : ''
                }`}
              >
                {s ? (
                  <>
                    <div className={have ? '' : 'opacity-35 grayscale'}>
                      <CardImage image={s.image} cardId={s.cardId} alt={s.name} />
                    </div>
                    {!have && (
                      <span className="absolute inset-x-1 bottom-1 rounded-md bg-ink/80 px-1 py-0.5 text-[10px] font-bold text-bg">
                        {s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name}
                        {s.localId ? ` · ${s.localId}` : ''}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="grid h-full place-items-center text-muted">
                    <Plus size={22} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={() => setPage(current - 1)}
          disabled={current === 0}
          aria-label="Page précédente"
          className="grid h-10 w-10 place-items-center rounded-full border border-line disabled:opacity-30"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-semibold">
          Page {current + 1} / {pages}
        </span>
        <button
          onClick={() => setPage(current + 1)}
          disabled={current >= pages - 1}
          aria-label="Page suivante"
          className="grid h-10 w-10 place-items-center rounded-full border border-line disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => setPicker({ at: null })} className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 font-bold text-primary-ink">
          <Plus size={18} /> Ajouter des cartes
        </button>
        <button
          onClick={() => {
            setSlots([...binder.slots, ...new Array(binder.perPage).fill(null)])
            setPage(pages)
          }}
          className="flex items-center justify-center gap-2 rounded-2xl border border-line py-2.5 font-semibold"
        >
          <Plus size={18} /> Ajouter une page
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted">Touche une case pour ajouter, voir, déplacer ou retirer une carte. Glisse pour tourner les pages.</p>

      {selected !== null && binder.slots[selected] && (
        <Sheet onClose={() => setSelected(null)} title={binder.slots[selected]!.name}>
          <p className="mb-3 text-sm text-muted">
            {binder.slots[selected]!.setName}
            {binder.slots[selected]!.localId ? ` · n° ${binder.slots[selected]!.localId}` : ''} ·{' '}
            {owned.has(binder.slots[selected]!.cardId) ? 'dans ta collection ✅' : 'pas encore dans ta collection'}
          </p>
          <div className="space-y-2">
            <SheetButton Icon={ExternalLink} label="Voir la fiche de la carte" onClick={() => navigate(`/carte/${encodeURIComponent(binder.slots[selected]!.cardId)}`)} />
            <SheetButton
              Icon={ArrowLeftRight}
              label="Déplacer"
              onClick={() => {
                setMoving(selected)
                setSelected(null)
              }}
            />
            <SheetButton
              Icon={Trash2}
              label="Retirer du classeur"
              tone="bad"
              onClick={() => {
                const slots = [...binder.slots]
                slots[selected] = null
                setSlots(slots)
                setSelected(null)
              }}
            />
          </div>
        </Sheet>
      )}

      {picker && (
        <CardPicker
          binder={binder}
          onClose={() => setPicker(null)}
          onPick={(cards) => {
            if (picker.at !== null && cards.length) {
              // Case choisie : la 1re carte y va, les autres à la suite dans les cases vides.
              const slots = [...binder.slots]
              slots[picker.at] = cards[0]
              updateBinder(binder.id, { slots })
              addToBinder(binder.id, cards.slice(1))
            } else addToBinder(binder.id, cards)
            setPicker(null)
          }}
        />
      )}

      {editing && (
        <EditBinder
          binder={binder}
          onClose={() => setEditing(false)}
          onSort={sortBinder}
          onDelete={() => {
            deleteBinder(binder.id)
            navigate('/collection', { replace: true })
          }}
        />
      )}
    </>
  )
}

function EditBinder({ binder, onClose, onSort, onDelete }: { binder: Binder; onClose: () => void; onSort: (m: SortMode) => void; onDelete: () => void }) {
  const [name, setName] = useState(binder.name)
  return (
    <Sheet onClose={onClose} title="Modifier le classeur">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Nom</span>
          <input
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && updateBinder(binder.id, { name: name.trim() })}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 outline-none focus:border-primary"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Couleur">
          {BINDER_COLORS.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={binder.color === c}
              aria-label={c}
              onClick={() => updateBinder(binder.id, { color: c })}
              className={`grid h-8 w-8 place-items-center rounded-full ${binder.color === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''}`}
              style={{ background: c }}
            >
              {binder.color === c && <Check size={14} className="text-white" />}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Format des pages">
          {PAGE_FORMATS.map((f) => (
            <button
              key={f.perPage}
              role="radio"
              aria-checked={binder.perPage === f.perPage}
              onClick={() => updateBinder(binder.id, { perPage: f.perPage, slots: padToPages(binder.slots, f.perPage) })}
              className={`rounded-xl border py-2 text-sm font-bold ${binder.perPage === f.perPage ? 'border-primary bg-primary-soft text-primary' : 'border-line'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div>
          <p className="mb-1 flex items-center gap-1 text-sm font-bold">
            <Sparkles size={16} /> Ranger automatiquement
          </p>
          <div className="flex flex-wrap gap-2">
            {FILL_ORDERS.map((o) => (
              <button key={o.id} onClick={() => onSort(o.id)} className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold">
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <SheetButton
            Icon={X}
            label="Retirer les cases vides"
            onClick={() => {
              updateBinder(binder.id, { slots: dropEmptyLastPage(compact(binder.slots, binder.perPage), binder.perPage) })
              onClose()
            }}
          />
          <SheetButton
            Icon={Trash2}
            label="Supprimer le classeur"
            tone="bad"
            onClick={() => confirm(`Supprimer « ${binder.name} » ? Tes cartes restent dans ta collection.`) && onDelete()}
          />
        </div>
      </div>
    </Sheet>
  )
}

// ---- Choisir des cartes ---------------------------------------------------------------

function CardPicker({ binder, onClose, onPick }: { binder: Binder; onClose: () => void; onPick: (cards: BinderSlot[]) => void }) {
  const rows = useOwnedRows()
  const [tab, setTab] = useState<'mine' | 'all'>('mine')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<BinderSlot[]>([])
  const [results, setResults] = useState<CardBrief[]>([])
  const [searching, setSearching] = useState(false)
  const inBinder = new Set(binder.slots.filter(Boolean).map((s) => s!.cardId))
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  useEffect(() => {
    if (tab !== 'all' || q.trim().length < 3) return setResults([])
    setSearching(true)
    const t = setTimeout(() => {
      searchByName(q.trim())
        .then((r) => setResults(r.slice(0, 60)))
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 400)
    return () => clearTimeout(t)
  }, [tab, q])

  const mine = rows
    .filter((r) => !q || norm(`${r.item.name} ${r.item.setName} ${r.item.localId}`).includes(norm(q)))
    .sort((a, b) => b.unit - a.unit)
    .map((r) => slotOfItem(r.item))
  const list: BinderSlot[] = tab === 'mine' ? mine : results.map((c) => slotOfBrief(c))
  const isPicked = (id: string) => picked.some((p) => p.cardId === id)
  const toggle = (s: BinderSlot) => setPicked(isPicked(s.cardId) ? picked.filter((p) => p.cardId !== s.cardId) : [...picked, s])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-label="Ajouter des cartes">
      <div className="pt-safe border-b border-line">
        <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-3">
          <button onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full border border-line">
            <X size={18} />
          </button>
          <h2 className="flex-1 font-extrabold">Ajouter des cartes</h2>
        </div>
        <div className="mx-auto max-w-xl space-y-2 px-4 pb-3">
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1 text-sm font-semibold">
            {(
              [
                ['mine', 'Mes cartes'],
                ['all', 'Toutes les cartes'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-xl py-2 ${tab === id ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}>
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 focus-within:border-primary">
            <Search size={18} className="shrink-0 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tab === 'mine' ? 'Chercher dans ma collection' : 'Nom de la carte (3 lettres minimum)'}
              aria-label="Chercher une carte"
              className="w-full min-w-0 bg-transparent py-2.5 outline-none placeholder:text-muted focus-visible:outline-none"
            />
          </label>
          {tab === 'all' && <p className="text-xs text-muted">Les cartes que tu n’as pas encore apparaîtront en gris dans le classeur.</p>}
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl flex-1 overflow-y-auto px-4 py-3">
        {tab === 'mine' && !rows.length && <p className="text-center text-muted">Ta collection est vide : passe par « Toutes les cartes ».</p>}
        {tab === 'all' && searching && <p className="text-center text-muted">Recherche…</p>}
        <div className="grid grid-cols-3 gap-2">
          {list.map((s) => (
            <button key={s.cardId} onClick={() => toggle(s)} className="relative text-left" aria-pressed={isPicked(s.cardId)}>
              <div className={`overflow-hidden rounded-lg ${isPicked(s.cardId) ? 'ring-4 ring-primary' : ''}`}>
                <CardImage image={s.image} cardId={s.cardId} alt={s.name} />
              </div>
              {isPicked(s.cardId) && (
                <span className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-ink">
                  <Check size={14} />
                </span>
              )}
              <p className="mt-1 truncate text-xs font-bold">{s.name}</p>
              <p className="truncate text-[11px] text-muted">{inBinder.has(s.cardId) ? 'Déjà dans le classeur' : (s.setName ?? s.cardId)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="pb-safe border-t border-line">
        <div className="mx-auto max-w-xl px-4 py-3">
          <button
            onClick={() => onPick(picked)}
            disabled={!picked.length}
            className="w-full rounded-2xl bg-primary py-3 font-bold text-primary-ink disabled:opacity-40"
          >
            {picked.length ? `Ajouter ${picked.length} carte${picked.length > 1 ? 's' : ''}` : 'Choisis des cartes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Depuis la fiche d'une carte --------------------------------------------------------

export function AddToBinder({ card }: { card: BinderSlot }) {
  const { binders } = useCollectionState()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const navigate = useNavigate()
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line py-3 font-semibold">
        <BookOpen size={20} /> {done ? `Ajoutée à « ${done} »` : 'Ranger dans un classeur'}
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)} title="Ranger dans un classeur">
          <div className="space-y-2">
            {binders.map((b) => {
              const already = b.slots.some((s) => s?.cardId === card.cardId)
              return (
                <button
                  key={b.id}
                  disabled={already}
                  onClick={() => {
                    addToBinder(b.id, [card])
                    setDone(b.name)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left font-semibold disabled:opacity-50"
                >
                  <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: b.color }} />
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  {already && <span className="text-xs text-muted">déjà dedans</span>}
                </button>
              )
            })}
            <SheetButton Icon={Plus} label="Nouveau classeur" onClick={() => navigate('/classeurs/nouveau')} />
          </div>
        </Sheet>
      )}
    </>
  )
}

// ---- Petits composants ------------------------------------------------------------------

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose} role="dialog" aria-label={title}>
      <div className="pb-safe mx-auto w-full max-w-xl rounded-t-3xl bg-surface p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate text-lg font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="Fermer" className="grid h-8 w-8 place-items-center rounded-full bg-surface-2">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function SheetButton({ Icon, label, onClick, tone }: { Icon: typeof Plus; label: string; onClick: () => void; tone?: 'bad' }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 font-semibold ${tone === 'bad' ? 'text-bad' : ''}`}>
      <Icon size={18} /> {label}
    </button>
  )
}
