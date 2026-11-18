import type { Worker } from 'tesseract.js'

/**
 * OCR (lecture du texte dans une image) avec Tesseract.js.
 * Tout se passe sur le téléphone : la photo n'est envoyée nulle part.
 * Les fichiers du moteur sont servis par l'appli (dossier public/ocr).
 */

let workerPromise: Promise<Worker> | null = null

/** Le moteur de lecture n'a pas pu être chargé (réseau, fichiers manquants…). */
export class OcrLoadError extends Error {
  constructor(cause: unknown) {
    super(`Chargement du lecteur de texte impossible : ${String((cause as Error)?.message ?? cause)}`)
  }
}

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
  return (await readTextWithConfidence(img, onProgress, allowed)).text
}

/** Comme readText, avec en plus la confiance de l'OCR (0 à 100). */
export async function readTextWithConfidence(
  img: HTMLCanvasElement,
  onProgress?: OcrProgress,
  allowed = '',
): Promise<{ text: string; confidence: number }> {
  progressListener = onProgress ?? null
  let worker: Worker
  try {
    worker = await getWorker()
  } catch (err) {
    throw new OcrLoadError(err)
  }
  try {
    await worker.setParameters({ tessedit_char_whitelist: allowed })
    const { data } = await worker.recognize(img)
    return { text: data.text, confidence: data.confidence }
  } catch {
    // Une zone illisible (image trop petite…) ne doit pas faire échouer tout le scan.
    return { text: '', confidence: 0 }
  }
}

/** Précharge le moteur OCR (appelé quand on ouvre la caméra, pour gagner du temps). */
export function warmUpOcr() {
  void getWorker().catch(() => {})
}
