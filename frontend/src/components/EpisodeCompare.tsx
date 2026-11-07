import { useId, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import type { Episode, PeriodSummary } from '../api/types'
import { COLORS } from '../colors'
import { formatAnomaly, formatMonth, PHASE_LABEL, toMonth } from '../format'
import { useApi } from '../hooks/useApi'
import { StatusMessage } from './StatusMessage'

const key = (e: Episode) => e.start

function episodeLabel(e: Episode) {
  const ongoing = e.ongoing ? ', en cours' : ''
  return `${PHASE_LABEL[e.kind]} · ${formatMonth(e.start)} à ${formatMonth(e.end)} · pic ${formatAnomaly(e.peak)} (${e.intensity}${ongoing})`
}

/** Choix par défaut : les El Niño culminant en 1997 et en 2015, souvent comparés. */
function defaultPair(episodes: Episode[]): [string, string] {
  const find = (year: string) => episodes.find((e) => e.kind === 'el_nino' && e.peak_period.startsWith(year))
  const a = find('1997') ?? episodes[0]
  const b = find('2015') ?? episodes[episodes.length - 1]
  return [a ? key(a) : '', b ? key(b) : '']
}

interface Props {
  indexCode: string
  unit: string
}

export function EpisodeCompare({ indexCode, unit }: Props) {
  const episodes = useApi((signal) => api.episodes(indexCode, signal), `episodes-${indexCode}`)
  const [selection, setSelection] = useState<[string, string] | null>(null)
  const selectA = useId()
  const selectB = useId()

  const list = episodes.data?.episodes ?? []
  const [keyA, keyB] = selection ?? defaultPair(list)
  const a = list.find((e) => key(e) === keyA)
  const b = list.find((e) => key(e) === keyB)

  const comparison = useApi(
    a && b
      ? (signal) =>
          api.compare(
            indexCode,
            { start: toMonth(a.start), end: toMonth(a.end) },
            { start: toMonth(b.start), end: toMonth(b.end) },
            signal,
          )
      : null,
    `compare-${keyA}-${keyB}`,
  )

  if (episodes.loading || episodes.error) {
    return <StatusMessage loading={episodes.loading} error={episodes.error} onRetry={episodes.retry} />
  }

  const data = comparison.data
  const options = list.map((e) => (
    <option key={key(e)} value={key(e)}>
      {episodeLabel(e)}
    </option>
  ))

  return (
    <>
      <p className="muted">
        Règle de détection : {episodes.data?.rule}. {list.length} épisodes détectés depuis 1950. Classe
        d'intensité indicative, non officielle ({episodes.data?.intensity_scale}).
      </p>

      <div className="compare-selects">
        <div className="field">
          <label htmlFor={selectA}>Épisode A</label>
          <select id={selectA} value={keyA} onChange={(e) => setSelection([e.target.value, keyB])}>
            {options}
          </select>
        </div>
        <div className="field">
          <label htmlFor={selectB}>Épisode B</label>
          <select id={selectB} value={keyB} onChange={(e) => setSelection([keyA, e.target.value])}>
            {options}
          </select>
        </div>
      </div>

      <StatusMessage loading={comparison.loading} error={comparison.error} onRetry={comparison.retry} />

      {data && !comparison.loading && (
        <div className="compare-result">
          <div className="chart chart-small" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.aligned} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
                <CartesianGrid stroke={COLORS.grid} vertical={false} />
                <XAxis
                  dataKey="offset"
                  tick={{ fill: COLORS.muted, fontSize: 12 }}
                  label={{
                    value: "Mois depuis le début de l'épisode",
                    position: 'insideBottom',
                    offset: -14,
                    fill: COLORS.muted,
                    fontSize: 12,
                  }}
                />
                <YAxis
                  tickFormatter={(v: number) => formatAnomaly(v)}
                  tick={{ fill: COLORS.muted, fontSize: 12 }}
                  width={52}
                />
                <ReferenceLine y={0} stroke={COLORS.muted} />
                <Tooltip
                  formatter={(value) => `${formatAnomaly(Number(value))} ${unit}`}
                  labelFormatter={(offset) => `Mois ${offset}`}
                />
                <Legend verticalAlign="top" height={28} />
                <Line
                  name="Épisode A"
                  dataKey="a"
                  stroke={COLORS.seriesA}
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  name="Épisode B"
                  dataKey="b"
                  stroke={COLORS.seriesB}
                  strokeWidth={2.5}
                  strokeDasharray="6 3"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <CompareTable a={data.a} b={data.b} unit={unit} />

          <div className="compare-text">
            <div>
              <h3>Interprétation</h3>
              <ul className="interpretation">
                {data.interpretation.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Limites</h3>
              <ul className="caveats">
                {data.caveats.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CompareTable({ a, b, unit }: { a: PeriodSummary; b: PeriodSummary; unit: string }) {
  const rows: [string, (s: PeriodSummary) => string][] = [
    ['Période', (s) => `${formatMonth(s.start)} à ${formatMonth(s.end)}`],
    ['Durée', (s) => `${s.seasons} saisons`],
    ['Pic', (s) => `${formatAnomaly(s.peak)} ${unit} (${s.peak_label})`],
    ['Moyenne', (s) => `${formatAnomaly(s.mean)} ${unit}`],
    ['Phase dominante', (s) => PHASE_LABEL[s.dominant_phase]],
  ]
  return (
    <div className="table-scroll">
      <table className="compare-table">
        <caption className="visually-hidden">Comparaison chiffrée des deux épisodes</caption>
        <thead>
          <tr>
            <th scope="col">Mesure</th>
            <th scope="col">
              <span className="swatch" style={{ borderColor: COLORS.seriesA }} aria-hidden="true" />
              Épisode A
            </th>
            <th scope="col">
              <span className="swatch swatch-dashed" style={{ borderColor: COLORS.seriesB }} aria-hidden="true" />
              Épisode B
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value(a)}</td>
              <td>{value(b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
