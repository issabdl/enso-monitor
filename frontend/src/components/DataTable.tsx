import type { Observation } from '../api/types'
import { formatAnomaly } from '../format'

interface Props {
  observations: Observation[]
  unit: string
}

function phase(value: number) {
  if (value >= 0.5) return { label: 'El Niño', className: 'tag tag-warm' }
  if (value <= -0.5) return { label: 'La Niña', className: 'tag tag-cold' }
  return { label: 'Neutre', className: 'tag' }
}

/** Alternative au graphique : toutes les valeurs dans un tableau accessible. */
export function DataTable({ observations, unit }: Props) {
  return (
    <details className="data-table">
      <summary>Voir les {observations.length} valeurs sous forme de tableau</summary>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Tableau des valeurs ONI">
        <table>
          <caption className="visually-hidden">Valeurs de l'ONI par saison glissante</caption>
          <thead>
            <tr>
              <th scope="col">Saison</th>
              <th scope="col">Année</th>
              <th scope="col">Anomalie ({unit})</th>
              <th scope="col">Température Niño 3.4 ({unit})</th>
              <th scope="col">Seuil</th>
            </tr>
          </thead>
          <tbody>
            {observations.map((o) => {
              const p = phase(o.anomaly)
              return (
                <tr key={o.period}>
                  <td>{o.season}</td>
                  <td>{o.year}</td>
                  <td className="num">{formatAnomaly(o.anomaly)}</td>
                  <td className="num">{o.total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                  <td>
                    <span className={p.className}>{p.label}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}
