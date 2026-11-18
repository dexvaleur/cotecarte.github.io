import { Grid2x2, Heart, List, Minus, Plus, Search, SlidersHorizontal, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getSets } from '../api/tcgdex'
import type { SetBrief } from '../api/types'
import { AccountPanel } from '../components/AccountPanel'
import { decrement } from '../components/OwnedCopies'
import { CardImage } from '../components/CardThumb'
import { PriceChart } from '../components/PriceChart'
import { Card, ScreenTitle } from '../components/ui'
import { CONDITIONS, type ConditionCode, rarityInfo } from '../data/cardInfo'
import { useSession } from '../lib/api'
import { type CollectionItem, removeItem, removeWish, updateItem, useCollectionState } from '../lib/collection'
import { formatEur } from '../lib/format'
import { load, save } from '../lib/storage'
import { useCardPrices } from '../lib/useCardPrices'
import { recordLocalValue, useValueHistory } from '../lib/valueHistory'

type Tab = 'cards' | 'sets' | 'wish'
type Sort = 'value' | 'recent' | 'name' | 'set'
const VALUE_BUCKETS = [
  { id: 'all', label: 'Toutes', min: 0, max: Infinity },
  { id: 'lt1', label: '< 1 €', min: 0, max: 1 },
  { id: '1-10', label: '1 à 10 €', min: 1, max: 10 },
  { id: '10-50', label: '10 à 50 €', min: 10, max: 50 },
  { id: 'gt50', label: '> 50 €', min: 50, max: Infinity },
] as const

/** Valeur actuelle d'un exemplaire : prix du jour × coefficient d'état. */
function itemValue(item: CollectionItem, currentEur: number | null | undefined): number {
  const base = currentEur ?? item.priceEur ?? 0
  return base * CONDITIONS[item.condition].factor
}

