import { ExternalLink, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CardImage } from '../components/CardThumb'
import { Card, ScreenTitle } from '../components/ui'
import { api, API_URL } from '../lib/api'
import { useCollectionState } from '../lib/collection'
import { formatDate, formatEurCompact } from '../lib/format'
import { load, save } from '../lib/storage'

/** Onglet Actus : sorties récentes, prix qui bougent, articles, liens utiles. */

interface StarCard {
  id: string
  name: string
  localId: string
  image?: string
  eur: number
}

interface Mover extends StarCard {
  setName: string
  change: number
}

interface Release {
  id: string
  name: string
  logo?: string
  releaseDate: string
  total: number
  top: StarCard | null
}

interface Article {
  source: string
  title: string
  link: string
  date: string
  summary: string
  image?: string
}

interface NewsResponse {
  releases: Release[]
  up: Mover[]
  down: Mover[]
  articles: Article[]
}

const LINKS = [
  { name: 'Pokécardex', url: 'https://www.pokecardex.com', text: 'Le site français des cartes : actus, spoilers et listes des extensions.' },
  { name: 'Site officiel Pokémon (JCC)', url: 'https://www.pokemon.com/fr/jcc-pokemon', text: 'Annonces officielles des prochaines extensions.' },
  { name: 'Pokébip', url: 'https://www.pokebip.com', text: 'Toute l’actualité Pokémon (jeux, cartes, événements).' },
]

function daysAgo(iso: string): string {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d < 0) return `dans ${-d} jour${d < -1 ? 's' : ''}`
  if (d === 0) return 'aujourd’hui'
  if (d < 60) return `il y a ${d} jour${d > 1 ? 's' : ''}`
  return `il y a ${Math.round(d / 30)} mois`
}

export function NewsScreen() {
  const [data, setData] = useState<NewsResponse | null>(() => load<NewsResponse | null>('news', null))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { collection, wishlist } = useCollectionState()
  const owned = new Set(collection.map((c) => c.cardId))
  const wished = new Set(wishlist.map((w) => w.cardId))

  const fetchNews = useCallback(async () => {
    if (!API_URL) return setError('Serveur non configuré.')
    setLoading(true)
    setError(null)
    try {
      const res = await api<NewsResponse>('/news')
      setData(res)
      if (res.releases.length) save('news', res)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchNews()
  }, [fetchNews])

  const empty = !data || (!data.releases.length && !data.up.length && !data.down.length)

  return (
    <>
      <ScreenTitle title="Actus" subtitle="Sorties, prix qui bougent et actualités des cartes" />

      {empty && (
        <Card>
          {error ? (
            <>
              <p className="font-semibold">Impossible de charger les actus.</p>
              <p className="text-sm text-muted">{error}</p>
              <button onClick={() => void fetchNews()} className="mt-3 flex items-center gap-2 font-bold text-primary">
                <RefreshCw size={16} /> Réessayer
              </button>
            </>
          ) : (
            <p className="text-muted">
              {loading ? 'Chargement… (le serveur peut mettre jusqu’à 1 minute à se réveiller)' : 'Le serveur prépare les actus. Ouvre l’onglet Packs puis reviens dans 1 minute.'}
            </p>
          )}
        </Card>
      )}

      {data && data.releases.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-extrabold">🗓️ Sorties récentes</h2>
          <div className="space-y-2">
            {data.releases.map((r) => (
              <Link
                key={r.id}
                to={`/collection/extension/${encodeURIComponent(r.id)}`}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3"
              >
                <div className="grid h-10 w-20 shrink-0 place-items-center">
                  {r.logo && (
                    <img
                      src={`${r.logo}.webp`}
                      alt=""
                      className="max-h-10 object-contain"
                      loading="lazy"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{r.name}</p>
                  <p className="text-xs text-muted">
                    Sortie le {formatDate(r.releaseDate)} · {daysAgo(r.releaseDate)}
                  </p>
                  {Date.now() - new Date(r.releaseDate).getTime() < 30 * 86_400_000 ? (
                    <p className="truncate text-xs">🆕 Toute nouvelle : prix pas encore stables</p>
                  ) : (
                    r.top && (
                      <p className="truncate text-xs">
                        ⭐ {r.top.name} · <b>{formatEurCompact(r.top.eur)}</b>
                      </p>
                    )
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data && (data.up.length > 0 || data.down.length > 0) && (
        <section className="mt-6">
          <h2 className="text-lg font-extrabold">💶 Prix de la semaine</h2>
          <p className="mb-2 text-sm text-muted">Prix moyen des 7 derniers jours comparé à celui du mois (Cardmarket, cartes à 5 € ou plus).</p>
          <Movers title="En hausse" Icon={TrendingUp} tone="text-good" items={data.up} owned={owned} wished={wished} />
          <Movers title="En baisse" Icon={TrendingDown} tone="text-bad" items={data.down} owned={owned} wished={wished} />
        </section>
      )}

      {data && data.articles.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-lg font-extrabold">📰 Articles</h2>
          <div className="space-y-2">
            {data.articles.map((a) => (
              <a key={a.link} href={a.link} target="_blank" rel="noopener noreferrer" className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
                {a.image && <img src={a.image} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover" loading="lazy" />}
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
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-extrabold">🔗 Suivre l’actualité des cartes</h2>
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
      </section>

      {error && !empty && <p className="mt-4 text-center text-xs text-muted">Hors ligne : dernières actus connues.</p>}
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
