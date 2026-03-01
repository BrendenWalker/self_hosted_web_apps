import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    // SPA fallback: serve index.html for routes that don't match a file (e.g. /recipes/1 on refresh)
    {
      name: 'spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.method !== 'GET' || req.url?.startsWith('/api/') || req.url?.includes('.')) {
            return next()
          }
          req.url = '/index.html'
          next()
        })
      },
    },
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    reporters: process.env.CI ? ['default', ['junit', { outputFile: 'test-results/junit.xml' }]] : 'default',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
