import { MessageCircle, Plus, Search, Store, Tag, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ListingPhoto, ListingTile, LoginGate, MemberAvatar, Spinner, StatusBadge } from '../components/market'
import { Card } from '../components/ui'
import { API_URL, useSession } from '../lib/api'
import { timeAgo } from '../lib/format'
import { cleanTag, fetchChats, fetchListings, priceLabel, refreshUnread, useUnread, type ChatSummary, type Listing } from '../lib/market'

/**
 * Onglet Vendre, façon Vinted : trois vues en haut de l'écran.
 * - Annonces : toutes les annonces des membres, avec recherche et #hashtags ;
 * - Mes annonces : celles que j'ai publiées ;
 * - Messages : mes discussions avec acheteurs et vendeurs.
 */

type View = 'annonces' | 'mes' | 'messages'

// Dernier résultat gardé en mémoire : au retour d'une annonce, la liste s'affiche tout de suite.
const cache = new Map<string, { listings: Listing[]; next: string | null }>()

export function SellScreen() {
  const [params, setParams] = useSearchParams()
  const view = (params.get('vue') as View) || 'annonces'
  const unread = useUnread()

  const go = (v: View) => setParams(v === 'annonces' ? {} : { vue: v }, { replace: true })

  if (!API_URL) {
    return <Card>La vente entre membres a besoin du serveur DexValeur, qui n’est pas configuré ici.</Card>
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Vendre</h1>
      </div>

      <div role="tablist" data-tour="sell-tabs" className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
        {(
          [
            ['annonces', 'Annonces', Store],
            ['mes', 'Mes annonces', Tag],
            ['messages', 'Messages', MessageCircle],
          ] as const
        ).map(([v, label, Icon]) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => go(v)}
            className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-bold whitespace-nowrap transition sm:text-sm ${view === v ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}
          >
            <Icon size={16} className="hidden shrink-0 min-[400px]:block" /> {label}
            {v === 'messages' && unread > 0 && (
              <span className="absolute -top-1 right-1 grid h-5 min-w-5 place-items-center rounded-full bg-bad px-1 text-[11px] text-white">{unread}</span>
            )}
          </button>
        ))}
      </div>

      {view === 'annonces' && <Feed />}
      {view === 'mes' && <MyListings />}
      {view === 'messages' && <Inbox />}

      {view !== 'messages' && (
        <Link
          to="/vendre/nouvelle"
          data-tour="sell-new"
          className="fixed right-4 bottom-[calc(80px+env(safe-area-inset-bottom))] z-10 flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 font-bold text-primary-ink shadow-lg active:scale-95 sm:right-[calc(50%-17rem)]"
        >
          <Plus size={20} /> Vendre une carte
        </Link>
      )}
    </>
  )
}

// ---- Toutes les annonces --------------------------------------------------------

