import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: true,
    allowedHosts: ['host.docker.internal'],
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
