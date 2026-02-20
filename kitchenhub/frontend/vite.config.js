import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    reporters: process.env.CI ? ['default', ['junit', { outputFile: 'test-results/junit.xml' }]] : 'default',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      reportsDirectory: 'coverage',
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:80',
        changeOrigin: true
      }
    }
  }
})
