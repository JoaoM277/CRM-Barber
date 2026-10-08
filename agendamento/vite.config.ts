import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Página de agendamento do cliente final (o link que a barbearia divulga).
// Publicada em /agendar/ dentro do front estático; o nginx serve /?b=slug e
// /index.html?b=slug a partir dela (links antigos continuam valendo).
export default defineConfig({
  base: '/agendar/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(__dirname, '../front-end/agendar'),
    emptyOutDir: true,
  },
})
