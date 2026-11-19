import { ArrowLeft, Check, Dices, Pencil } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AvatarView } from '../components/AvatarView'
import { CardImage } from '../components/CardThumb'
import { Card } from '../components/ui'
import { useSession } from '../lib/api'
import {
  type Avatar,
  BOTTOMS,
  CLOTH_COLORS,
  EYE_COLORS,
  EYES,
  GLOVES,
  HAIR,
  HAIR_COLORS,
  HATS,
  LASHES,
  MOUTHS,
  NOSES,
  randomAvatar,
  SHOES,
  SKIN_COLORS,
  TOPS,
  withGender,
} from '../lib/avatar'
import { useCollectionState } from '../lib/collection'
import { formatDate, formatEurCompact } from '../lib/format'
import { syncProfile, updateProfile, useProfile } from '../lib/profile'

/** Onglet Profil : carte de dresseur avec avatar, pseudo et chiffres de la collection. */
export function ProfileScreen() {
  const profile = useProfile()
  const session = useSession()
  const { collection, wishlist, binders } = useCollectionState()
  const [pseudo, setPseudo] = useState(profile.pseudo)
  const [editing, setEditing] = useState(!profile.pseudo)

  useEffect(() => {
    if (session) void syncProfile()
  }, [session])
  useEffect(() => setPseudo(profile.pseudo), [profile.pseudo])

  const stats = useMemo(() => {
    const cards = collection.reduce((s, c) => s + c.quantity, 0)
    const value = collection.reduce((s, c) => s + (c.priceEur ?? 0) * c.quantity, 0)
    const best = [...collection].sort((a, b) => (b.priceEur ?? 0) - (a.priceEur ?? 0))[0]
    const since = collection.reduce<string | null>((m, c) => (!m || c.addedAt < m ? c.addedAt : m), null)
    return {
      cards,
      distinct: new Set(collection.map((c) => c.cardId)).size,
      sets: new Set(collection.map((c) => c.setId)).size,
      value,
      best: best && (best.priceEur ?? 0) > 0 ? best : null,
      since,
    }
  }, [collection])

  const savePseudo = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfile({ pseudo: pseudo.trim().slice(0, 24) })
    setEditing(false)
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-primary-soft to-surface">
        <div className="pointer-events-none absolute -top-10 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-surface/70 blur-2xl" />
        <AvatarView a={profile.avatar} crop="bust" className="relative mx-auto -mb-px block h-64 w-auto pt-4" />
        <Link
          to="/profil/avatar"
          className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-bold text-primary-ink shadow"
        >
          <Pencil size={15} /> Mon avatar
        </Link>
      </div>

      <Card className="mt-4">
        {editing ? (
          <form onSubmit={savePseudo} className="flex gap-2">
            <label className="sr-only" htmlFor="pseudo">
              Pseudo
            </label>
            <input
              id="pseudo"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              maxLength={24}
              placeholder="Ton pseudo de dresseur"
              autoComplete="nickname"
              className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 font-semibold outline-none focus-visible:border-primary"
            />
            <button className="flex items-center gap-1 rounded-xl bg-primary px-4 font-bold text-primary-ink">
              <Check size={18} /> OK
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted">Dresseur</p>
              <h1 className="truncate text-2xl font-extrabold">{profile.pseudo}</h1>
            </div>
            <button onClick={() => setEditing(true)} aria-label="Changer de pseudo" className="rounded-full bg-surface-2 p-2.5">
              <Pencil size={18} />
            </button>
          </div>
        )}
        {stats.since && <p className="mt-1 text-sm text-muted">Collectionneur depuis le {formatDate(stats.since)}</p>}
        {!session && <p className="mt-2 text-xs text-muted">Connecte-toi (Collection → Sauvegarde) pour retrouver ton profil sur tous tes appareils.</p>}
      </Card>

      <h2 className="mt-6 mb-2 text-lg font-extrabold">Mes chiffres</h2>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Cartes" value={String(stats.cards)} />
        <Stat label="Cartes différentes" value={String(stats.distinct)} />
        <Stat label="Valeur" value={formatEurCompact(stats.value)} />
        <Stat label="Extensions" value={String(stats.sets)} />
        <Stat label="Classeurs" value={String(binders.length)} />
        <Stat label="Wishlist" value={String(wishlist.length)} />
      </dl>

      {stats.best && (
        <Card className="mt-4">
          <p className="mb-2 font-bold">🏆 Ma carte la plus chère</p>
          <Link to={`/carte/${encodeURIComponent(stats.best.cardId)}`} className="flex items-center gap-3">
            <div className="w-20 shrink-0">
              <CardImage image={stats.best.image} cardId={stats.best.cardId} alt={stats.best.name} />
            </div>
            <div className="min-w-0">
              <p className="truncate font-extrabold">{stats.best.name}</p>
              <p className="text-sm text-muted">{stats.best.setName}</p>
              <p className="text-lg font-extrabold">{formatEurCompact(stats.best.priceEur)}</p>
            </div>
          </Link>
        </Card>
      )}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-1 py-3">
      <dd className="text-xl font-extrabold">{value}</dd>
      <dt className="text-[11px] leading-tight text-muted">{label}</dt>
    </div>
  )
}