function Feed() {
  const [params, setParams] = useSearchParams()
  const tag = params.get('tag') ?? ''
  const seller = params.get('vendeur') ?? ''
  const sellerName = params.get('nom') ?? ''
  const [q, setQ] = useState(params.get('q') ?? '')
  const query = params.get('q') ?? ''
  const key = JSON.stringify({ tag, seller, query })
  const [data, setData] = useState(cache.get(key) ?? null)
  const [error, setError] = useState<string | null>(null)
  const [more, setMore] = useState(false)

  useEffect(() => {
    let live = true
    setData(cache.get(key) ?? null)
    setError(null)
    fetchListings({ q: query, tag, seller })
      .then((d) => {
        cache.set(key, d)
        if (live) setData(d)
      })
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [key, query, tag, seller])

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = q.trim()
    // « #dracaufeu » tapé dans la recherche = filtre par hashtag.
    if (text.startsWith('#') && !text.includes(' ')) {
      setQ('')
      update({ tag: cleanTag(text), q: '' })
    } else update({ q: text })
  }

  // Hashtags les plus utilisés dans les annonces affichées : raccourcis cliquables.
  const popular = useMemo(() => {
    const n = new Map<string, number>()
    for (const l of data?.listings ?? []) for (const t of l.hashtags) n.set(t, (n.get(t) ?? 0) + 1)
    const top = [...n.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
    const defaults = ['dracaufeu', 'pikachu', 'ex', 'japonaise', 'gradee', 'lot', 'holo']
    return [...new Set([...top, ...defaults])].filter((t) => t !== tag).slice(0, 10)
  }, [data, tag])

  const loadMore = async () => {
    if (!data?.next) return
    setMore(true)
    try {
      const d = await fetchListings({ q: query, tag, seller, before: data.next })
      const merged = { listings: [...data.listings, ...d.listings], next: d.next }
      cache.set(key, merged)
      setData(merged)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setMore(false)
    }
  }

  return (
    <>
      <form onSubmit={submit} data-tour="sell-search" className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une carte, un #hashtag…"
          enterKeyHint="search"
          className="w-full rounded-2xl border border-line bg-surface py-3 pr-3 pl-10"
        />
      </form>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {seller && (
          <Chip active onClick={() => update({ vendeur: '', nom: '' })}>
            Annonces de {sellerName || 'ce membre'} <X size={14} />
          </Chip>
        )}
        {query && (
          <Chip active onClick={() => (setQ(''), update({ q: '' }))}>
            « {query} » <X size={14} />
          </Chip>
        )}
        {tag && (
          <Chip active onClick={() => update({ tag: '' })}>
            #{tag} <X size={14} />
          </Chip>
        )}
        {popular.map((t) => (
          <Chip key={t} onClick={() => update({ tag: t })}>
            #{t}
          </Chip>
        ))}
      </div>

      {error && !data && <Card>{error}</Card>}
      {!data && !error && <Spinner text="Chargement des annonces… (le serveur peut mettre 1 minute à se réveiller)" />}
      {data && data.listings.length === 0 && (
        <Card className="text-center">
          <p className="text-4xl" aria-hidden>
            🔍
          </p>
          <p className="mt-2 font-bold">{tag || query || seller ? 'Aucune annonce trouvée' : 'Aucune annonce pour le moment'}</p>
          <p className="mt-1 text-sm text-muted">Sois le premier : appuie sur « Vendre une carte » en bas de l’écran.</p>
        </Card>
      )}
      {data && data.listings.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {data.listings.map((l) => (
            <ListingTile key={l.id} listing={l} />
          ))}
        </div>
      )}
      {data?.next && (
        <button onClick={() => void loadMore()} disabled={more} className="mt-4 w-full rounded-2xl border border-line bg-surface py-3 font-bold text-primary">
          {more ? 'Chargement…' : 'Voir plus d’annonces'}
        </button>
      )}
    </>
  )
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${
        active ? 'border-primary bg-primary text-primary-ink' : 'border-line bg-surface text-ink'
      }`}
    >
      {children}
    </button>
  )
}

// ---- Mes annonces ---------------------------------------------------------------

function MyListings() {
  const session = useSession()
  const [list, setList] = useState<Listing[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    fetchListings({ mine: true })
      .then((d) => setList(d.listings))
      .catch((e: Error) => setError(e.message))
  }, [session])

  if (!session) return <LoginGate text="Connecte-toi pour publier et retrouver tes annonces." />
  if (error) return <Card>{error}</Card>
  if (!list) return <Spinner />
  if (!list.length)
    return (
      <Card className="text-center">
        <p className="text-4xl" aria-hidden>
          📸
        </p>
        <p className="mt-2 font-bold">Tu n’as pas encore d’annonce</p>
        <p className="mt-1 text-sm text-muted">Prends ta carte en photo, mets un prix et quelques #hashtags : c’est en ligne en 1 minute.</p>
      </Card>
    )

  const groups: [string, Listing[]][] = [
    ['En ligne', list.filter((l) => l.status !== 'vendue')],
    ['Vendues', list.filter((l) => l.status === 'vendue')],
  ]
  return (
    <>
      {groups.map(
        ([title, items]) =>
          items.length > 0 && (
            <section key={title} className="mb-5">
              <h2 className="mb-2 font-bold">
                {title} <span className="text-muted">({items.length})</span>
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {items.map((l) => (
                  <ListingTile key={l.id} listing={l} />
                ))}
              </div>
            </section>
          ),
      )}
    </>
  )
}

// ---- Messages -------------------------------------------------------------------

function Inbox() {
  const session = useSession()
  const [chats, setChats] = useState<ChatSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    let live = true
    const load = () =>
      fetchChats()
        .then((d) => {
          if (!live) return
          setChats(d.chats)
          setError(null)
          void refreshUnread()
        })
        .catch((e: Error) => live && setError(e.message))
    void load()
    const t = setInterval(() => document.visibilityState === 'visible' && void load(), 15_000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [session])

  if (!session) return <LoginGate text="Connecte-toi pour discuter avec les vendeurs et les acheteurs." />
  if (error && !chats) return <Card>{error}</Card>
  if (!chats) return <Spinner />
  if (!chats.length)
    return (
      <Card className="text-center">
        <p className="text-4xl" aria-hidden>
          💬
        </p>
        <p className="mt-2 font-bold">Aucun message</p>
        <p className="mt-1 text-sm text-muted">Une annonce te plaît ? Ouvre-la et appuie sur « Discuter ». Tes discussions apparaîtront ici.</p>
      </Card>
    )

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
      {chats.map((c) => (
        <li key={c.id}>
          <Link to={`/vendre/chat/${c.id}`} className="flex items-center gap-3 p-3 active:bg-surface-2">
            <div className="relative shrink-0">
              <ListingPhoto listing={{ ...c.listing }} className="h-14 w-14 rounded-xl" />
              <span className="absolute -right-1.5 -bottom-1.5 rounded-full ring-2 ring-surface">
                <MemberAvatar member={c.other} size={26} />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className={`truncate ${c.unread ? 'font-extrabold' : 'font-bold'}`}>{c.other.pseudo}</p>
                <span className="ml-auto shrink-0 text-xs text-muted">{timeAgo(new Date(c.lastAt).getTime())}</span>
              </div>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                <span className="truncate">{c.listing.title}</span> · <span className="shrink-0">{priceLabel(c.listing)}</span>
                <StatusBadge status={c.listing.status} />
              </p>
              <p className={`truncate text-sm ${c.unread ? 'font-semibold text-ink' : 'text-muted'}`}>
                {c.lastMessage ? `${c.lastFromMe ? 'Toi : ' : ''}${c.lastMessage}` : 'Écris ton premier message…'}
              </p>
            </div>
            {c.unread > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-bad px-1.5 text-xs font-bold text-white">{c.unread}</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}
