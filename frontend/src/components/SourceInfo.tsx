import type { ClimateIndex } from '../api/types'
import { formatMonth } from '../format'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' })

export function SourceInfo({ index }: { index: ClimateIndex }) {
  const imp = index.last_import
  return (
    <section className="card source" aria-labelledby="source-title">
      <h2 id="source-title">Source et traçabilité</h2>
      <p>{index.description}</p>
      <dl className="source-list">
        <dt>Indice</dt>
        <dd>
          {index.name} ({index.code}), {index.version}
        </dd>
        <dt>Producteur</dt>
        <dd>
          <a href={index.source.url} target="_blank" rel="noreferrer">
            {index.source.organization}
          </a>
        </dd>
        {index.first_period && index.last_period && (
          <>
            <dt>Couverture</dt>
            <dd>
              {formatMonth(index.first_period)} à {formatMonth(index.last_period)}
            </dd>
          </>
        )}
        {imp && (
          <>
            <dt>Extraction NOAA</dt>
            <dd>{dateFormatter.format(new Date(imp.extracted_at))}</dd>
            <dt>Dernier import</dt>
            <dd>
              {imp.rows_read} lignes lues, {imp.rows_inserted} insérées, {imp.rows_updated} mises à jour,{' '}
              {imp.rows_rejected} rejetées
            </dd>
            <dt>Empreinte SHA-256</dt>
            <dd>
              <code title={imp.file_sha256}>{imp.file_sha256.slice(0, 16)}…</code>
            </dd>
          </>
        )}
      </dl>
    </section>
  )
}
