import { ChevronDown, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CardImage } from '../components/CardThumb'
import { Card, ScreenTitle } from '../components/ui'
import { api, API_URL } from '../lib/api'
import { formatDate, formatEurCompact } from '../lib/format'
import { load, save } from '../lib/storage'

/**
 * Onglet Packs : comprendre les produits, choisir selon son objectif,
 * et comparer les extensions récentes (statistiques calculées par le serveur).
 */

interface StarCard {
  id: string
  name: string
  localId: string
  image?: string
  rarity?: string
  eur: number
}

export interface SetStats {
  id: string
  name: string
  logo?: string
  serie: string
  releaseDate: string
  official: number
  total: number
  priced: number
  top: StarCard[]
  over5: number
  over20: number
  secretAvg: number | null
  secretCount: number
  fullSetEur: number
}

interface PacksResponse {
  sets: SetStats[]
  updatedAt: string | null
  computing: boolean
}

const PRODUCTS = [
  { emoji: '🎴', name: 'Booster', price: '≈ 6 €', text: '10 cartes au hasard, dont au moins 1 rare. Le moins cher pour se faire plaisir.' },
  { emoji: '📦', name: 'Tripack', price: '≈ 18 €', text: '3 boosters + 1 carte promo brillante garantie.' },
  { emoji: '🎁', name: 'Coffret', price: '≈ 25 à 45 €', text: '4 à 6 boosters + 1 ou plusieurs cartes promo (souvent un gros Pokémon). Bonne idée cadeau.' },
  {
    emoji: '🧳',
    name: 'ETB (Coffret Dresseur d’élite)',
    price: '≈ 55 à 65 €',
    text: '9 boosters + accessoires (sleeves, dés, marqueurs, boîte de rangement) + 1 promo.',
  },
  { emoji: '🗃️', name: 'Display', price: '≈ 180 à 220 €', text: '36 boosters d’un coup. Le prix par booster le plus bas, pour les gros ouvreurs.' },
]

const GOALS = [
  {
    id: 'fun',
    label: '🎉 Le plaisir d’ouvrir',
    advice: [
      'Un booster ou un tripack de temps en temps suffit : c’est la surprise qui compte.',
      'Choisis une extension avec beaucoup de grosses cartes (badge 🔥 ci-dessous) : chaque booster a plus de chances de te faire vibrer.',
      'Fixe-toi un budget par mois : ouvrir des boosters coûte en moyenne plus cher que la valeur des cartes obtenues.',
    ],
  },
  {
    id: 'card',
    label: '🎯 Avoir une carte précise',
    advice: [
      'Achète-la à l’unité (Cardmarket, boutique) : c’est presque toujours beaucoup moins cher que d’ouvrir des boosters pour la tirer.',
      'Exemple : une carte star à 100 € peut demander des dizaines de boosters avant de sortir.',
      'Ajoute-la à ta wishlist (♡ sur sa fiche) pour suivre son prix.',
    ],
  },
  {
    id: 'set',
    label: '📚 Compléter une extension',
    advice: [
      'Ouvre quelques boosters (ou un ETB / une display) pour récupérer les cartes courantes à bas prix…',
      '… puis achète les cartes manquantes à l’unité. La ligne « Compléter à l’unité » donne une idée du budget total.',
      'Suis ta progression dans Collection → Extensions.',
    ],
  },
] as const

const DAY_MS = 86_400_000

/** Avis simple sur une extension, à partir de ses statistiques. */
export function verdict(s: SetStats, now = Date.now()): { emoji: string; label: string; text: string; tone: 'good' | 'warn' | 'info' } {
  const age = (now - new Date(s.releaseDate).getTime()) / DAY_MS
  if (age < 30 || s.over5 === 0)
    return {
      emoji: '🆕',
      label: 'Toute nouvelle',
      text: 'Les prix ne sont pas encore stables. Attends quelques semaines avant de juger (et d’acheter des cartes à l’unité).',
      tone: 'info',
    }
  const top = s.top[0]?.eur ?? 0
  const oneCard = s.fullSetEur > 0 && top / s.fullSetEur > 0.4
  if (s.over20 >= 10)
    return {
      emoji: '🔥',
      label: 'Beaucoup de grosses cartes',
      text: `${s.over20} cartes valent plus de 20 € : chaque booster a de bonnes chances de te faire plaisir.`,
      tone: 'good',
    }
  if (s.over20 <= 4)
    return {
      emoji: '💡',
      label: 'Peu de grosses cartes',
      text: oneCard
        ? `La valeur repose surtout sur ${top >= 100 ? 'une carte ultra rare' : 'quelques cartes'}, très dure à tirer : achète plutôt les cartes qui te plaisent à l’unité.`
        : 'Peu de cartes de valeur : pour une carte précise, achète-la plutôt à l’unité.',
      tone: 'warn',
    }
  return {
    emoji: '👍',
    label: 'Équilibrée',
    text: `${s.over20} cartes à plus de 20 € et ${s.over5} à plus de 5 € : un bon équilibre.`,
    tone: 'info',
  }
}

