import { createContext, useContext } from 'react'

export const InPanel = createContext(false)

/**
 * One layer only (user's rule, 2026-10-10): inside a screen's frosted panel a card
 * drops its own background and frame - its content sits on the panel itself.
 */
export function useCardStyle() {
  return useContext(InPanel) ? flatCard : null
}

/** Inside a screen's frosted panel (see useCardStyle). */
export const useInPanel = () => useContext(InPanel)

/** The flat card style itself - for a screen that draws its own panel (Settings). */
export const flatCard = { backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0, padding: 0, paddingHorizontal: 0 } as const
