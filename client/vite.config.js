import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), VitePWA({
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.js',
    registerType: 'autoUpdate',
    includeAssets: ['logo.jpg', 'logo-2.jpg'],
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,woff2}'],
      maximumFileSizeToCacheInBytes: 4500000,
    },
    manifest: {
      name: 'منصة MK التعليمية',
      short_name: 'MK',
      description: 'منصة تعليمية تفاعلية متعددة الأقسام',
      lang: 'ar',
      dir: 'rtl',
      display: 'standalone',
      orientation: 'any',
      start_url: '/',
      scope: '/',
      background_color: '#0f172a',
      theme_color: '#0f172a',
      icons: [
        { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
  })],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8090',
    },
  },
});