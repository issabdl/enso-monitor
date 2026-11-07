import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// En développement, /api est relayé vers la pile Docker (Caddy sur le port 8080).
const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': apiTarget },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
