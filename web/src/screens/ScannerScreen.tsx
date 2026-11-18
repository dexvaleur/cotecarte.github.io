import { Camera, ImageUp, Search } from 'lucide-react'
import { Badge, Card, ScreenTitle } from '../components/ui'

/**
 * Écran Scanner. À l'étape 1 il montre la mise en page ;
 * la caméra, l'OCR et la recherche arrivent à l'étape 2.
 */
export function ScannerScreen() {
  return (
    <>
      <ScreenTitle title="Scanner une carte" subtitle="Photographie ta carte, on s'occupe du reste." />

      {/* Zone de visée : la forme d'une carte (ratio 63 × 88 mm) */}
      <div className="relative mx-auto aspect-[63/88] w-3/5 max-w-[15rem] rounded-3xl bg-gradient-to-br from-primary to-[#b24cf5] p-1 shadow-lg">
        <div className="grid h-full w-full place-items-center rounded-[1.3rem] border-2 border-dashed border-white/70 bg-black/10 text-center text-white">
          <div className="px-6">
            <Camera size={44} className="mx-auto mb-2" />
            <p className="font-bold">Place ta carte ici</p>
            <p className="text-sm opacity-80">Bien à plat, sans reflet</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        <button
          disabled
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-lg font-bold text-primary-ink disabled:opacity-60"
        >
          <Camera size={22} /> Ouvrir la caméra
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            disabled
            className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3 font-semibold disabled:opacity-60"
          >
            <ImageUp size={20} /> Galerie
          </button>
          <button
            disabled
            className="flex items-center justify-center gap-2 rounded-2xl border border-line bg-surface py-3 font-semibold disabled:opacity-60"
          >
            <Search size={20} /> Rechercher
          </button>
        </div>
      </div>

      <Card className="mt-6">
        <Badge tone="accent">Étape 2</Badge>
        <p className="mt-2 text-muted">
          Le scan arrive à la prochaine étape : caméra, lecture du nom et du numéro, puis fiche complète avec le prix.
        </p>
      </Card>
    </>
  )
}