// ---- Création de l'avatar ------------------------------------------------------

const SECTIONS = [
  { id: 'corps', label: '🧍 Corps' },
  { id: 'cheveux', label: '💇 Cheveux' },
  { id: 'chapeau', label: '🧢 Chapeau' },
  { id: 'visage', label: '😀 Visage' },
  { id: 'haut', label: '👕 Haut' },
  { id: 'bas', label: '👖 Bas' },
  { id: 'chaussures', label: '👟 Chaussures' },
  { id: 'gants', label: '🧤 Gants' },
] as const

type Section = (typeof SECTIONS)[number]['id']

export function AvatarEditorScreen() {
  const profile = useProfile()
  const navigate = useNavigate()
  const [a, setA] = useState<Avatar>(profile.avatar)
  const [section, setSection] = useState<Section>('corps')
  const set = <K extends keyof Avatar>(k: K, v: Avatar[K]) => setA((x) => ({ ...x, [k]: v }))

  const done = () => {
    updateProfile({ avatar: a })
    navigate('/profil')
  }

  // Petit aperçu d'un choix : tête pour le visage et les chapeaux, corps entier pour les vêtements.
  const options = <K extends keyof Avatar>(title: string, k: K, list: Record<string, string>, crop: 'head' | 'full' | 'none' = 'head') => (
    <div className="mt-4">
      <p className="mb-2 text-sm font-bold">{title}</p>
      <div role="radiogroup" aria-label={title} className="grid grid-cols-4 gap-2">
        {Object.entries(list).map(([v, label]) => {
          const on = a[k] === v
          return (
            <button
              key={v}
              role="radio"
              aria-checked={on}
              onClick={() => set(k, v as Avatar[K])}
              className={`flex flex-col items-center rounded-2xl border-2 p-1 text-[11px] leading-tight font-semibold ${on ? 'border-primary bg-primary-soft' : 'border-line bg-surface'}`}
            >
              {crop !== 'none' && <AvatarView a={{ ...a, [k]: v }} crop={crop} className={crop === 'head' ? 'h-14 w-14' : 'h-24 w-12'} />}
              <span className="py-1">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  const colors = (title: string, k: keyof Avatar, list: string[]) => (
    <div className="mt-4">
      <p className="mb-2 text-sm font-bold">{title}</p>
      <div className="flex flex-wrap gap-2">
        {list.map((c) => (
          <button
            key={c}
            onClick={() => set(k, c as never)}
            aria-label={`Couleur ${c}`}
            aria-pressed={a[k] === c}
            className={`h-9 w-9 rounded-full border-2 ${a[k] === c ? 'border-primary ring-2 ring-primary' : 'border-line'}`}
            style={{ background: c }}
          />
        ))}
        <label
          className="relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-line"
          style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
          title="Toutes les couleurs"
        >
          <span className="sr-only">Choisir n’importe quelle couleur</span>
          <input type="color" value={a[k] as string} onChange={(e) => set(k, e.target.value as never)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      </div>
    </div>
  )

  const slider = (title: string, k: 'height' | 'build', left: string, right: string) => (
    <div className="mt-4">
      <p className="mb-1 text-sm font-bold">{title}</p>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={a[k]}
        onChange={(e) => set(k, Number(e.target.value))}
        className="w-full accent-[var(--color-primary)]"
        aria-label={title}
      />
      <div className="flex justify-between text-xs text-muted">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  )

  return (
    <div className="-mx-4 -mt-4">
      <div className="sticky top-14 z-10 border-b border-line bg-bg/95 px-4 pt-3 pb-2 backdrop-blur">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/profil')} aria-label="Retour" className="rounded-full p-2">
            <ArrowLeft size={22} />
          </button>
          <AvatarView a={a} className="h-56 w-auto" />
          <div className="flex flex-col gap-2">
            <button onClick={() => setA(randomAvatar())} className="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-bold">
              <Dices size={16} /> Hasard
            </button>
            <button onClick={done} className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-bold text-primary-ink">
              <Check size={16} /> Valider
            </button>
          </div>
        </div>
        <div role="tablist" className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={section === s.id}
              onClick={() => setSection(s.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${section === s.id ? 'bg-primary text-primary-ink' : 'bg-surface-2'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-6">
        {section === 'corps' && (
          <>
            <div className="mt-4">
              <p className="mb-2 text-sm font-bold">Garçon ou fille</p>
              <div role="radiogroup" aria-label="Garçon ou fille" className="grid grid-cols-2 gap-2">
                {(['boy', 'girl'] as const).map((g) => (
                  <button
                    key={g}
                    role="radio"
                    aria-checked={a.gender === g}
                    onClick={() => setA((x) => withGender(x, g))}
                    className={`rounded-2xl border-2 py-2.5 font-bold ${a.gender === g ? 'border-primary bg-primary-soft' : 'border-line bg-surface'}`}
                  >
                    {g === 'boy' ? '👦 Garçon' : '👧 Fille'}
                  </button>
                ))}
              </div>
            </div>
            {slider('Taille', 'height', 'Petit', 'Grand')}
            {slider('Épaisseur', 'build', 'Fin', 'Costaud')}
            {colors('Couleur de peau', 'skin', SKIN_COLORS)}
          </>
        )}
        {section === 'cheveux' && (
          <>
            {options('Coiffure', 'hair', HAIR)}
            {colors('Couleur des cheveux', 'hairColor', HAIR_COLORS)}
          </>
        )}
        {section === 'chapeau' && (
          <>
            {options('Chapeau', 'hat', HATS)}
            {a.hat !== 'aucun' && colors('Couleur', 'hatColor', CLOTH_COLORS)}
          </>
        )}
        {section === 'visage' && (
          <>
            {options('Yeux', 'eyes', EYES)}
            {colors('Couleur des yeux', 'eyeColor', EYE_COLORS)}
            {options('Cils', 'lashes', LASHES)}
            {options('Nez', 'nose', NOSES)}
            {options('Bouche', 'mouth', MOUTHS)}
          </>
        )}
        {section === 'haut' && (
          <>
            {options('Haut', 'top', TOPS, 'full')}
            {colors('Couleur', 'topColor', CLOTH_COLORS)}
          </>
        )}
        {section === 'bas' && (
          <>
            {options('Bas', 'bottom', BOTTOMS, 'full')}
            {colors('Couleur', 'bottomColor', CLOTH_COLORS)}
          </>
        )}
        {section === 'chaussures' && (
          <>
            {options('Chaussures', 'shoes', SHOES, 'full')}
            {colors('Couleur', 'shoesColor', CLOTH_COLORS)}
          </>
        )}
        {section === 'gants' && (
          <>
            {options('Gants', 'gloves', GLOVES, 'full')}
            {a.gloves !== 'aucun' && colors('Couleur', 'glovesColor', CLOTH_COLORS)}
          </>
        )}
      </div>
    </div>
  )
}
