import { useCallback, useEffect, useState } from 'react'

interface State<T> {
  data: T | null
  error: string | null
  loading: boolean
}

/**
 * Exécute un appel API à chaque changement de `key` et annule la requête précédente
 * (évite qu'une réponse lente écrase une réponse plus récente).
 */
export function useApi<T>(fetcher: ((signal: AbortSignal) => Promise<T>) | null, key: string) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: fetcher !== null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!fetcher) return
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    fetcher(controller.signal)
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        const message = error instanceof Error ? error.message : 'Erreur inattendue'
        setState({ data: null, error: message, loading: false })
      })
    return () => controller.abort()
    // `key` résume les paramètres de `fetcher` : c'est lui qui déclenche le rechargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, retry }
}
