import { trackScan } from '../lib/stats'
import { Camera, ImageUp, RotateCcw, Search, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { rememberScanPhoto } from '../lib/myPhotos'
import { mergeRecognitions } from '../scan/merge'
import { ApiError } from '../api/cache'
import { CameraCapture } from '../components/CameraCapture'
import { CardThumb, useSetNames } from '../components/CardThumb'
import { Card, ScreenTitle } from '../components/ui'
import { useOnline } from '../lib/useOnline'
import { canvasToDataUrl, cropToCard, fileToCanvas, findCard } from '../scan/image'
import { OcrLoadError, warmUpOcr } from '../scan/ocr'
import { load, save } from '../lib/storage'
import { type Recognition, recognizeCard, type ScanLang } from '../scan/recognize'

type Phase =
  | { name: 'idle' }
  | { name: 'camera' }
  | { name: 'analyzing'; preview: string; step: string }
  | { name: 'results'; preview: string; rec: Recognition }
  | { name: 'error'; preview?: string; message: string; detail?: string }

// On garde le dernier résultat en mémoire : en revenant de la fiche, la liste est toujours là.
let lastPhase: Phase = { name: 'idle' }

/** Erreur de chargement d'un morceau de l'appli (souvent juste après une mise à jour). */
const isChunkError = (e: unknown) => /dynamically imported module|Importing a module script failed|Failed to fetch|Load failed/i.test(String((e as Error)?.message ?? e))

/** Langues proposées pour le scanner (les cartes européennes partagent les mêmes extensions). */
const SCAN_LANGS: { id: ScanLang; label: string }[] = [
  { id: 'auto', label: '🇫🇷 🇬🇧 Françaises, anglaises, européennes' },
  { id: 'ja', label: '🇯🇵 Japonaises' },
  { id: 'ko', label: '🇰🇷 Coréennes' },
  { id: 'zh-tw', label: '🇹🇼 Chinoises (traditionnel)' },
  { id: 'zh-cn', label: '🇨🇳 Chinoises (simplifié)' },
  { id: 'th', label: '🇹🇭 Thaïlandaises' },
  { id: 'id', label: '🇮🇩 Indonésiennes' },
]

export function ScannerScreen() {
  const [phase, setPhaseState] = useState<Phase>(lastPhase)
  const [lang, setLangState] = useState<ScanLang>(() => load<ScanLang>('scanLang', 'auto'))
  const setLang = (l: ScanLang) => {
    save('scanLang', l)
    setLangState(l)
  }
  const setPhase = (p: Phase) => {
    lastPhase = p.name === 'camera' || p.name === 'analyzing' ? { name: 'idle' } : p
    setPhaseState(p)
  }
  const fileRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const online = useOnline()

  /**
   * attempts : une ou plusieurs images de la même carte (rafale caméra), de la plus nette
   * à la moins nette. Si la 1re ne suffit pas, on essaie la suivante et on combine.
   */
  async function analyze(attempts: HTMLCanvasElement[][]) {
    const preview = canvasToDataUrl(attempts[0][0])
    setPhase({ name: 'analyzing', preview, step: 'Préparation…' })
    try {
      const onProgress = (p: { status: string }) => {
        const step = p.status.includes('load') ? 'Chargement du lecteur de texte…' : 'Lecture du nom et du numéro…'
        setPhaseState((cur) => (cur.name === 'analyzing' && cur.step !== step ? { ...cur, step } : cur))
      }
      let rec = await recognizeCard(attempts[0], onProgress, lang)
      for (const views of attempts.slice(1)) {
        if (rec.confident) break
        setPhaseState((cur) => (cur.name === 'analyzing' ? { ...cur, step: 'Deuxième essai avec une autre image…' } : cur))
        const other = await recognizeCard(views, onProgress, lang).catch(() => null)
        if (other) rec = mergeRecognitions(rec, other)
      }
      trackScan()
      rememberScanPhoto(rec.preview, rec.confident ? rec.candidates[0]?.id : undefined, `${rec.readName ?? '?'} · ${rec.readNumber ? `${rec.readNumber.raw}/${rec.readNumber.total ?? '?'}` : '?'}`)
      if (rec.confident) {
        setPhase({ name: 'results', preview: rec.preview, rec })
        navigate(`/carte/${encodeURIComponent(rec.candidates[0].id)}`)
      } else {
        setPhase({ name: 'results', preview: rec.preview, rec })
      }
    } catch (e) {
      setPhase({
        name: 'error',
        preview,
        message:
          e instanceof ApiError
            ? e.kind === 'offline'
              ? 'Pas de connexion : impossible de chercher la carte. Réessaie quand tu auras du réseau.'
              : 'Le service de cartes ne répond pas. Réessaie dans quelques minutes.'
            : e instanceof OcrLoadError || isChunkError(e)
              ? 'Le lecteur de texte n’a pas pu se charger (connexion faible ou appli tout juste mise à jour). Ferme et rouvre l’appli, puis réessaie.'
              : 'La lecture de la photo a échoué. Réessaie avec une photo plus nette.',
        detail: e instanceof ApiError ? undefined : String((e as Error)?.message ?? e).slice(0, 200),
      })
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const canvas = await fileToCanvas(file)
      // On cherche la carte dans la photo ; sinon on recadre simplement au centre.
      await analyze([findCard(canvas) ?? [cropToCard(canvas)]])
    } catch {
      setPhase({ name: 'error', message: 'Impossible d’ouvrir cette image. Essaie une photo JPEG ou PNG.' })
    }
  }

  const pickFile = () => fileRef.current?.click()

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      {phase.name === 'camera' && (
        <CameraCapture
          onClose={() => setPhase({ name: 'idle' })}
          onPickFile={() => {
            setPhase({ name: 'idle' })
            pickFile()
          }}
          // Si la carte ne remplit pas tout le cadre, on affine le recadrage.
          // Carte cherchée dans la capture élargie ; elle doit occuper l'essentiel du cadre
          // (sinon on a sans doute trouvé l'illustration) : à défaut, on prend le cadre tel quel.
          onCapture={(shots) => void analyze(shots.map((s) => findCard(s.wide, 0.6, true, 0.25) ?? [s.framed]))}
        />
      )}

      {(phase.name === 'idle' || phase.name === 'camera') && (
        <Idle
          lang={lang}
          onLang={setLang}
          online={online}
          onCamera={() => {
            warmUpOcr()
            setPhase({ name: 'camera' })
          }}
          onFile={pickFile}
        />
      )}

      {phase.name === 'analyzing' && (
        <div className="py-6 text-center">
          <div className="relative mx-auto w-44">
            <img src={phase.preview} alt="Ta photo" className="w-full rounded-2xl shadow-lg" />
            <div className="absolute inset-x-0 top-0 h-1 animate-[scan_1.6s_ease-in-out_infinite] rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]" />
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-lg font-bold">
            <Sparkles size={20} className="text-primary" /> Analyse en cours…
          </p>
          <p className="text-muted">{phase.step}</p>
          <p className="mt-2 text-xs text-muted">Le premier scan prend un peu plus de temps.</p>
        </div>
      )}

      {phase.name === 'results' && (
        <Results
          preview={phase.preview}
          rec={phase.rec}
          onRetry={() => setPhase({ name: 'camera' })}
          onReset={() => setPhase({ name: 'idle' })}
        />
      )}

      {phase.name === 'error' && (
        <Card className="text-center">
          {phase.preview && <img src={phase.preview} alt="" className="mx-auto mb-3 w-28 rounded-xl" />}
          <p className="font-bold">Oups !</p>
          <p className="text-muted">{phase.message}</p>
          {phase.detail && <p className="mt-2 text-xs break-words text-muted/70">Détail technique : {phase.detail}</p>}
          <div className="mt-4 grid gap-2">
            <button onClick={() => setPhase({ name: 'camera' })} className="rounded-2xl bg-primary py-3 font-bold text-primary-ink">
              Reprendre une photo
            </button>
            <Link to="/recherche" className="rounded-2xl border border-line py-3 font-semibold">
              Rechercher à la main
            </Link>
          </div>
        </Card>
      )}
    </>
  )
}

