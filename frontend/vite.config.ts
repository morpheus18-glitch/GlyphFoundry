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
    host: true,
    port: 5173
  },
  build: { outDir: 'dist' }
})
