import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// VITE_BASE：GitHub Pages 子路径部署时设为 /<仓库名>/；自有服务器根路径部署时保持 /
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