const TONE = { good: 'bg-good/15 text-good', warn: 'bg-warn/15 text-warn', info: 'bg-primary-soft text-primary' }

export function PacksScreen() {
  const [goal, setGoal] = useState<(typeof GOALS)[number]['id']>('fun')
  const [showProducts, setShowProducts] = useState(false)
  const advice = GOALS.find((g) => g.id === goal)!

  return (
    <>
      <ScreenTitle title="Packs" subtitle="Quoi acheter, et dans quelle extension ?" />

      <Card>
        <button onClick={() => setShowProducts(!showProducts)} className="flex w-full items-center justify-between text-left">
          <h2 className="font-bold">Booster, coffret, display : c’est quoi ?</h2>
          <ChevronDown size={20} className={`shrink-0 transition ${showProducts ? 'rotate-180' : ''}`} />
        </button>
        {showProducts && (
          <>
            <ul className="mt-3 space-y-3">
              {PRODUCTS.map((p) => (
                <li key={p.name} className="flex gap-3">
                  <span className="text-2xl" aria-hidden>
                    {p.emoji}
                  </span>
                  <div>
                    <p className="font-bold">
                      {p.name} <span className="font-semibold text-muted">· {p.price}</span>
                    </p>
                    <p className="text-sm">{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Prix indicatifs constatés en boutique en France ; ils varient selon l’extension et le magasin.</p>
          </>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="mb-3 font-bold">Ton objectif</h2>
        <div role="radiogroup" aria-label="Objectif" className="flex flex-wrap gap-2">
          {GOALS.map((g) => (
            <button
              key={g.id}
              role="radio"
              aria-checked={goal === g.id}
              onClick={() => setGoal(g.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${goal === g.id ? 'bg-primary text-primary-ink' : 'bg-surface-2'}`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          {advice.advice.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Card>

      <WhereToBuy />

      <h2 className="mt-6 mb-2 text-lg font-extrabold">Extensions récentes</h2>
      <RecentSets />
    </>
  )
}

const MAPS_SHOPS = 'https://www.google.com/maps/search/' + encodeURIComponent('boutique cartes Pokémon')
const CARDMARKET = 'https://www.cardmarket.com/fr/Pokemon'

const WHERE = [
  {
    id: 'shops',
    label: '🏪 Boutiques spécialisées',
    items: [
      'Les magasins de jeux de cartes et de jeux de société : bons conseils, vrais produits, et souvent des tournois ou des ligues Pokémon pour échanger.',
      'Beaucoup vendent aussi des cartes à l’unité et rachètent les tiennes.',
    ],
    link: { href: MAPS_SHOPS, text: 'Boutiques près de chez moi' },
  },
  {
    id: 'stores',
    label: '🛒 Grands magasins',
    items: [
      'Fnac, Cultura, King Jouet, JouéClub, Micromania, et le rayon jouets des supermarchés (Leclerc, Carrefour, Auchan…).',
      'Pratique pour les boosters, tripacks et coffrets. Les nouveautés partent vite : passe le jour de la sortie.',
      'En ligne, achète sur le site officiel du magasin, ou un produit « vendu et expédié par » le site lui-même.',
    ],
  },
  {
    id: 'single',
    label: '🃏 Cartes à l’unité',
    items: [
      'Cardmarket : le grand site européen où des milliers de vendeurs (particuliers et boutiques) vendent leurs cartes. Ce sont les prix affichés dans l’appli.',
      'Regarde l’état de la carte (NM = comme neuve), la note du vendeur et le pays (frais de port).',
      'Sur la fiche d’une carte, le bouton « Acheter cette carte » ouvre directement ses offres.',
    ],
    link: { href: CARDMARKET, text: 'Ouvrir Cardmarket' },
  },
  {
    id: 'used',
    label: '🤝 Entre particuliers',
    items: [
      'Vinted, Leboncoin, brocantes, salons et conventions : on y fait de bonnes affaires…',
      '… mais c’est là qu’on trouve le plus de fausses cartes et de boosters déjà ouverts puis recollés.',
      'Pour une carte chère, demande des photos nettes recto-verso et paie par le système du site, jamais par virement direct.',
    ],
  },
] as const

function WhereToBuy() {
  const [tab, setTab] = useState<(typeof WHERE)[number]['id']>('shops')
  const w = WHERE.find((x) => x.id === tab)!
  return (
    <Card className="mt-4">
      <h2 className="mb-3 font-bold">Où acheter ?</h2>
      <div role="radiogroup" aria-label="Où acheter" className="flex flex-wrap gap-2">
        {WHERE.map((x) => (
          <button
            key={x.id}
            role="radio"
            aria-checked={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${tab === x.id ? 'bg-primary text-primary-ink' : 'bg-surface-2'}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        {w.items.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      {'link' in w && (
        <a
          href={w.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-line py-2.5 font-semibold"
        >
          {w.link.text} <ExternalLink size={16} />
        </a>
      )}
      <div className="mt-4 rounded-2xl bg-warn/15 px-3 py-2 text-sm">
        <p className="font-bold text-warn">⚠️ Attention aux faux</p>
        <p>
          Prix bien plus bas qu’ailleurs, emballage mal imprimé, carte trop brillante ou trop fine : méfie-toi. Un produit scellé neuf ne se vend
          jamais à moitié prix.
        </p>
      </div>
      <p className="mt-2 text-xs text-muted">DexValeur n’est lié à aucun de ces magasins ou sites et ne touche aucune commission.</p>
    </Card>
  )
}

function RecentSets() {
  const [data, setData] = useState<PacksResponse | null>(() => load<PacksResponse | null>('packs', null))
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchPacks = useCallback(async () => {
    if (!API_URL) return setError('Serveur non configuré.')
    setLoading(true)
    setError(null)
    try {
      const res = await api<PacksResponse>('/packs')
      setData(res)
      if (res.sets.length) save('packs', res)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPacks()
  }, [fetchPacks])

  // Premier calcul en cours sur le serveur : on redemande toutes les 15 s.
  useEffect(() => {
    if (!data?.computing || data.sets.length) return
    const t = setTimeout(() => void fetchPacks(), 15_000)
    return () => clearTimeout(t)
  }, [data, fetchPacks])

  if (!data?.sets.length) {
    return (
      <Card>
        {error ? (
          <>
            <p className="font-semibold">Impossible de charger les extensions.</p>
            <p className="text-sm text-muted">{error}</p>
            <button onClick={() => void fetchPacks()} className="mt-3 flex items-center gap-2 font-bold text-primary">
              <RefreshCw size={16} /> Réessayer
            </button>
          </>
        ) : (
          <p className="text-muted">
            {loading && !data
              ? 'Chargement… (le serveur peut mettre jusqu’à 1 minute à se réveiller)'
              : 'Le serveur prépare les statistiques des extensions (environ 1 minute)…'}
          </p>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {data.sets.map((s) => (
        <SetCard key={s.id} s={s} />
      ))}
      <p className="text-center text-xs text-muted">
        Prix Cardmarket (carte à l’unité, état Near Mint){data.updatedAt ? `, mis à jour le ${formatDate(data.updatedAt)}` : ''}.
        {error ? ' Hors ligne : dernières données connues.' : ''}
      </p>
    </div>
  )
}

function SetCard({ s }: { s: SetStats }) {
  const v = verdict(s)
  return (
    <Card>
      <div className="flex items-center gap-3">
        {s.logo && (
          <img
            src={`${s.logo}.webp`}
            alt=""
            className="h-10 w-20 shrink-0 object-contain"
            loading="lazy"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        )}
        <div className="min-w-0">
          <h3 className="truncate font-extrabold">{s.name}</h3>
          <p className="text-xs text-muted">
            Sortie le {formatDate(s.releaseDate)} · {s.total} cartes
          </p>
        </div>
      </div>

      <div className={`mt-3 rounded-2xl px-3 py-2 ${TONE[v.tone]}`}>
        <p className="font-bold">
          {v.emoji} {v.label}
        </p>
        <p className="text-sm text-ink">{v.text}</p>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Cartes à + de 20 €" value={String(s.over20)} />
        <Stat label="Carte hors série (moy.)" value={s.secretAvg !== null ? formatEurCompact(s.secretAvg) : '—'} />
        <Stat label="Compléter à l’unité" value={formatEurCompact(s.fullSetEur)} />
      </dl>

      {s.top.length > 0 && (
        <>
          <p className="mt-4 mb-2 text-sm font-bold">Cartes stars</p>
          <div className="grid grid-cols-3 gap-2">
            {s.top.slice(0, 3).map((c) => (
              <Link key={c.id} to={`/carte/${encodeURIComponent(c.id)}`} className="block">
                <CardImage image={c.image} cardId={c.id} alt={c.name} />
                <p className="mt-1 truncate text-xs font-bold">{c.name}</p>
                <p className="text-[11px] text-muted">
                  n° {c.localId} · <b className="text-ink">{formatEurCompact(c.eur)}</b>
                </p>
              </Link>
            ))}
          </div>
        </>
      )}

      <Link
        to={`/collection/extension/${encodeURIComponent(s.id)}`}
        className="mt-3 flex items-center justify-center gap-1 rounded-2xl border border-line py-2.5 font-semibold"
      >
        Voir toutes les cartes <ChevronRight size={18} />
      </Link>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-1 py-2">
      <dd className="text-lg font-extrabold">{value}</dd>
      <dt className="text-[11px] leading-tight text-muted">{label}</dt>
    </div>
  )
}
