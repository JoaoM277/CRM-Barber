import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Servido em https://barber.usevellis.tech/painel/ (ao lado do painel antigo,
// enquanto a migração acontece). Em dev: `npm run dev` e abra /painel/.
export default defineConfig({
  base: '/painel/',
  plugins: [react(), tailwindcss()],
  build: {
    // publicado dentro do front estático (a pasta que os sites já servem); fora do git
    outDir: path.resolve(__dirname, '../front-end/painel'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
