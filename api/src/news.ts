import type { Db } from './db/index.js'
import type { Mover, SetStats } from './packs.js'

/**
 * Onglet Actus :
 * - sorties : les extensions récentes (dates de TCGdex) ;
 * - prix : plus fortes hausses et baisses de la semaine (calculées avec les statistiques des packs) ;
 * - articles : actualités « cartes » du flux RSS de Pokébip (titre, résumé, lien vers l'article).
 */

const FEEDS = [{ source: 'Pokébip', url: 'https://www.pokebip.com/news.rss' }]
const FEED_TTL = 3 * 3_600_000

// Articles qui parlent du jeu de cartes physique (pas Pokémon Pocket, GO, Sleep…).
const CARD_WORDS = /\b(JCC|cartes?|extensions?|boosters?|display|coffrets?|ETB|Dresseur d.élite|TCG)\b/i
const OTHER_GAMES = /\b(numériques?|Distributions?|Pocket|Pokémon GO|Sleep|Pokopia|Champions|Légendes|Écarlate et Violet :|Masters|Unite|Café)\b/i

export interface Article {
  source: string
  title: string
  link: string
  date: string
  summary: string
  image?: string
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const tag = (item: string, name: string) => {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(item)
  return m ? decode(m[1]) : ''
}

/** Lecture simple d'un flux RSS (titre, lien, date, résumé, image). */
export function parseRss(xml: string, source: string): Article[] {
  const out: Article[] = []
  for (const m of xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const item = m[0]
    const title = tag(item, 'title')
    const link = tag(item, 'link')
    if (!title || !/^https:\/\//.test(link)) continue
    const date = new Date(tag(item, 'pubDate'))
    const summary = tag(item, 'description')
    const image = /<enclosure[^>]+url="(https:[^"]+)"/i.exec(item)?.[1]
    out.push({
      source,
      title,
      link,
      date: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
      summary: summary.length > 220 ? summary.slice(0, 217).trimEnd() + '…' : summary,
      image,
    })
  }
  return out
}

export const isCardNews = (a: Pick<Article, 'title' | 'summary'>) =>
  CARD_WORDS.test(`${a.title} ${a.summary}`) && !OTHER_GAMES.test(a.title)

let feedCache: { at: number; articles: Article[] } | null = null

async function cardArticles(fetchImpl: typeof fetch): Promise<Article[]> {
  if (feedCache && Date.now() - feedCache.at < FEED_TTL) return feedCache.articles
  const lists = await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const res = await fetchImpl(f.url, { signal: AbortSignal.timeout(10_000), headers: { 'user-agent': 'DexValeur/1.0 (lecteur RSS)' } })
        return res.ok ? parseRss(await res.text(), f.source) : []
      } catch {
        return []
      }
    }),
  )
  const articles = lists
    .flat()
    .filter(isCardNews)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 15)
  // On ne garde en cache que si au moins un flux a répondu (sinon on réessaiera).
  if (lists.some((l) => l.length)) feedCache = { at: Date.now(), articles }
  return articles
}

export async function buildNews(db: Db, fetchImpl: typeof fetch = fetch) {
  const rows = await db.query<{ data: SetStats & { rank: number } }>('SELECT data FROM pack_stats')
  const sets = rows.map((r) => r.data).sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
  const releases = sets.slice(0, 5).map((s) => ({ id: s.id, name: s.name, logo: s.logo, releaseDate: s.releaseDate, total: s.total, top: s.top[0] ?? null }))
  const movers: Mover[] = sets.flatMap((s) => s.movers ?? [])
  const up = movers.filter((m) => m.change > 0).sort((a, b) => b.change - a.change).slice(0, 6)
  const down = movers.filter((m) => m.change < 0).sort((a, b) => a.change - b.change).slice(0, 6)
  return { releases, up, down, articles: await cardArticles(fetchImpl) }
}

/** Pour les tests. */
export const resetNewsCache = () => {
  feedCache = null
}
