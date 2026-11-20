import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { endTour, goToStep, useTour } from '../lib/tour'
import { Mascot } from './Mascot'

const PAD = 6 // marge lumineuse autour de l'élément expliqué
const HEADER = 64
const GAP = 14

interface Box {
  top: number
  left: number
  width: number
  height: number
}

function findTarget(name: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

/** Un élément collé à l'écran (onglets, barre d'actions) : inutile de faire défiler la page. */
function isPinned(el: HTMLElement): boolean {
  for (let e: HTMLElement | null = el; e; e = e.parentElement) {
    const p = getComputedStyle(e).position
    if (p === 'fixed' || p === 'sticky') return true
  }
  return false
}

/**
 * Le guide : tout l'écran devient foncé sauf l'élément expliqué, et Dexy explique dans une bulle.
 * Monté une seule fois dans AppShell ; il s'affiche dès qu'un guide est lancé (lib/tour).
 */
export function Tour() {
  const tour = useTour()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [box, setBox] = useState<Box | null>(null)
  const [ready, setReady] = useState(false)
  const [bubbleH, setBubbleH] = useState(200)
  const bubble = useRef<HTMLDivElement>(null)
  const next = useRef<HTMLButtonElement>(null)

  const step = tour?.steps[tour.index]
  const index = tour?.index ?? 0
  const total = tour?.steps.length ?? 0

  // 1. Ouvrir le bon écran.
  useEffect(() => {
    if (step?.route && pathname !== step.route) navigate(step.route)
  }, [step, pathname, navigate])

  // 2. Trouver l'élément, le faire venir à l'écran, puis suivre sa position.
  useEffect(() => {
    if (!step) return
    setReady(false)
    setBox(null)
    if (!step.target) {
      setReady(true)
      return
    }
    let frame = 0
    let el: HTMLElement | null = null
    let scrolled = false
    const started = performance.now()
    const loop = () => {
      if (!el || !el.isConnected) el = findTarget(step.target!)
      if (el) {
        if (!scrolled) {
          scrolled = true
          if (!isPinned(el)) {
            const r = el.getBoundingClientRect()
            const room = window.innerHeight - HEADER
            const want = HEADER + Math.max(8, (room - (r.height + GAP + bubbleH)) / 2)
            window.scrollTo({ top: window.scrollY + r.top - want, behavior: 'smooth' })
          }
        }
        const r = el.getBoundingClientRect()
        setBox((b) =>
          b && Math.abs(b.top - r.top) < 0.5 && Math.abs(b.left - r.left) < 0.5 && Math.abs(b.width - r.width) < 0.5 && Math.abs(b.height - r.height) < 0.5
            ? b
            : { top: r.top, left: r.left, width: r.width, height: r.height },
        )
        setReady(true)
      } else if (performance.now() - started > 1500) {
        setReady(true) // pas à l'écran : bulle au centre avec le texte de secours
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
    // bubbleH volontairement absent : on ne refait pas défiler quand la bulle change de taille.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  useLayoutEffect(() => {
    if (bubble.current) setBubbleH(bubble.current.offsetHeight)
  })

  useEffect(() => {
    if (ready) next.current?.focus({ preventScroll: true })
  }, [ready, index])

  // Clavier : flèches pour avancer/reculer, Échap pour fermer.
  useEffect(() => {
    if (!tour) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endTour()
      else if (e.key === 'ArrowRight') goToStep(index + 1)
      else if (e.key === 'ArrowLeft') goToStep(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tour, index])

  if (!tour || !step) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const hole = box && {
    top: box.top - PAD,
    left: Math.max(4, box.left - PAD),
    width: Math.min(vw - 8, box.width + PAD * 2),
    height: box.height + PAD * 2,
  }

  // Où placer la bulle : sous l'élément s'il y a la place, sinon au-dessus, sinon en bas de l'écran.
  let bubbleStyle: React.CSSProperties
  if (!hole) {
    bubbleStyle = { top: '50%', transform: 'translateY(-50%)' }
  } else if (vh - (hole.top + hole.height) >= bubbleH + GAP) {
    bubbleStyle = { top: hole.top + hole.height + GAP }
  } else if (hole.top >= bubbleH + GAP) {
    bubbleStyle = { top: hole.top - GAP - bubbleH }
  } else {
    bubbleStyle = { bottom: 12 }
  }

  const text = !hole && step.target && step.alt ? step.alt : step.text
  const last = index === total - 1

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Fond foncé, avec un « trou » lumineux autour de l'élément expliqué */}
      {hole ? (
        <div
          className="pointer-events-none fixed rounded-2xl ring-4 ring-accent transition-all duration-300 ease-out motion-safe:animate-[tour-glow_1.6s_ease-in-out_infinite]"
          style={{ ...hole, boxShadow: '0 0 0 9999px rgba(6, 8, 22, 0.8)' }}
        />
      ) : (
        <div className="fixed inset-0 bg-[rgba(6,8,22,0.8)] transition-opacity" />
      )}

      {/* Bloque les clics sur l'appli pendant le guide */}
      <div className="fixed inset-0" />

      <button
        onClick={endTour}
        className="pt-safe fixed top-3 right-3 flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur"
      >
        Passer le guide <X size={16} />
      </button>

      {ready && (
        <div
          ref={bubble}
          key={index}
          className="fixed inset-x-0 mx-auto flex max-w-md items-end gap-1 px-3 motion-safe:animate-[tour-pop_.25s_ease-out]"
          style={bubbleStyle}
        >
          <Mascot mood={step.mood} className="h-24 w-[5.5rem] shrink-0 drop-shadow-lg motion-safe:animate-[dexy-bob_2.4s_ease-in-out_infinite]" />
          <div className="relative mb-3 min-w-0 flex-1 rounded-3xl bg-surface p-4 text-ink shadow-2xl">
            {/* Pointe de la bulle, vers Dexy */}
            <span className="absolute bottom-5 -left-2 h-4 w-4 rotate-45 bg-surface" aria-hidden />
            <p id="tour-title" className="relative font-extrabold text-primary">
              {step.title}
            </p>
            <p className="relative mt-1 text-[15px] leading-snug">{text}</p>
            <div className="relative mt-3 flex items-center gap-2">
              <span className="text-xs font-semibold text-muted">
                {index + 1} / {total}
              </span>
              <div className="ml-auto flex gap-2">
                {index > 0 && (
                  <button
                    onClick={() => goToStep(index - 1)}
                    aria-label="Étape précédente"
                    className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-ink"
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <button
                  ref={next}
                  onClick={() => goToStep(index + 1)}
                  className="flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 font-bold text-primary-ink active:scale-95"
                >
                  {last ? 'Compris !' : 'Suivant'} {!last && <ArrowRight size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="sr-only" aria-live="polite">
        {ready ? `${step.title}. ${text}` : ''}
      </div>
    </div>
  )
}
