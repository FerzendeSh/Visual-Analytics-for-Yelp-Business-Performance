import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    fs: {
      allow: ['..']
    }
  },
  publicDir: 'public',
  resolve: {
    alias: {
      '@data': path.resolve(__dirname, '../data')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
