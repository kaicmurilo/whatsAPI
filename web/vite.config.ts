import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Mesmas portas altas do docker-compose.local.yml (evitam conflito com 3000/5173 de outros projetos)
const DEV_PORT = Number(process.env.WHATSAPI_WEB_DEV_PORT ?? 47320)
const API_TARGET = process.env.VITE_API_TARGET ?? `http://localhost:${process.env.WHATSAPI_LOCAL_PORT ?? 47321}`

// Em produção o Express serve o build em /app; em dev o Vite faz proxy da API
export default defineConfig({
  base: '/app/',
  plugins: [react()],
  server: {
    port: DEV_PORT,
    strictPort: true,
    proxy: {
      '/auth': API_TARGET,
      '/session': API_TARGET,
      '/panel': API_TARGET,
    },
  },
})