function Idle({
  online,
  onCamera,
  onFile,
  lang,
  onLang,
}: {
  online: boolean
  onCamera: () => void
  onFile: () => void
  lang: ScanLang
  onLang: (l: ScanLang) => void
}) {
  return (
    <>
      <ScreenTitle title="Scanner une carte" subtitle="Photographie ta carte, on s'occupe du reste." />
      <button
        onClick={onCamera}
        className="relative mx-auto block aspect-[63/88] w-3/5 max-w-[15rem] rounded-3xl bg-gradient-to-br from-primary to-[#b24cf5] p-1 shadow-lg active:scale-[.98]"
      >
        <div className="grid h-full w-full place-items-center rounded-[1.3rem] border-2 border-dashed border-white/70 bg-black/10 text-center text-white">
          <div className="px-6">
            <Camera size={44} className="mx-auto mb-2" />
            <p className="font-bold">Touche pour scanner</p>
            <p className="text-sm opacity-80">Bien à plat, sans reflet</p>
          </div>
        </div>
      </button>

      <label className="mx-auto mt-4 flex max-w-xs items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-1.5 text-sm">
        <span className="shrink-0 font-semibold text-muted">Cartes :</span>
        <select
          value={lang}
          onChange={(e) => onLang(e.target.value as ScanLang)}
          aria-label="Langue des cartes à scanner"
          className="min-w-0 flex-1 truncate bg-transparent py-1 font-semibold outline-none"
        >
          {SCAN_LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      {lang !== 'auto' && (
        <p className="mx-auto mt-1 max-w-xs text-center text-xs text-muted">Le scanner lit le numéro en bas de la carte et compare l’illustration.</p>
      )}

      {!online && (
        <p className="mt-4 rounded-2xl bg-warn/15 px-4 py-2 text-center text-sm font-semibold text-warn">
          Hors ligne : il faut du réseau pour identifier une carte.
        </p>
      )}

      <div className="mt-6 grid gap-3">
        <button onClick={onCamera} className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-lg font-bold text-primary-ink active:scale-[.98]">
          <Camera size={22} /> Ouvrir la caméra
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onFile} className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3 font-semibold">
            <ImageUp size={20} /> Galerie
          </button>
          <Link to="/recherche" className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3 font-semibold">
            <Search size={20} /> Rechercher
          </Link>
        </div>
      </div>
    </>
  )
}

