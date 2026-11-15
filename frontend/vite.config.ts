import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const publicApiOrigin = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL?.trim() ?? ''
  return {
    plugins: [
      {
        name: 'stratify-api-origin-csp',
        enforce: 'pre',
        transformIndexHtml(html: string) {
          return html.replaceAll('__STRATIFY_API_ORIGIN__', publicApiOrigin)
        },
      },
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        '/api': 'http://127.0.0.1:5000',
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
