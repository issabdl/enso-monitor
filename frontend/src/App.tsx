import { useState } from 'react'
import { api } from './api/client'
import type { ClimateIndex, Period } from './api/types'
import { DataTable } from './components/DataTable'
import { EpisodeCompare } from './components/EpisodeCompare'
import { OniChart } from './components/OniChart'
import { PeriodFilter } from './components/PeriodFilter'
import { SeriesStats } from './components/SeriesStats'
import { SourceInfo } from './components/SourceInfo'
import { StatusMessage } from './components/StatusMessage'
import { chartSummary, toMonth } from './format'
import { useApi } from './hooks/useApi'

const INDEX_CODE = 'ONI'

export default function App() {
  const indices = useApi((signal) => api.indices(signal), 'indices')
  const index = indices.data?.find((i) => i.code === INDEX_CODE)

  return (
    <>
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <header className="site-header">
        <div className="container">
          <p className="eyebrow">NOAA · Oceanic Niño Index</p>
          <h1>ENSO Monitor</h1>
          <p className="lead">
            Explorer les épisodes El Niño et La Niña depuis 1950 à partir des mesures officielles de
            température de surface du Pacifique équatorial (région Niño 3.4).
          </p>
        </div>
      </header>

      <main id="contenu" className="container">
        {indices.loading || indices.error ? (
          <StatusMessage loading={indices.loading} error={indices.error} onRetry={indices.retry} />
        ) : index?.first_period && index.last_period ? (
          <Dashboard index={index} />
        ) : (
          <p className="status" role="alert">
            Aucune donnée ONI disponible : lancez l'import (voir README).
          </p>
        )}
      </main>

      <footer className="site-footer">
        <div className="container">
          Données : NOAA Climate Prediction Center. Aucune prévision n'est proposée sur ce site.{' '}
          <a href="/api/docs">Documentation de l'API</a>
        </div>
      </footer>
    </>
  )
}

function Dashboard({ index }: { index: ClimateIndex }) {
  const min = toMonth(index.first_period!)
  const max = toMonth(index.last_period!)
  const [period, setPeriod] = useState<Period>({ start: min, end: max })
  const observations = useApi(
    (signal) => api.observations(index.code, period, signal),
    `observations-${period.start}-${period.end}`,
  )
  const data = observations.data

  return (
    <>
      <section className="card" aria-labelledby="series-title">
        <h2 id="series-title">Évolution de l'ONI</h2>
        <p className="muted">
          Anomalie de température de surface de la mer ({index.unit}), moyenne glissante sur 3 mois. Au-dessus
          de +0,5 : conditions El Niño ; en dessous de −0,5 : conditions La Niña.
        </p>

        <PeriodFilter value={period} min={min} max={max} onChange={setPeriod} />

        <StatusMessage
          loading={observations.loading && !data}
          error={observations.error}
          onRetry={observations.retry}
        />

        {data && (
          <div className={observations.loading ? 'is-refreshing' : undefined} aria-busy={observations.loading}>
            <figure className="figure">
              <OniChart observations={data.observations} unit={data.unit} />
              <figcaption>
                <span className="legend-item legend-warm">El Niño (≥ +0,5)</span>
                <span className="legend-item legend-cold">La Niña (≤ −0,5)</span>
                <span className="figure-source">
                  Source : {data.source.organization}, indice {data.index}
                </span>
                <span className="visually-hidden">{chartSummary(data.observations, data.unit)}</span>
              </figcaption>
            </figure>
            <SeriesStats observations={data.observations} unit={data.unit} />
            <DataTable observations={data.observations} unit={data.unit} />
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="compare-title">
        <h2 id="compare-title">Comparer deux épisodes historiques</h2>
        <EpisodeCompare indexCode={index.code} unit={index.unit} />
      </section>

      <SourceInfo index={index} />
    </>
  )
}
