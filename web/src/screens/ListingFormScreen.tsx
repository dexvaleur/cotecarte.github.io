import { ArrowLeft, Camera, Layers, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { CardImage } from '../components/CardThumb'
import { LoginGate, PseudoGate, Spinner } from '../components/market'
import { Card } from '../components/ui'
import { CONDITIONS, type ConditionCode } from '../data/cardInfo'
import { useSession } from '../lib/api'
import { useCollectionState, type CollectionItem } from '../lib/collection'
import { formatEur } from '../lib/format'
import {
  cleanTag,
  compressPhoto,
  createListing,
  editListing,
  fetchListing,
  KIND_LABEL,
  photoUrl,
  type Kind,
  type ListingInput,
} from '../lib/market'
import { useProfile } from '../lib/profile'

const MAX_PHOTOS = 5
const SUGGESTED_TAGS = ['holo', 'reverse', 'ex', 'gx', 'v', 'vmax', 'japonaise', 'gradee', 'lot', 'promo', 'fullart', 'alternative']

/** Créer ou modifier une annonce : photos, titre, prix, état, description et hashtags. */
export function ListingFormScreen() {
  const { id } = useParams()
  const editing = !!id
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const session = useSession()
  const profile = useProfile()
  const { collection } = useCollectionState()

  const [photos, setPhotos] = useState<string[]>([])
  const [photosChanged, setPhotosChanged] = useState(false)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<Kind>('vente')
  const [price, setPrice] = useState('')
  const [condition, setCondition] = useState<ConditionCode | ''>('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [cardId, setCardId] = useState<string | null>(null)
  const [refPrice, setRefPrice] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)
  const [loading, setLoading] = useState(editing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Modification : on recharge l'annonce existante.
  useEffect(() => {
    if (!id) return
    fetchListing(id)
      .then(({ listing: l }) => {
        setPhotos(Array.from({ length: l.photoCount }, (_, i) => photoUrl(l, i)))
        setTitle(l.title)
        setKind(l.kind)
        setPrice(l.priceEur !== null ? String(l.priceEur).replace('.', ',') : '')
        setCondition((l.condition as ConditionCode) ?? '')
        setDescription(l.description ?? '')
        setTags(l.hashtags)
        setCardId(l.cardId ?? null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const fillFromCard = (c: Pick<CollectionItem, 'cardId' | 'name' | 'setName' | 'localId' | 'priceEur'> & { condition?: ConditionCode }) => {
    setCardId(c.cardId)
    setTitle(`${c.name} · ${c.setName}${c.localId ? ` ${c.localId}` : ''}`.slice(0, 80))
    if (c.condition) setCondition(c.condition)
    const factor = c.condition ? CONDITIONS[c.condition].factor : 1
    if (c.priceEur) {
      setRefPrice(c.priceEur)
      if (!price) setPrice((Math.round(c.priceEur * factor * 2) / 2).toFixed(2).replace('.', ',').replace(',00', ''))
    }
    const auto = [cleanTag(c.name.split(/[\s-]/)[0] ?? ''), cleanTag(c.setName.replace(/\s+/g, ''))].filter((t) => t.length > 1)
    setTags((t) => [...new Set([...t, ...auto])].slice(0, 10))
  }

  // Venu du bouton « Vendre » d'une fiche carte.
  useEffect(() => {
    const cid = params.get('carte')
    if (editing || !cid) return
    const own = collection.find((c) => c.cardId === cid)
    if (own) fillFromCard(own)
    else
      fillFromCard({
        cardId: cid,
        name: params.get('nom') ?? '',
        setName: params.get('ext') ?? '',
        localId: params.get('num') ?? '',
        priceEur: Number(params.get('prix')) || null,
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    try {
      const room = MAX_PHOTOS - photos.length
      const added = await Promise.all([...files].slice(0, room).map(compressPhoto))
      setPhotos((p) => [...p, ...added].slice(0, MAX_PHOTOS))
      setPhotosChanged(true)
    } catch {
      setError('Impossible de lire cette photo. Essaie avec une autre.')
    }
  }

  const addTag = (raw: string) => {
    const t = cleanTag(raw)
    if (t && !tags.includes(t) && tags.length < 10) setTags([...tags, t])
    setTagInput('')
  }

  const suggestions = useMemo(() => SUGGESTED_TAGS.filter((t) => !tags.includes(t)).slice(0, 8), [tags])

  if (!session) return <LoginGate text="Connecte-toi pour publier une annonce." />
  if (!profile.pseudo.trim()) return <PseudoGate />
  if (loading) return <Spinner />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!photos.length) return setError('Ajoute au moins une photo de ta carte.')
    if (title.trim().length < 2) return setError('Donne un titre à ton annonce.')
    const priceEur = price.trim() ? Number(price.replace(',', '.').replace(/[^\d.]/g, '')) : null
    if (kind !== 'echange' && priceEur !== null && (Number.isNaN(priceEur) || priceEur > 100_000)) return setError('Le prix n’est pas valide.')
    setBusy(true)
    try {
      const body: ListingInput = {
        title: title.trim(),
        description: description.trim(),
        hashtags: tagInput.trim() ? [...tags, cleanTag(tagInput)] : tags,
        kind,
        priceEur: kind === 'echange' ? null : priceEur,
        condition: condition || null,
        cardId,
      }
      if (!editing || photosChanged) body.photos = await Promise.all(photos.map(toDataUrl))
      if (editing) {
        await editListing(id, body)
        navigate(`/vendre/annonce/${id}`, { replace: true })
      } else {
        const r = await createListing(body)
        navigate(`/vendre/annonce/${r.id}`, { replace: true })
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate(-1)} aria-label="Retour" className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-extrabold">{editing ? 'Modifier l’annonce' : 'Vendre une carte'}</h1>
      </div>

      {/* 1. Photos */}
      <Card>
        <p className="font-bold">
          Photos <span className="font-normal text-muted">({photos.length}/{MAX_PHOTOS})</span>
        </p>
        <p className="mb-3 text-sm text-muted">Recto, verso et les bords, bien éclairés. La 1ʳᵉ photo est celle qu’on voit dans la liste.</p>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((src, i) => (
            <div key={src.slice(-40) + i} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-surface-2">
              <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute bottom-1 left-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-ink">Couverture</span>}
              <button
                type="button"
                aria-label={`Retirer la photo ${i + 1}`}
                onClick={() => {
                  setPhotos(photos.filter((_, j) => j !== i))
                  setPhotosChanged(true)
                }}
                className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
              >
                <X size={16} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary/50 bg-primary-soft/40 text-sm font-bold text-primary"
            >
              <Camera size={26} /> Ajouter
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void addFiles(e.target.files).then(() => (e.target.value = ''))} />
      </Card>

      {/* 2. Quelle carte ? */}
      <Card>
        <label className="font-bold" htmlFor="title">
          Titre
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="Ex. Dracaufeu ex 151 · 006/165"
          className="mt-2 w-full rounded-xl border border-line bg-bg px-3 py-2.5"
        />
        {collection.length > 0 && (
          <button type="button" onClick={() => setPicking(true)} className="mt-2 flex items-center gap-2 text-sm font-bold text-primary">
            <Layers size={16} /> Choisir dans ma collection
          </button>
        )}
      </Card>

      {/* 3. Prix */}
      <Card>
        <p className="mb-2 font-bold">Vente ou échange ?</p>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1">
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-xl py-2 text-sm font-bold ${kind === k ? 'bg-surface text-primary shadow-sm' : 'text-muted'}`}
            >
              {k === 'les2' ? 'Les deux' : KIND_LABEL[k]}
            </button>
          ))}
        </div>
        {kind !== 'echange' && (
          <>
            <label htmlFor="price" className="mt-3 block font-bold">
              Prix
            </label>
            <div className="relative mt-2">
              <input
                id="price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d,.]/g, ''))}
                placeholder="Vide = à discuter"
                className="w-full rounded-xl border border-line bg-bg py-2.5 pr-8 pl-3 text-lg font-bold"
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 font-bold text-muted">€</span>
            </div>
            {refPrice !== null && (
              <p className="mt-1.5 text-sm text-muted">
                Cote actuelle : <b className="text-ink">{formatEur(refPrice)}</b> en état parfait
                {condition && condition !== 'NM' && <> · environ {formatEur(refPrice * CONDITIONS[condition].factor)} en {condition}</>}
              </p>
            )}
          </>
        )}

        <p className="mt-3 mb-2 font-bold">État</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CONDITIONS) as ConditionCode[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={condition === c}
              onClick={() => setCondition(condition === c ? '' : c)}
              title={CONDITIONS[c].explain}
              className={`rounded-full border px-3 py-1.5 text-sm font-bold ${condition === c ? 'border-primary bg-primary text-primary-ink' : 'border-line'}`}
            >
              {c}
            </button>
          ))}
        </div>
        {condition && <p className="mt-1.5 text-sm text-muted">{CONDITIONS[condition].label} : {CONDITIONS[condition].explain}</p>}
      </Card>

      {/* 4. Description et hashtags */}
      <Card>
        <label htmlFor="desc" className="font-bold">
          Description
        </label>
        <textarea
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1500}
          rows={4}
          placeholder="Ex. Sortie du booster, directement mise en sleeve. Envoi suivi ou remise en main propre sur Lyon."
          className="mt-2 w-full rounded-xl border border-line bg-bg px-3 py-2.5"
        />

        <label htmlFor="tags" className="mt-3 block font-bold">
          Hashtags <span className="font-normal text-muted">({tags.length}/10)</span>
        </label>
        <p className="text-sm text-muted">Ils aident les autres à trouver ton annonce.</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-bg p-2">
          {tags.map((t) => (
            <button key={t} type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-sm font-semibold text-primary">
              #{t} <X size={13} />
            </button>
          ))}
          <input
            id="tags"
            value={tagInput}
            onChange={(e) => {
              const v = e.target.value
              if (/[\s,]$/.test(v)) addTag(v)
              else setTagInput(v)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag(tagInput)
              } else if (e.key === 'Backspace' && !tagInput && tags.length) setTags(tags.slice(0, -1))
            }}
            onBlur={() => tagInput && addTag(tagInput)}
            placeholder={tags.length ? '' : '#dracaufeu'}
            className="min-w-24 flex-1 bg-transparent px-1 py-1 outline-none"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((t) => (
            <button key={t} type="button" onClick={() => addTag(t)} className="rounded-full border border-dashed border-line px-2.5 py-1 text-sm text-muted">
              + #{t}
            </button>
          ))}
        </div>
      </Card>

      {error && <p className="rounded-xl bg-bad/10 px-3 py-2 font-semibold text-bad">{error}</p>}

      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 mx-auto max-w-xl bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pt-4 pb-2">
        <button type="submit" disabled={busy} className="w-full rounded-2xl bg-primary py-3.5 font-bold text-primary-ink shadow-lg active:scale-[.98] disabled:opacity-60">
          {busy ? 'Envoi…' : editing ? 'Enregistrer' : 'Publier l’annonce'}
        </button>
      </div>

      {picking && (
        <CollectionPicker
          items={collection}
          onClose={() => setPicking(false)}
          onPick={(c) => {
            fillFromCard(c)
            setPicking(false)
          }}
        />
      )}
    </form>
  )
}

/** Fenêtre « Choisir dans ma collection ». */
function CollectionPicker({ items, onPick, onClose }: { items: CollectionItem[]; onPick: (c: CollectionItem) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const seen = new Set<string>()
    return items
      .filter((c) => !s || c.name.toLowerCase().includes(s) || c.setName.toLowerCase().includes(s))
      .sort((a, b) => (b.priceEur ?? 0) - (a.priceEur ?? 0))
      .filter((c) => (seen.has(c.cardId + c.condition) ? false : (seen.add(c.cardId + c.condition), true)))
      .slice(0, 60)
  }, [items, q])

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/50 sm:items-center" onClick={onClose}>
      <div className="mx-auto flex max-h-[85dvh] w-full max-w-xl flex-col rounded-t-3xl bg-surface p-4 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center">
          <p className="font-bold">Choisis la carte à vendre</p>
          <button type="button" onClick={onClose} aria-label="Fermer" className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-surface-2">
            <X size={18} />
          </button>
        </div>
        <div className="relative mb-3">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" className="w-full rounded-xl border border-line bg-bg py-2.5 pr-3 pl-9" />
        </div>
        <ul className="-mx-1 grid grid-cols-3 gap-2 overflow-y-auto px-1 pb-2">
          {list.map((c) => (
            <li key={c.uid}>
              <button type="button" onClick={() => onPick(c)} className="w-full text-left">
                <CardImage image={c.image} cardId={c.cardId} alt={c.name} className="aspect-[63/88] w-full rounded-lg" />
                <p className="mt-1 truncate text-xs font-semibold">{c.name}</p>
                <p className="text-xs text-muted">
                  {c.condition} · {formatEur(c.priceEur)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Photo déjà en ligne (modification) → data URL, pour la renvoyer avec les nouvelles. */
async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return src
  const blob = await (await fetch(src)).blob()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
