import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Card, ScreenTitle } from '../components/ui'
import { api, useSession } from '../lib/api'

/** Statistiques de l'appli, réservées à l'administrateur (ADMIN_EMAILS sur le serveur). */

interface Day {
  day: string
  open: number
  visitor: number
  new: number
  scan: number
  signups: number
  logins: number
}

interface StatsResponse {
  totals: { users: number; collectors: number; cards: number; visitors30: number; scans30: number }
  days: Day[]
}

const shortDay = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })

export function StatsScreen() {
  const session = useSession()
  const [data, setData] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api<StatsResponse>('/admin/stats'))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) void fetchStats()
  }, [session, fetchStats])

  if (!session) return <Card>Connecte-toi pour voir les statistiques.</Card>

  const max = Math.max(1, ...(data?.days.map((d) => d.visitor) ?? [1]))
  const today = data?.days[0]

  return (
    <>
      <ScreenTitle title="Statistiques" subtitle="Visites anonymes, comptes et scans" />

      {error && (
        <Card className="mb-4">
          <p className="font-semibold">{error}</p>
        </Card>
      )}
      {!data && !error && <Card>Chargement… (le serveur peut mettre jusqu’à 1 minute à se réveiller)</Card>}

      {data && today && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Visiteurs aujourd’hui" value={today.visitor} />
            <Tile label="Visiteurs (30 jours)" value={data.totals.visitors30} />
            <Tile label="Comptes créés" value={data.totals.users} />
            <Tile label="Scans (30 jours)" value={data.totals.scans30} />
            <Tile label="Collectionneurs (avec cartes)" value={data.totals.collectors} />
            <Tile label="Cartes enregistrées" value={data.totals.cards} />
          </div>

          <Card className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold">30 derniers jours</h2>
              <button onClick={() => void fetchStats()} disabled={loading} aria-label="Actualiser" className="text-primary">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <p className="mb-3 text-xs text-muted">
              Visiteurs = personnes différentes dans la journée (dont nouvelles). Ouvertures = nombre de lancements de
              l’appli.
            </p>
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full text-right text-sm tabular-nums">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="px-1 py-1 text-left font-semibold">Jour</th>
                    <th className="px-1 font-semibold">Visiteurs</th>
                    <th className="px-1 font-semibold">Nouv.</th>
                    <th className="px-1 font-semibold">Ouv.</th>
                    <th className="px-1 font-semibold">Scans</th>
                    <th className="px-1 font-semibold">Comptes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.days.map((d) => (
                    <tr key={d.day}>
                      <td className="whitespace-nowrap px-1 py-1.5 text-left">{shortDay(d.day)}</td>
                      <td className="px-1">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="h-2 rounded-full bg-primary" style={{ width: `${(d.visitor / max) * 24}px` }} aria-hidden />
                          <b>{d.visitor}</b>
                        </div>
                      </td>
                      <td className="px-1">{d.new}</td>
                      <td className="px-1">{d.open}</td>
                      <td className="px-1">{d.scan}</td>
                      <td className="px-1">{d.signups}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="mt-3 text-center text-xs text-muted">
            Les personnes qui ont refusé les statistiques dans Réglages ne sont pas comptées.
          </p>
        </>
      )}
    </>
  )
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3">
      <p className="text-2xl font-extrabold tabular-nums">{value.toLocaleString('fr-FR')}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}
