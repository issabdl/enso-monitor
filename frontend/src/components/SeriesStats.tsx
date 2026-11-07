import type { Observation } from '../api/types'
import { formatAnomaly } from '../format'

interface Props {
  observations: Observation[]
  unit: string
}

export function SeriesStats({ observations, unit }: Props) {
  if (!observations.length) return null
  const values = observations.map((o) => o.anomaly)
  const maxObs = observations.reduce((a, b) => (b.anomaly > a.anomaly ? b : a))
  const minObs = observations.reduce((a, b) => (b.anomaly < a.anomaly ? b : a))
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const warm = values.filter((v) => v >= 0.5).length
  const cold = values.filter((v) => v <= -0.5).length

  const stats = [
    { label: 'Saisons affichées', value: String(observations.length), testId: 'stat-count' },
    { label: 'Maximum', value: `${formatAnomaly(maxObs.anomaly)} ${unit}`, hint: `${maxObs.season} ${maxObs.year}`, testId: 'stat-max' },
    { label: 'Minimum', value: `${formatAnomaly(minObs.anomaly)} ${unit}`, hint: `${minObs.season} ${minObs.year}`, testId: 'stat-min' },
    { label: 'Moyenne', value: `${formatAnomaly(mean)} ${unit}`, testId: 'stat-mean' },
    { label: 'Saisons ≥ +0,5', value: String(warm), hint: 'conditions El Niño', testId: 'stat-warm' },
    { label: 'Saisons ≤ −0,5', value: String(cold), hint: 'conditions La Niña', testId: 'stat-cold' },
  ]

  return (
    <dl className="stats">
      {stats.map((s) => (
        <div key={s.label} className="stat">
          <dt>{s.label}</dt>
          <dd data-testid={s.testId}>{s.value}</dd>
          {s.hint && <dd className="stat-hint">{s.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}
