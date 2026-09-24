import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  base: process.env.BASE_URL || '/',
  server: {
    port: 1420,
    strictPort: false,
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
