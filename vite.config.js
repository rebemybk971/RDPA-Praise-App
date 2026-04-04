import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallback: null,
        navigateFallbackDenylist: [/.*/]
      },
      manifest: {
        name: 'Louange RDPA',
        short_name: 'RDPA',
        description: 'Révélation Du Premier Amour — Répertoire de louange',
        theme_color: '#4BBFE8',
        background_color: '#FAFCFE',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      }
    })
  ]
})