function Results({ preview, rec, onRetry, onReset }: { preview: string; rec: Recognition; onRetry: () => void; onReset: () => void }) {
  const setNames = useSetNames()
  const read = [rec.readName, rec.readNumber ? `n° ${rec.readNumber.raw}${rec.readNumber.total ? '/' + rec.readNumber.total : ''}` : null]
    .filter(Boolean)
    .join(' · ')
  // Le badge « Le plus probable » seulement si la 1re carte a une vraie avance.
  const [a, b] = rec.candidates
  const clearLead = !!a && (!b || a.score - b.score >= 0.4)
  const searchHref = `/recherche${rec.readName ? `?q=${encodeURIComponent(rec.readName.split(' ')[0])}` : ''}`

  // Filtre par numéro tapé : « 093/088 » → on garde le n° 93 ; « TG07 » → TG7.
  const [num, setNum] = useState('')
  const typed = num.split('/')[0].replace(/\s/g, '').toUpperCase()
  // Que des zéros (début de « 093 ») : on attend la suite avant de filtrer.
  const filterKey = /^[A-Z]*0*$/.test(typed) && !/[A-Z]/.test(typed) ? '' : typed.replace(/^([A-Z]*)0+(?=\d)/, '$1')
  const shown = filterKey
    ? rec.candidates.filter((c) => c.localId.toUpperCase().replace(/^([A-Z]*)0+(?=\d)/, '$1').startsWith(filterKey))
    : rec.candidates

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <img src={preview} alt="Ta photo" className="w-16 rounded-lg shadow" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold">{rec.candidates.length ? 'C’est laquelle ?' : 'Carte non reconnue'}</h1>
          <p className="truncate text-sm text-muted">{read ? `On a lu : ${read}` : 'Aucun texte lisible sur la photo.'}</p>
        </div>
        <button onClick={onReset} aria-label="Nouveau scan" className="grid h-10 w-10 place-items-center rounded-full bg-surface-2">
          <RotateCcw size={18} />
        </button>
      </div>

      {rec.candidates.length > 0 ? (
        <>
          {rec.candidates.length > 4 && (
            <label className="mb-3 block rounded-2xl border border-line bg-surface p-3 focus-within:border-primary">
              <span className="text-sm font-semibold">Il y a plusieurs versions : tape le numéro écrit en bas de ta carte</span>
              <input
                value={num}
                onChange={(e) => setNum(e.target.value)}
                placeholder="ex. 093 ou 093/088 ou TG07"
                aria-label="Numéro en bas de la carte"
                inputMode="text"
                autoCapitalize="characters"
                className="mt-2 w-full rounded-xl border border-line bg-bg px-3 py-2 font-semibold outline-none placeholder:font-normal placeholder:text-muted focus-visible:border-primary focus-visible:outline-none"
              />
            </label>
          )}
          <p className="mb-2 text-sm text-muted">
            {shown.length
              ? `Touche la carte qui correspond à la tienne${shown.length > 4 ? ` (${shown.length} versions)` : ''}.`
              : 'Aucune de ces versions n’a ce numéro.'}
          </p>
          {!shown.length && (
            <Link
              to={`/recherche?q=${encodeURIComponent(rec.readName?.split(' ')[0] ?? '')}&n=${encodeURIComponent(num.trim())}`}
              className="mb-3 block rounded-2xl bg-primary py-3 text-center font-bold text-primary-ink"
            >
              Chercher la carte n° {num.trim()}
            </Link>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {shown.map((c, i) => (
              <CardThumb
                key={c.id}
                card={c}
                setName={setNames.get(c.id.slice(0, c.id.lastIndexOf('-')))}
                extra={i === 0 && clearLead && !filterKey ? <span className="mt-1 inline-block rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-bold text-good">Le plus probable</span> : null}
              />
            ))}
          </div>
        </>
      ) : (
        <Card>
          <p className="font-bold">Quelques conseils pour réessayer :</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>Place la carte entière dans le cadre, bien droite.</li>
            <li>Évite les reflets : penche légèrement la carte ou éteins le flash.</li>
            <li>Une sleeve brillante peut gêner : sors la carte si possible.</li>
          </ul>
        </Card>
      )}

      <div className="mt-5 grid gap-2">
        <button onClick={onRetry} className="rounded-2xl bg-primary py-3 font-bold text-primary-ink">
          Reprendre la photo
        </button>
        <Link to={searchHref} className="rounded-2xl border border-line bg-surface py-3 text-center font-semibold">
          {rec.candidates.length ? 'Aucune ne correspond : rechercher à la main' : 'Rechercher à la main'}
        </Link>
      </div>
      {load<ScanLang>('scanLang', 'auto') === 'auto' && (
        <p className="mt-4 rounded-2xl bg-surface-2 px-3 py-2 text-sm">
          🇯🇵 Carte <b>japonaise, coréenne, chinoise…</b> ? Sur l’écran du scanner, choisis la langue dans « Cartes : » puis reprends la photo.
        </p>
      )}
    </>
  )
}
