import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/auth': { target: 'http://localhost:3001', changeOrigin: true },
      '/api/users': { target: 'http://localhost:3002', changeOrigin: true },
      '/api/admin': { target: 'http://localhost:3002', changeOrigin: true },
      '/api/jobs': { target: 'http://localhost:3003', changeOrigin: true },
      '/api/applications': { target: 'http://localhost:3003', changeOrigin: true },
      '/api/match': { target: 'http://localhost:8000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3002', changeOrigin: true }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov']
    }
  }
})
