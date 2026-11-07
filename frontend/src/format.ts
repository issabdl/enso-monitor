import type { Observation, Phase } from './api/types'

const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "1997-12-01" -> "déc. 1997" */
export function formatMonth(isoDate: string): string {
  return monthFormatter.format(new Date(`${isoDate.slice(0, 10)}T00:00:00Z`))
}

/** "1997-12-01" -> "1997-12" (valeur d'un <input type="month">) */
export function toMonth(isoDate: string): string {
  return isoDate.slice(0, 7)
}

/** 1.234 -> "+1,23" */
export function formatAnomaly(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${Math.abs(value).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const PHASE_LABEL: Record<Phase, string> = {
  el_nino: 'El Niño',
  la_nina: 'La Niña',
  neutre: 'Neutre',
}

/** Alternative textuelle du graphique, lisible par les lecteurs d'écran. */
export function chartSummary(observations: Observation[], unit: string): string {
  if (!observations.length) return 'Aucune donnée sur la période.'
  const first = observations[0]
  const last = observations[observations.length - 1]
  const maxObs = observations.reduce((a, b) => (b.anomaly > a.anomaly ? b : a))
  const minObs = observations.reduce((a, b) => (b.anomaly < a.anomaly ? b : a))
  return (
    `Courbe de l'ONI de ${formatMonth(first.period)} à ${formatMonth(last.period)}. ` +
    `Maximum ${formatAnomaly(maxObs.anomaly)} ${unit} en ${maxObs.season} ${maxObs.year}, ` +
    `minimum ${formatAnomaly(minObs.anomaly)} ${unit} en ${minObs.season} ${minObs.year}.`
  )
}
