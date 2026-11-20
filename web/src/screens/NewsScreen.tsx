import { ExternalLink, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Card } from '../components/ui'
import { api, API_URL } from '../lib/api'
import { formatDate } from '../lib/format'
import { load, save } from '../lib/storage'

/** Bas de l'onglet Packs : les derniers articles sur les cartes et les sites à suivre. */

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
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchNews = useCallback(async () => {
    if (!API_URL) return
    setLoading(true)
    setError(null)
    try {
      const res = await api<{ articles: Article[] }>('/news')
      setArticles(res.articles)
      if (res.articles.length) save('newsArticles', res.articles)
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
