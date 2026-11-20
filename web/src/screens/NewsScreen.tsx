import { ExternalLink, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router'
import { CardImage } from '../components/CardThumb'
import { useCollectionState } from '../lib/collection'
import { useCallback, useEffect, useState } from 'react'
import { Card } from '../components/ui'
import { api, API_URL } from '../lib/api'
import { formatDate, formatEurCompact } from '../lib/format'
import { load, save } from '../lib/storage'

/** Bas de l'onglet Packs : prix de la semaine, derniers articles sur les cartes et sites à suivre. */

interface Mover {
  id: string
  name: string
  localId: string
  image?: string
  eur: number
  setName: string
  change: number
}

interface Article {
  source: string
  title: string
  link: string
  date: string
  summary: string
  image?: string
}

const LINKS = [
  { name: 'Pokécardex', url: 'https://www.pokecardex.com', text: 'Le site français des cartes : actus, spoilers et listes des extensions.' },
  { name: 'Site officiel Pokémon (JCC)', url: 'https://www.pokemon.com/fr/jcc-pokemon', text: 'Annonces officielles des prochaines extensions.' },
  { name: 'Pokébip', url: 'https://www.pokebip.com', text: 'Toute l’actualité Pokémon (jeux, cartes, événements).' },
]

export function NewsSection() {
  const [articles, setArticles] = useState<Article[]>(() => load<Article[]>('newsArticles', []))
  const [movers, setMovers] = useState<{ up: Mover[]; down: Mover[] }>(() => load('newsMovers', { up: [], down: [] }))
  const { collection, wishlist } = useCollectionState()
  const owned = new Set(collection.map((c) => c.cardId))
  const wished = new Set(wishlist.map((w) => w.cardId))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchNews = useCallback(async () => {
    if (!API_URL) return
    setLoading(true)
    setError(null)
    try {
      const res = await api<{ articles: Article[]; up: Mover[]; down: Mover[] }>('/news')
      setArticles(res.articles)
      if (res.articles.length) save('newsArticles', res.articles)
      setMovers({ up: res.up, down: res.down })
      if (res.up.length || res.down.length) save('newsMovers', { up: res.up, down: res.down })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchNews()
  }, [fetchNews])

  return (
    <>
      {(movers.up.length > 0 || movers.down.length > 0) && (
        <section className="mt-6">
          <h2 className="text-lg font-extrabold">💶 Prix de la semaine</h2>
          <p className="mb-2 text-sm text-muted">Prix moyen des 7 derniers jours comparé à celui du mois (Cardmarket, cartes à 5 € ou plus).</p>
          <Movers title="En hausse" Icon={TrendingUp} tone="text-good" items={movers.up} owned={owned} wished={wished} />
          <Movers title="En baisse" Icon={TrendingDown} tone="text-bad" items={movers.down} owned={owned} wished={wished} />
        </section>
      )}

      <h2 className="mt-6 mb-2 text-lg font-extrabold">📰 Articles</h2>
      {articles.length > 0 ? (
        <div className="space-y-2">
          {articles.map((a) => (
            <a key={a.link} href={a.link} target="_blank" rel="noopener noreferrer" className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
              {a.image && <img src={a.image} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover" loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />}
              <div className="min-w-0">
                <p className="font-bold">{a.title}</p>
                <p className="line-clamp-2 text-sm text-muted">{a.summary}</p>
                <p className="mt-1 text-xs text-muted">
                  {a.source} · {formatDate(a.date)}
                </p>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <Card>
          {error ? (
            <>
              <p className="font-semibold">Impossible de charger les articles.</p>
              <p className="text-sm text-muted">{error}</p>
              <button onClick={() => void fetchNews()} className="mt-3 flex items-center gap-2 font-bold text-primary">
                <RefreshCw size={16} /> Réessayer
              </button>
            </>
          ) : (
            <p className="text-muted">{loading ? 'Chargement… (le serveur peut mettre jusqu’à 1 minute à se réveiller)' : 'Pas d’article pour le moment.'}</p>
          )}
        </Card>
      )}
      {error && articles.length > 0 && <p className="mt-2 text-center text-xs text-muted">Hors ligne : derniers articles connus.</p>}

      <h2 className="mt-6 mb-2 text-lg font-extrabold">🔗 Sources : suivre l’actualité des cartes</h2>
      <Card>
        <ul className="space-y-3">
          {LINKS.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2">
                <ExternalLink size={18} className="mt-0.5 shrink-0 text-primary" />
                <span>
                  <b>{l.name}</b>
                  <span className="block text-sm text-muted">{l.text}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

function Movers({
  title,
  Icon,
  tone,
  items,
  owned,
  wished,
}: {
  title: string
  Icon: typeof TrendingUp
  tone: string
  items: Mover[]
  owned: Set<string>
  wished: Set<string>
}) {
  if (!items.length) return null
  return (
    <Card className="mb-3">
      <h3 className={`mb-2 flex items-center gap-1.5 font-bold ${tone}`}>
        <Icon size={18} /> {title}
      </h3>
      <ul className="divide-y divide-line">
        {items.map((m) => (
          <li key={m.id}>
            <Link to={`/carte/${encodeURIComponent(m.id)}`} className="flex items-center gap-3 py-2">
              <div className="w-11 shrink-0">
                <CardImage image={m.image} cardId={m.id} alt={m.name} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{m.name}</p>
                <p className="truncate text-xs text-muted">
                  {m.setName} · n° {m.localId}
                  {owned.has(m.id) && <span className="ml-1 font-bold text-good">· Tu l’as</span>}
                  {!owned.has(m.id) && wished.has(m.id) && <span className="ml-1 font-bold text-primary">· Wishlist</span>}
                </p>
              </div>
              <div className="text-right">
                <p className="font-extrabold">{formatEurCompact(m.eur)}</p>
                <p className={`text-sm font-bold ${tone}`}>
                  {m.change > 0 ? '+' : ''}
                  {m.change} %
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
