import { useEffect } from 'react'
import { useServerStore } from '@/store/useServerStore'

export function useConfig() {
  const fetchConfig = useServerStore((s) => s.fetchConfig)
  const loading = useServerStore((s) => s.configLoading)
  const error = useServerStore((s) => s.configError)

  useEffect(() => {
    void fetchConfig()
  }, [fetchConfig])

  return { loading, error }
}
