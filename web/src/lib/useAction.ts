import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'

/**
 * Wraps a write call (create/complete/delete...) and refetches every query
 * afterwards. Tasks and appointments show up in Today, Tasks and Calendar at
 * once, so invalidating everything is simpler and safer than tracking which
 * views each change affects.
 *
 * `forget` names queries to drop instead of refetch - e.g. the detail query of
 * an item being deleted, which would otherwise be refetched and 404.
 */
export function useAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  { forget }: { forget?: (args: TArgs) => QueryKey } = {},
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: (_data, error, args) => {
      if (forget && !error) queryClient.removeQueries({ queryKey: forget(args) })
      return queryClient.invalidateQueries()
    },
  })
}
