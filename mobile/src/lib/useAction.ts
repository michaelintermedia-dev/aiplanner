import { useMutation, useQueryClient } from '@tanstack/react-query'

/**
 * Wraps a write call (create/complete/delete...) and refetches every query
 * afterwards. Tasks and appointments show up in Today, Tasks and Calendar at
 * once, so invalidating everything is simpler and safer than tracking which
 * screens each change affects.
 */
export function useAction<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => queryClient.invalidateQueries(),
  })
}
