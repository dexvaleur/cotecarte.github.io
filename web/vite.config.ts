import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Configuration de Vite (l'outil qui compile et sert l'application).
export default defineConfig({
  // Chemins relatifs : l'appli fonctionne aussi dans un sous-dossier (ex. GitHub Pages).
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    // Rend l'appli installable (PWA) et utilisable hors ligne.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Poké Card',
        short_name: 'Poké Card',
        description: 'Scanne tes cartes Pokémon, découvre leur valeur et gère ta collection.',
        lang: 'fr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e1020',
        theme_color: '#5b4cf5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Les fichiers OCR sont lourds : on ne les télécharge qu'au premier scan.
        globIgnores: ['ocr/**'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Moteur OCR : gardé en cache après le premier scan (marche ensuite hors ligne).
            urlPattern: ({ url }) => url.pathname.includes('/ocr/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ocr', expiration: { maxEntries: 10 } },
          },
          {
            // Images des cartes : elles ne changent jamais.
            urlPattern: ({ url }) => url.hostname === 'assets.tcgdex.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-images',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 90 },
              // 0 = réponse « opaque » d'un autre site, normale pour une image affichée.
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
