import { ImageUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CARD_RATIO, makeCanvas } from '../scan/image'

/**
 * Caméra plein écran avec un cadre au format carte.
 * Au déclenchement, on ne garde que la partie de l'image dans le cadre.
 */
export function CameraCapture({
  onCapture,
  onClose,
  onPickFile,
}: {
  onCapture: (card: HTMLCanvasElement) => void
  onClose: () => void
  onPickFile: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError('La caméra n’est disponible que sur une connexion sécurisée (https). Utilise la galerie à la place.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())
        const v = videoRef.current!
        v.srcObject = stream
        await v.play()
        setReady(true)
      } catch (e) {
        const name = (e as DOMException).name
        setError(
          name === 'NotAllowedError'
            ? 'Tu as refusé l’accès à la caméra. Autorise-le dans les réglages du navigateur, ou utilise la galerie.'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'Aucune caméra trouvée sur cet appareil. Utilise la galerie.'
              : 'Impossible d’ouvrir la caméra. Ferme les autres applis qui l’utilisent, ou utilise la galerie.',
        )
      }
    }
    void start()
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function capture() {
    const v = videoRef.current
    const box = boxRef.current?.getBoundingClientRect()
    const frame = frameRef.current?.getBoundingClientRect()
    if (!v || !box || !frame || !v.videoWidth) return

    // La vidéo est affichée en « cover » : on retrouve la zone du cadre dans l'image réelle.
    const scale = Math.max(box.width / v.videoWidth, box.height / v.videoHeight)
    const ox = (box.width - v.videoWidth * scale) / 2
    const oy = (box.height - v.videoHeight * scale) / 2
    const sx = (frame.left - box.left - ox) / scale
    const sy = (frame.top - box.top - oy) / scale
    const sw = frame.width / scale
    const sh = frame.height / scale

    const out = makeCanvas(Math.min(sw, 1000), Math.min(sw, 1000) / CARD_RATIO)
    out.getContext('2d')!.drawImage(v, sx, sy, sw, sh, 0, 0, out.width, out.height)
    navigator.vibrate?.(30)
    onCapture(out)
  }

  return (
    <div ref={boxRef} className="fixed inset-0 z-50 overflow-hidden bg-black text-white" role="dialog" aria-label="Caméra">
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />

      {/* Cadre au format carte ; l'ombre autour assombrit le reste de l'image */}
      <div className="absolute inset-0 grid place-items-center pb-28">
        <div
          ref={frameRef}
          className="relative aspect-[63/88] w-[min(78vw,calc((100dvh-15rem)*0.716))] rounded-[4%]"
          style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)' }}
        >
          {/* Coins du viseur */}
          {['left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl'].map((c) => (
            <span key={c} className={`absolute h-10 w-10 border-accent ${c}`} />
          ))}
        </div>
      </div>

      <div className="pt-safe absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <button onClick={onClose} aria-label="Fermer la caméra" className="grid h-11 w-11 place-items-center rounded-full bg-black/50">
          <X />
        </button>
        <p className="rounded-full bg-black/50 px-3 py-1.5 text-sm font-semibold">
          {ready ? 'Cadre toute la carte, sans reflet' : 'Ouverture de la caméra…'}
        </p>
        <span className="w-11" />
      </div>

      {error && (
        <div className="absolute inset-x-4 top-1/3 rounded-3xl bg-surface p-5 text-center text-ink">
          <p className="font-semibold">{error}</p>
          <button onClick={onPickFile} className="mt-4 w-full rounded-2xl bg-primary py-3 font-bold text-primary-ink">
            Choisir une photo
          </button>
        </div>
      )}

      <div className="pb-safe absolute inset-x-0 bottom-0 flex items-center justify-around p-6">
        <button onClick={onPickFile} aria-label="Importer depuis la galerie" className="grid h-12 w-12 place-items-center rounded-full bg-black/50">
          <ImageUp />
        </button>
        <button
          onClick={capture}
          disabled={!ready}
          aria-label="Prendre la photo"
          className="grid h-20 w-20 place-items-center rounded-full border-4 border-white disabled:opacity-40"
        >
          <span className="h-16 w-16 rounded-full bg-white active:scale-90" />
        </button>
        <span className="w-12" />
      </div>
    </div>
  )
}
