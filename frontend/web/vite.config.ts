import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API = process.env.VITE_PROXY_TARGET ?? "http://localhost:8000";

const config = defineConfig({
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
  ],
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/api":    { target: API, changeOrigin: true },
      "/auth":   { target: API, changeOrigin: true },
      "/health": { target: API, changeOrigin: true },
      "/static": { target: API, changeOrigin: true },
      "/ws":     { target: API, changeOrigin: true, ws: true }
    },
  },
})

export default config