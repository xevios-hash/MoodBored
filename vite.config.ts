import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  // Stable per-build id: the service worker registers as sw.js?v=<id>, so a
  // rebuild always installs a fresh worker and purges stale caches.
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(Date.now().toString(36)),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  base: process.env.BASE_URL || '/',
  server: {
    port: 1420,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          store: ['zustand'],
          ui: ['lucide-react'],
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
})
