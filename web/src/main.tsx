import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApiError } from './api/client'
import { App } from './App'
import { AuthProvider } from './auth/AuthContext'
import './index.css'
import { applyAppearance } from './lib/appearance'

// This device's last appearance, before anything is drawn (the account's follows once signed in).
applyAppearance()

// The staging copy (deploy/compose.staging.yaml) says so on every page and in the tab's title.
const stage = import.meta.env.VITE_STAGE as string | undefined
if (stage) {
  const ribbon = document.createElement('div')
  ribbon.className = 'stage-ribbon'
  ribbon.textContent = stage.toUpperCase()
  document.body.appendChild(ribbon)
  document.title = `[${stage}] ${document.title}`
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retrying 4xx responses (validation, not found, auth) never helps.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
