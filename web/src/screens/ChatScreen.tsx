import { ArrowLeft, Ban, Send, ShieldAlert } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ListingPhoto, LoginGate, MemberAvatar, Spinner, StatusBadge } from '../components/market'
import { Card } from '../components/ui'
import { useSession } from '../lib/api'
import { blockUser, fetchChat, priceLabel, refreshUnread, sendMessage, unblockUser, type ChatSummary, type Message } from '../lib/market'

const QUICK = ['Bonjour ! Elle est toujours disponible ?', 'Tu ferais un petit prix ?', 'Échange possible ?', 'Tu peux envoyer une photo du dos ?']

/** Discussion privée entre l'acheteur et le vendeur d'une annonce. Nouveaux messages vérifiés toutes les 4 s. */
export function ChatScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const session = useSession()
  const [chat, setChat] = useState<ChatSummary | null>(null)
  const [blocked, setBlocked] = useState<'moi' | 'lui' | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const lastId = useRef(0)
  const bottom = useRef<HTMLDivElement>(null)

  const poll = useCallback(async () => {
    try {
      const d = await fetchChat(id, lastId.current)
      setChat(d.chat)
      setBlocked(d.blocked)
      if (d.messages.length) {
        lastId.current = d.messages[d.messages.length - 1].id
        setMessages((m) => {
          const known = new Set(m.map((x) => x.id))
          return [...m, ...d.messages.filter((x) => !known.has(x.id))]
        })
        void refreshUnread()
      }
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [id])

  useEffect(() => {
    if (!session) return
    lastId.current = 0
    setMessages([])
    void poll()
    const t = setInterval(() => document.visibilityState === 'visible' && void poll(), 4000)
    return () => clearInterval(t)
  }, [session, poll])

  useLayoutEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  if (!session) return <LoginGate text="Connecte-toi pour voir tes messages." />
  if (!chat) return error ? <Card>{error}</Card> : <Spinner />

  const send = async (body: string) => {
    const b = body.trim()
    if (!b || sending) return
    setSending(true)
    try {
      const { message } = await sendMessage(id, b)
      lastId.current = Math.max(lastId.current, message.id)
      setMessages((m) => [...m, message])
      setText('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const toggleBlock = async () => {
    if (blocked === 'moi') {
      await unblockUser(chat.other.id)
      setBlocked(null)
    } else if (confirm(`Bloquer ${chat.other.pseudo} ? Vous ne pourrez plus vous écrire et vous ne verrez plus vos annonces.`)) {
      await blockUser(chat.other.id)
      setBlocked('moi')
    }
  }

  return (
    <div className="pb-36">
      {/* En-tête : membre + annonce */}
      <div className="sticky top-14 z-10 -mx-4 -mt-4 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/vendre?vue=messages')} aria-label="Retour aux messages" className="grid h-9 w-9 place-items-center rounded-full">
            <ArrowLeft size={20} />
          </button>
          <MemberAvatar member={chat.other} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{chat.other.pseudo}</p>
            <p className="text-xs text-muted">{chat.role === 'acheteur' ? 'Vendeur' : 'Intéressé par ton annonce'}</p>
          </div>
          <button onClick={() => void toggleBlock()} className="flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted">
            <Ban size={14} /> {blocked === 'moi' ? 'Débloquer' : 'Bloquer'}
          </button>
        </div>
        <Link to={`/vendre/annonce/${chat.listing.id}`} className="mt-2 flex items-center gap-2 rounded-2xl border border-line bg-surface p-1.5">
          <ListingPhoto listing={{ ...chat.listing }} className="h-11 w-11 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{chat.listing.title}</p>
            <p className="flex items-center gap-1.5 text-sm font-extrabold text-primary">
              {priceLabel(chat.listing)} <StatusBadge status={chat.listing.status} />
            </p>
          </div>
        </Link>
      </div>

      <p className="mx-auto mt-4 flex max-w-sm items-start gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-xs text-muted">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-warn" />
        Ne partage jamais ton code de connexion ni tes coordonnées bancaires. Pour un paiement à distance, préfère un moyen avec protection acheteur. En cas de souci, signale l’annonce.
      </p>

      <ul className="mt-4 space-y-1.5">
        {messages.map((m, i) => {
          const day = new Date(m.at).toDateString()
          const newDay = i === 0 || new Date(messages[i - 1].at).toDateString() !== day
          return (
            <li key={m.id}>
              {newDay && <p className="my-3 text-center text-xs font-semibold text-muted">{dayLabel(m.at)}</p>}
              <div className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 whitespace-pre-wrap shadow-sm ${
                    m.mine ? 'rounded-br-md bg-primary text-primary-ink' : 'rounded-bl-md border border-line bg-surface'
                  }`}
                >
                  {m.body}
                  <span className={`mt-0.5 block text-right text-[10px] ${m.mine ? 'text-primary-ink/70' : 'text-muted'}`}>
                    {new Date(m.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <div ref={bottom} />

      {/* Zone de saisie, collée au-dessus des onglets */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 mx-auto max-w-xl border-t border-line bg-bg/95 px-3 pt-2 pb-2 backdrop-blur">
        {blocked ? (
          <p className="py-2 text-center text-sm font-semibold text-muted">
            {blocked === 'moi' ? `Tu as bloqué ${chat.other.pseudo}.` : 'Tu ne peux plus écrire à ce membre.'}
          </p>
        ) : (
          <>
            {messages.length === 0 && (
              <div className="-mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3">
                {QUICK.map((q) => (
                  <button key={q} onClick={() => void send(q)} className="shrink-0 rounded-full border border-primary/40 bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary">
                    {q}
                  </button>
                ))}
              </div>
            )}
            {error && <p className="mb-1 text-center text-xs font-semibold text-bad">{error}</p>}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void send(text)
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
                    e.preventDefault()
                    void send(text)
                  }
                }}
                rows={1}
                maxLength={1000}
                placeholder="Écris ton message…"
                className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-surface px-3 py-2.5"
              />
              <button type="submit" disabled={!text.trim() || sending} aria-label="Envoyer" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-ink disabled:opacity-50">
                <Send size={18} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Aujourd’hui'
  if (d.toDateString() === yest.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
