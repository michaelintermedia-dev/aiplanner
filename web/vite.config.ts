import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
  server: {
    port: Number(process.env.PORT ?? 3000),
    proxy: {
      '/api': { target: apiUrl, changeOrigin: true, secure: false },
    },
  },
})
