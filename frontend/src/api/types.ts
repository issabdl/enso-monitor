// Types alignés sur les schémas Pydantic de l'API (backend/app/schemas.py).

export type Phase = 'el_nino' | 'la_nina' | 'neutre'

export interface Source {
  name: string
  organization: string
  url: string
}

export interface DataImport {
  id: number
  file_url: string
  file_sha256: string
  extracted_at: string
  imported_at: string
  rows_read: number
  rows_inserted: number
  rows_updated: number
  rows_rejected: number
  status: 'success' | 'failed'
}

export interface ClimateIndex {
  code: string
  name: string
  unit: string
  version: string
  description: string
  source: Source
  last_import: DataImport | null
  first_period: string | null
  last_period: string | null
}

export interface Observation {
  period: string
  season: string
  year: number
  anomaly: number
  total: number
}

export interface ObservationsResponse {
  index: string
  unit: string
  source: Source
  start: string | null
  end: string | null
  count: number
  observations: Observation[]
}

export interface Episode {
  kind: Exclude<Phase, 'neutre'>
  start: string
  end: string
  seasons: number
  peak: number
  peak_period: string
  peak_label: string
  mean: number
  intensity: string
  ongoing: boolean
}

export interface EpisodesResponse {
  index: string
  rule: string
  intensity_scale: string
  episodes: Episode[]
}

export interface PeriodSummary {
  start: string
  end: string
  seasons: number
  mean: number
  max: number
  min: number
  peak: number
  peak_label: string
  el_nino_seasons: number
  la_nina_seasons: number
  dominant_phase: Phase
}

export interface CompareResponse {
  index: string
  unit: string
  a: PeriodSummary
  b: PeriodSummary
  aligned: { offset: number; a: number | null; b: number | null }[]
  interpretation: string[]
  caveats: string[]
}

/** Période au format AAAA-MM (bornes incluses). */
export interface Period {
  start: string
  end: string
}
