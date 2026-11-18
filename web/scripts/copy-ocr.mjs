// Copie les fichiers de l'OCR (Tesseract) dans public/ocr/.
// Ainsi l'appli les sert elle-même : pas de dépendance à un site externe,
// et ils peuvent être gardés en cache pour fonctionner hors ligne.
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const nm = join(root, 'node_modules')
const out = join(root, 'public', 'ocr')
mkdirSync(out, { recursive: true })

const files = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // Moteur de reconnaissance (WebAssembly), 3 variantes selon le téléphone.
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  // Données de langue française (version compacte).
  ['@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz', 'fra.traineddata.gz'],
]

for (const [from, to] of files) {
  const src = join(nm, from)
  if (!existsSync(src)) throw new Error(`Fichier OCR introuvable : ${from} (as-tu lancé npm install ?)`)
  cpSync(src, join(out, to))
}
console.log('OCR : fichiers copiés dans public/ocr')
