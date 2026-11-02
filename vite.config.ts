import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: process.env.GITHUB_PAGES === 'true' ? './' : '/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png'],
        manifest: {
          id: '/',
          name: 'EvoluTigas — Enfermaria, Ambulatório e Calculadoras',
          short_name: 'EvoluTigas',
          description: 'Plataforma médica para evolução clínica de enfermaria, ambulatório inteligente, transcrição de exames, calculadoras médicas e documentos hospitalares.',
          theme_color: '#0f766e',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-router-dom'],
    },
    optimizeDeps: {
      entries: ['index.html', 'src/**/*.{ts,tsx}'],
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-router-dom',
        'lucide-react',
        'motion/react',
        '@pedi-growth/core',
        'clsx',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'jspdf',
        'pdf-lib',
        'pdfjs-dist/legacy/build/pdf.mjs',
        'pdfjs-dist/legacy/build/pdf.worker.mjs',
        'react-markdown',
        'recharts',
        'tailwind-merge',
      ],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom', 'motion'],
            'vendor-pdf': ['jspdf', 'pdf-lib', 'pdfjs-dist', 'html2canvas'],
            'vendor-charts': ['recharts', '@pedi-growth/core', 'who-growth'],
            'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          },
        },
      },
      chunkSizeWarningLimit: 1500,
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: false,
    },
  };
});
