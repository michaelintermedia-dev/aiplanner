import { useColorScheme } from 'react-native'

// Same palette as the web app (web/src/index.css).
const light = {
  bg: '#f6f6f4',
  surface: '#ffffff',
  surface2: '#f0f0ed',
  border: '#e3e3de',
  text: '#1d1d1b',
  muted: '#6f6f69',
  accent: '#4f5bd5',
  accentSoft: '#e8eafb',
  accentText: '#ffffff',
  danger: '#c2413a',
  warn: '#b7791f',
  appointment: '#4f5bd5',
  task: '#2f855a',
}

const dark: typeof light = {
  bg: '#121212',
  surface: '#1b1b1b',
  surface2: '#242424',
  border: '#2e2e2e',
  text: '#ececea',
  muted: '#9a9a94',
  accent: '#8b94f5',
  accentSoft: '#262a4d',
  accentText: '#121212',
  danger: '#ef7a72',
  warn: '#e0b35a',
  appointment: '#8b94f5',
  task: '#68c792',
}

export type Colors = typeof light

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light
}