export function CollectionScreen() {
  const { collection, wishlist } = useCollectionState()
  const session = useSession()
  const [tab, setTab] = useState<Tab>(() => load<Tab>('collectionTab', 'cards'))
  useEffect(() => save('collectionTab', tab), [tab])

  const ids = useMemo(() => collection.map((c) => c.cardId), [collection])
  const { prices, loading } = useCardPrices(ids)

  const count = collection.reduce((n, c) => n + c.quantity, 0)
  const total = collection.reduce((s, c) => s + itemValue(c, prices[c.cardId]?.eur) * c.quantity, 0)
  const pricesReady = !loading && ids.every((id) => id in prices)

  // Sans compte, on note la valeur du jour sur le téléphone pour tracer la courbe.
  useEffect(() => {
    if (pricesReady && collection.length) recordLocalValue(total)
  }, [pricesReady, total, collection.length])

  if (collection.length === 0 && wishlist.length === 0) return <Empty loggedIn={!!session} />

  return (
    <>
      <ScreenTitle title="Ma collection" />
      <ValueCard total={total} count={count} loading={loading} />

      {!session && (
        <Card className="mt-3">
          <AccountPanel compact />
        </Card>
      )}

      <div role="tablist" className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1 text-sm font-semibold">
        {(
          [
            ['cards', `Cartes (${count})`],
            ['sets', 'Extensions'],
            ['wish', `Wishlist (${wishlist.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-xl py-2 ${tab === id ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === 'cards' && <Cards items={collection} prices={prices} />}
        {tab === 'sets' && <SetsProgress items={collection} />}
        {tab === 'wish' && <Wishlist />}
      </div>
      {session && (
        <div className="mt-6">
          <AccountPanel compact />
        </div>
      )}
    </>
  )
}

function Empty({ loggedIn }: { loggedIn: boolean }) {
  return (
    <>
      <ScreenTitle title="Ma collection" />
      <Card className="text-center">
        <p className="text-5xl" aria-hidden>
          🗂️
        </p>
        <p className="mt-2 font-bold">Ta collection est vide</p>
        <p className="text-muted">Scanne une carte puis touche « Ajouter à ma collection » : elle apparaîtra ici avec sa valeur.</p>
        <Link to="/scanner" className="mt-4 inline-block rounded-2xl bg-primary px-5 py-3 font-bold text-primary-ink">
          Scanner une carte
        </Link>
      </Card>
      {!loggedIn && (
        <Card className="mt-4">
          <AccountPanel compact />
        </Card>
      )}
    </>
  )
}

function ValueCard({ total, count, loading }: { total: number; count: number; loading: boolean }) {
  const history = useValueHistory(90)
  const first = history[0]?.value
  const change = first ? ((total - first) / first) * 100 : null
  const points = history.map((p) => ({ label: `${p.day.slice(8, 10)}/${p.day.slice(5, 7)}`, value: p.value }))

  return (
    <Card className="bg-gradient-to-br from-primary to-[#b24cf5] text-white">
      <p className="text-sm font-semibold opacity-90">Valeur estimée de ta collection</p>
      <p className="text-4xl font-extrabold tracking-tight">{loading && total === 0 ? '…' : formatEur(total)}</p>
      <p className="text-sm opacity-90">
        {count} carte{count > 1 ? 's' : ''} · prix Cardmarket du jour, selon l’état
      </p>
      {change !== null && Math.abs(change) >= 0.5 && (
        <p className="mt-1 flex items-center gap-1 text-sm font-bold">
          {change > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {change > 0 ? '+' : ''}
          {change.toFixed(0)} % depuis le {history[0].day.slice(8, 10)}/{history[0].day.slice(5, 7)}
        </p>
      )}
      {points.length >= 2 ? (
        <div className="mt-2 rounded-2xl bg-white p-2 text-ink dark:bg-surface">
          <PriceChart points={points} />
        </div>
      ) : (
        <p className="mt-2 text-xs opacity-80">La courbe d’évolution apparaîtra au fil des jours.</p>
      )}
    </Card>
  )
}

function Cards({ items, prices }: { items: CollectionItem[]; prices: Record<string, { eur: number | null; rarity?: string; types?: string[] }> }) {
  const [view, setView] = useState<'grid' | 'list'>(() => load('collectionView', 'grid'))
  useEffect(() => save('collectionView', view), [view])
  const [q, setQ] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [setFilter, setSetFilter] = useState('')
  const [rarityFilter, setRarityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [bucket, setBucket] = useState<(typeof VALUE_BUCKETS)[number]['id']>('all')
  const [sort, setSort] = useState<Sort>('value')

  // Infos complétées par les prix du jour (rareté, types) pour les cartes anciennes.
  const rows = useMemo(
    () =>
      items.map((i) => {
        const p = prices[i.cardId]
        return {
          item: i,
          rarity: i.rarity ?? p?.rarity,
          types: i.types?.length ? i.types : (p?.types ?? []),
          unit: itemValue(i, p?.eur),
        }
      }),
    [items, prices],
  )

  const sets = [...new Map(rows.map((r) => [r.item.setId, r.item.setName])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const rarities = [...new Set(rows.map((r) => r.rarity).filter(Boolean) as string[])].sort()
  const types = [...new Set(rows.flatMap((r) => r.types))].sort()
  const top = [...rows].filter((r) => r.unit > 0).sort((a, b) => b.unit - a.unit).slice(0, 5)

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const b = VALUE_BUCKETS.find((v) => v.id === bucket)!
  const filtered = rows
    .filter((r) => !q || norm(`${r.item.name} ${r.item.setName} ${r.item.localId}`).includes(norm(q)))
    .filter((r) => !setFilter || r.item.setId === setFilter)
    .filter((r) => !rarityFilter || r.rarity === rarityFilter)
    .filter((r) => !typeFilter || r.types.includes(typeFilter))
    .filter((r) => r.unit >= b.min && r.unit < b.max)
    .sort((x, y) =>
      sort === 'value'
        ? y.unit - x.unit
        : sort === 'recent'
          ? y.item.addedAt.localeCompare(x.item.addedAt)
          : sort === 'name'
            ? x.item.name.localeCompare(y.item.name)
            : x.item.setName.localeCompare(y.item.setName) || x.item.localId.localeCompare(y.item.localId, 'fr', { numeric: true }),
    )
  const activeFilters = [setFilter, rarityFilter, typeFilter, bucket !== 'all' ? bucket : ''].filter(Boolean).length

  return (
    <>
      {top.length >= 2 && (
        <section className="mb-4">
          <h2 className="mb-2 font-bold">💎 Tes cartes les plus chères</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {top.map((r) => (
              <Link key={r.item.uid} to={`/carte/${encodeURIComponent(r.item.cardId)}`} className="w-24 shrink-0">
                <CardImage image={r.item.image} cardId={r.item.cardId} alt={r.item.name} />
                <p className="mt-1 truncate text-xs font-bold">{r.item.name}</p>
                <p className="text-xs font-extrabold text-primary">{formatEur(r.unit)}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line bg-surface px-3 focus-within:border-primary">
          <Search size={18} className="shrink-0 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher dans ma collection"
            aria-label="Chercher dans ma collection"
            className="w-full min-w-0 bg-transparent py-2.5 outline-none placeholder:text-muted focus-visible:outline-none"
          />
        </label>
        <button
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          aria-label="Filtres"
          className={`relative grid w-11 place-items-center rounded-2xl border ${showFilters ? 'border-primary text-primary' : 'border-line'}`}
        >
          <SlidersHorizontal size={18} />
          {activeFilters > 0 && (
            <span className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-ink">
              {activeFilters}
            </span>
          )}
        </button>
        <button
          onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
          aria-label={view === 'grid' ? 'Afficher en liste' : 'Afficher en grille'}
          className="grid w-11 place-items-center rounded-2xl border border-line"
        >
          {view === 'grid' ? <List size={18} /> : <Grid2x2 size={18} />}
        </button>
      </div>

      {showFilters && (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface p-3 text-sm">
          <Select label="Extension" value={setFilter} onChange={setSetFilter} options={sets.map(([id, name]) => [id, name])} />
          <Select label="Rareté" value={rarityFilter} onChange={setRarityFilter} options={rarities.map((r) => [r, rarityInfo(r).label])} />
          <Select label="Type" value={typeFilter} onChange={setTypeFilter} options={types.map((t) => [t, t])} />
          <Select
            label="Valeur"
            value={bucket === 'all' ? '' : bucket}
            onChange={(v) => setBucket((v || 'all') as typeof bucket)}
            options={VALUE_BUCKETS.filter((v) => v.id !== 'all').map((v) => [v.id, v.label])}
          />
          <Select
            label="Trier par"
            value={sort}
            onChange={(v) => setSort((v || 'value') as Sort)}
            options={[
              ['value', 'Valeur'],
              ['recent', 'Ajout récent'],
              ['name', 'Nom'],
              ['set', 'Extension'],
            ]}
            noAll
          />
          {activeFilters > 0 && (
            <button
              onClick={() => {
                setSetFilter('')
                setRarityFilter('')
                setTypeFilter('')
                setBucket('all')
              }}
              className="flex items-center justify-center gap-1 self-end rounded-xl py-2 font-semibold text-primary"
            >
              <X size={16} /> Effacer les filtres
            </button>
          )}
        </div>
      )}

      <p className="mt-3 mb-2 text-sm text-muted">
        {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
        {view === 'grid' && filtered.length > 0 && ' · touche une carte pour la retirer ou changer la quantité'}
      </p>

      {view === 'grid' ? (
        <div className="grid grid-cols-3 gap-2">
          {filtered.map(({ item, unit }) => (
            <Link key={item.uid} to={`/carte/${encodeURIComponent(item.cardId)}`} className="relative block">
              <CardImage image={item.image} cardId={item.cardId} alt={item.name} />
              {item.quantity > 1 && (
                <span className="absolute top-1 right-1 rounded-full bg-ink px-2 text-xs font-bold text-bg">×{item.quantity}</span>
              )}
              <p className="mt-1 truncate text-xs font-bold">{item.name}</p>
              <p className="text-[11px] text-muted">
                {CONDITIONS[item.condition].short} · <b className="text-ink">{formatEur(unit)}</b>
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map(({ item, unit }) => (
            <ItemRow key={item.uid} item={item} unit={unit} />
          ))}
        </ul>
      )}
    </>
  )
}

/** Ligne de la vue liste : on peut changer l'état, la quantité ou supprimer. */
function ItemRow({ item, unit }: { item: CollectionItem; unit: number }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-line bg-surface p-2">
      <Link to={`/carte/${encodeURIComponent(item.cardId)}`} className="w-14 shrink-0">
        <CardImage image={item.image} cardId={item.cardId} alt={item.name} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/carte/${encodeURIComponent(item.cardId)}`} className="block truncate font-bold">
          {item.name}
        </Link>
        <p className="truncate text-xs text-muted">
          {item.setName} · n° {item.localId}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <select
            value={item.condition}
            onChange={(e) => updateItem(item.uid, { condition: e.target.value as ConditionCode })}
            aria-label="État"
            className="rounded-lg border border-line bg-surface px-1.5 py-1 text-xs font-semibold"
          >
            {Object.entries(CONDITIONS).map(([code, c]) => (
              <option key={code} value={code}>
                {c.short} · {c.label}
              </option>
            ))}
          </select>
          <div className="flex items-center rounded-lg border border-line">
            <button onClick={() => decrement(item)} aria-label="Un de moins" className="px-1.5 py-1">
              <Minus size={14} />
            </button>
            <span className="min-w-5 text-center text-xs font-bold">{item.quantity}</span>
            <button onClick={() => updateItem(item.uid, { quantity: item.quantity + 1 })} aria-label="Un de plus" className="px-1.5 py-1">
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end justify-between">
        <p className="text-sm font-extrabold">{formatEur(unit * item.quantity)}</p>
        <button
          onClick={() => confirm(`Retirer ${item.name} de ta collection ?`) && removeItem(item.uid)}
          aria-label={`Retirer ${item.name}`}
          className="p-1 text-muted"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  noAll,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
  noAll?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl border border-line bg-surface px-2 py-2 font-semibold">
        {!noAll && <option value="">Toutes</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Progression par extension : combien de cartes différentes on a, sur le total. */
function SetsProgress({ items }: { items: CollectionItem[] }) {
  const [sets, setSets] = useState<SetBrief[] | null>(null)
  useEffect(() => {
    getSets('fr')
      .then(setSets)
      .catch(() => setSets([]))
  }, [])

  const groups = [...new Map(items.map((i) => [i.setId, i.setName])).entries()].map(([setId, setName]) => {
    const owned = new Set(items.filter((i) => i.setId === setId).map((i) => i.localId.replace(/^0+/, ''))).size
    const info = sets?.find((s) => s.id === setId)
    const total = info?.cardCount.official ?? 0
    return { setId, setName, owned, total, logo: info?.logo, pct: total ? Math.min(100, Math.round((owned / total) * 100)) : 0 }
  })
  groups.sort((a, b) => b.pct - a.pct || b.owned - a.owned)

  return (
    <ul className="space-y-2">
      {groups.map((g) => (
        <li key={g.setId}>
          <Link to={`/collection/extension/${encodeURIComponent(g.setId)}`} className="block rounded-2xl border border-line bg-surface p-3 active:scale-[.99]">
            <div className="flex items-center gap-3">
              {g.logo ? (
                <img src={`${g.logo}.webp`} alt="" className="h-8 w-16 object-contain" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
              ) : (
                <span className="h-8 w-16" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{g.setName}</p>
                <p className="text-xs text-muted">
                  {g.total ? `${g.owned} / ${g.total} cartes différentes` : `${g.owned} carte${g.owned > 1 ? 's' : ''} différente${g.owned > 1 ? 's' : ''}`}
                </p>
              </div>
              <span className="text-lg font-extrabold text-primary">{!sets ? '…' : g.total ? `${g.pct} %` : 'Promo'}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={g.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progression ${g.setName}`}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${g.pct}%` }} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Wishlist() {
  const { wishlist } = useCollectionState()
  const { prices } = useCardPrices(wishlist.map((w) => w.cardId))
  if (!wishlist.length) {
    return (
      <Card className="text-center">
        <Heart className="mx-auto text-bad" />
        <p className="mt-2 text-muted">Touche le ❤️ sur la fiche d’une carte pour l’ajouter à ta wishlist.</p>
      </Card>
    )
  }
  const total = wishlist.reduce((s, w) => s + (prices[w.cardId]?.eur ?? 0), 0)
  return (
    <>
      <p className="mb-2 text-sm text-muted">
        {wishlist.length} carte{wishlist.length > 1 ? 's' : ''} · budget estimé <b className="text-ink">{formatEur(total)}</b>
      </p>
      <div className="grid grid-cols-3 gap-2">
        {wishlist.map((w) => (
          <div key={w.cardId} className="relative">
            <Link to={`/carte/${encodeURIComponent(w.cardId)}`}>
              <CardImage image={w.image} cardId={w.cardId} alt={w.name} />
              <p className="mt-1 truncate text-xs font-bold">{w.name}</p>
              <p className="text-[11px] text-muted">{formatEur(prices[w.cardId]?.eur)}</p>
            </Link>
            <button
              onClick={() => removeWish(w.cardId)}
              aria-label={`Retirer ${w.name} de la wishlist`}
              className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-surface/90 shadow"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
