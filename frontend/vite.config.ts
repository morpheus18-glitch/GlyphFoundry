import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@qce-wasm': '/native/rust/qce_kernels/bindings/wasm/pkg'
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: ['*'],
    proxy: {
      '/graph3d': 'http://localhost:8000',
      '/tags': 'http://localhost:8000',
      '/api': 'http://localhost:8000'
    }
  },
  build: { outDir: 'dist' }
})
