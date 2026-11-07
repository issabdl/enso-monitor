import type {
  ClimateIndex,
  CompareResponse,
  EpisodesResponse,
  ObservationsResponse,
  Period,
} from './types'

const BASE = '/api/v1'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function get<T>(path: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<T> {
  const query = new URLSearchParams(params).toString()
  let response: Response
  try {
    response = await fetch(`${BASE}${path}${query ? `?${query}` : ''}`, { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, "Impossible de joindre l'API. Vérifiez que le serveur est démarré.")
  }
  if (!response.ok) {
    let detail = `Erreur ${response.status}`
    try {
      const body = await response.json()
      // FastAPI renvoie soit une chaîne, soit une liste d'erreurs de validation.
      detail = typeof body.detail === 'string' ? body.detail : 'Paramètres invalides'
    } catch {
      /* corps non JSON : on garde le message générique */
    }
    throw new ApiError(response.status, detail)
  }
  return response.json() as Promise<T>
}

export const api = {
  indices: (signal?: AbortSignal) => get<ClimateIndex[]>('/indices', {}, signal),

  observations: (code: string, period: Period, signal?: AbortSignal) =>
    get<ObservationsResponse>(`/indices/${code}/observations`, { ...period }, signal),

  episodes: (code: string, signal?: AbortSignal) =>
    get<EpisodesResponse>(`/indices/${code}/episodes`, {}, signal),

  compare: (code: string, a: Period, b: Period, signal?: AbortSignal) =>
    get<CompareResponse>(
      `/indices/${code}/compare`,
      { a_start: a.start, a_end: a.end, b_start: b.start, b_end: b.end },
      signal,
    ),
}
