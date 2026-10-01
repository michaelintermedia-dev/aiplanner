import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, searchForWorkspaceRoot } from 'vite'

// Code shared with the mobile app (API types, date helpers) lives in ../shared.
const sharedDir = fileURLToPath(new URL('../shared', import.meta.url))

// The browser only ever talks to the Vite dev server; /api is proxied to the
// .NET API. That keeps the API origin out of the client code and avoids CORS
// and self-signed-certificate issues in development. When started through the
// Aspire AppHost, the API URL is injected as services__api__https__0.
const apiUrl =
  process.env.services__api__https__0 ??
  process.env.services__api__http__0 ??
  'https://localhost:58442'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@shared': sharedDir },
  },
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), sharedDir] },
    port: Number(process.env.PORT ?? 5173),
    // Fail rather than drift to another port: the AppHost pins this one.
    strictPort: true,
    proxy: {
      '/api': { target: apiUrl, changeOrigin: true, secure: false },
    },
  },
})
