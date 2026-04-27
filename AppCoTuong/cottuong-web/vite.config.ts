import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Dev only: chuyển /api sang backend local
      '/api': {
        target: 'http://localhost:5041',
        changeOrigin: true,
      }
    }
  },
  build: {
    // Build ra wwwroot để API serve (dùng khi build thủ công)
    outDir: '../CoTuongAPI/wwwroot',
    emptyOutDir: true,
  }
})
