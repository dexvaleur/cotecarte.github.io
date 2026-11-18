import { CloudOff, LogOut, Mail, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { API_URL, deleteAccount, logout, requestCode, useSession, verifyCode } from '../lib/api'
import { clearLocal, importLocalThenSync, syncNow, useCollectionState } from '../lib/collection'
import { timeAgo } from '../lib/format'

/**
 * Connexion par email en 2 étapes (email → code à 6 chiffres), puis état de la synchronisation.
 * `compact` : version courte, affichée dans l'onglet Collection.
 */
export function AccountPanel({ compact = false }: { compact?: boolean }) {
  const session = useSession()
  const { sync, lastSync, syncError, outbox } = useCollectionState()

  if (!API_URL) {
    if (compact) return null
    return (
      <p className="flex items-start gap-2 text-sm text-muted">
        <CloudOff size={18} className="mt-0.5 shrink-0" />
        Serveur non configuré : ta collection est gardée sur ce téléphone uniquement.
      </p>
    )
  }

  if (!session) return <LoginForm compact={compact} />

  const status =
    sync === 'syncing'
      ? 'Synchronisation…'
      : sync === 'offline'
        ? `Hors ligne${outbox.length ? ` · ${outbox.length} modification(s) en attente` : ''}`
        : sync === 'error'
          ? `Erreur de synchronisation${syncError ? ` : ${syncError}` : ''}`
          : lastSync
            ? `Sauvegardée ${timeAgo(new Date(lastSync).getTime())}`
            : 'Connecté'

  if (compact) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted">
        <span className={`h-2 w-2 rounded-full ${sync === 'error' ? 'bg-bad' : sync === 'offline' ? 'bg-warn' : 'bg-good'}`} aria-hidden />
        {status}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Connecté avec <b>{session.user.email}</b>
      </p>
      <p className="flex items-center gap-2 text-sm text-muted">
        <span className={`h-2 w-2 rounded-full ${sync === 'error' ? 'bg-bad' : sync === 'offline' ? 'bg-warn' : 'bg-good'}`} aria-hidden />
        {status}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => void syncNow()} className="flex items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm font-semibold">
          <RefreshCw size={16} /> Synchroniser
        </button>
        <button
          onClick={async () => {
            await logout().catch(() => {})
            clearLocal()
          }}
          className="flex items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm font-semibold"
        >
          <LogOut size={16} /> Se déconnecter
        </button>
      </div>
      <button
        onClick={async () => {
          if (!confirm('Supprimer ton compte et toute ta collection en ligne ? Cette action est définitive.')) return
          try {
            await deleteAccount()
            clearLocal()
          } catch (e) {
            alert((e as Error).message)
          }
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-bad"
      >
        <Trash2 size={16} /> Supprimer mon compte
      </button>
    </div>
  )
}

function LoginForm({ compact }: { compact: boolean }) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devCode, setDevCode] = useState<string | null>(null)

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await requestCode(email)
      setDevCode(r.devCode ?? null)
      setStep('code')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function checkCode(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await verifyCode(email, code)
      await importLocalThenSync()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {compact && <p className="mb-2 font-bold">Sauvegarde ta collection</p>}
      <p className="mb-3 text-sm text-muted">
        {step === 'email'
          ? 'Connecte-toi avec ton email pour retrouver ta collection sur tous tes appareils. Pas de mot de passe : on t’envoie un code.'
          : `Code envoyé à ${email}. Regarde tes emails (et les spams).`}
      </p>
      {step === 'email' ? (
        <form onSubmit={sendCode} className="flex gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-primary">
            <Mail size={16} className="shrink-0 text-muted" />
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.fr"
              aria-label="Adresse email"
              className="w-full min-w-0 bg-transparent py-2.5 outline-none placeholder:text-muted focus-visible:outline-none"
            />
          </label>
          <button disabled={busy} className="rounded-xl bg-primary px-4 font-bold text-primary-ink disabled:opacity-60">
            {busy ? '…' : 'Recevoir'}
          </button>
        </form>
      ) : (
        <form onSubmit={checkCode} className="space-y-2">
          <div className="flex gap-2">
            <input
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              aria-label="Code à 6 chiffres"
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-center text-xl font-bold tracking-[0.4em] outline-none focus-visible:border-primary focus-visible:outline-none"
            />
            <button disabled={busy || code.length !== 6} className="rounded-xl bg-primary px-4 font-bold text-primary-ink disabled:opacity-60">
              {busy ? '…' : 'Valider'}
            </button>
          </div>
          {devCode && (
            <p className="rounded-lg bg-accent/30 px-3 py-2 text-xs">
              Mode développement (pas d’email configuré) : ton code est <b>{devCode}</b>
            </p>
          )}
          <div className="flex justify-between text-sm">
            <button type="button" onClick={() => setStep('email')} className="font-semibold text-muted">
              Changer d’email
            </button>
            <button type="button" onClick={() => void sendCode()} disabled={busy} className="font-semibold text-primary">
              Renvoyer un code
            </button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-bad">{error}</p>}
    </div>
  )
}
