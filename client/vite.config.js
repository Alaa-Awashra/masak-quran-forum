import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// في التطوير: الواجهة على 5173 والـ API على 4000 (يمرَّر عبر proxy فتبقى الكوكيز same-origin)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
});
