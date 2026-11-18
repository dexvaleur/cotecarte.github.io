import type { Worker } from 'tesseract.js'

/**
 * OCR (lecture du texte dans une image) avec Tesseract.js.
 * Tout se passe sur le téléphone : la photo n'est envoyée nulle part.
 * Les fichiers du moteur sont servis par l'appli (dossier public/ocr).
 */

let workerPromise: Promise<Worker> | null = null

export type OcrProgress = (p: { status: string; progress: number }) => void
let progressListener: OcrProgress | null = null

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      // Import « paresseux » : Tesseract n'est téléchargé qu'au premier scan.
      const { createWorker, OEM, PSM } = await import('tesseract.js')
      const base = new URL('ocr/', document.baseURI).href
      const worker = await createWorker('fra', OEM.LSTM_ONLY, {
        workerPath: base + 'worker.min.js',
        corePath: base,
        langPath: base.replace(/\/$/, ''),
        gzip: true,
        logger: (m) => progressListener?.({ status: m.status, progress: m.progress }),
      })
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
      return worker
    })()
    workerPromise.catch(() => {
      workerPromise = null // on réessaiera au prochain scan
    })
  }
  return workerPromise
}

/**
 * Lit le texte d'une image.
 * `allowed` limite les caractères reconnus (ex. chiffres et « / » pour le numéro).
 */
export async function readText(img: HTMLCanvasElement, onProgress?: OcrProgress, allowed = ''): Promise<string> {
  progressListener = onProgress ?? null
  const worker = await getWorker()
  await worker.setParameters({ tessedit_char_whitelist: allowed })
  const { data } = await worker.recognize(img)
  return data.text
}

/** Précharge le moteur OCR (appelé quand on ouvre la caméra, pour gagner du temps). */
export function warmUpOcr() {
  void getWorker().catch(() => {})
}
