import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Supportet sowohl lokale Entwicklung als auch GitHub-Projektseiten.
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = repository && !repository.endsWith('.github.io') ? `/${repository}/` : '/'

export default defineConfig({
  plugins: [react()],
  base,
})
