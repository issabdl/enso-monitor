import { useId, useState, type FormEvent } from 'react'
import type { Period } from '../api/types'

interface Props {
  value: Period
  min: string
  max: string
  onChange: (period: Period) => void
}

interface Preset {
  label: string
  period: Period
}

export function PeriodFilter({ value, min, max, onChange }: Props) {
  const [draft, setDraft] = useState<Period>(value)
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()

  const presets: Preset[] = [
    { label: 'Toute la série', period: { start: min, end: max } },
    { label: 'Depuis 2000', period: { start: '2000-01', end: max } },
    { label: '1982-1983', period: { start: '1981-06', end: '1984-06' } },
    { label: '1997-1998', period: { start: '1996-06', end: '1999-06' } },
    { label: '2015-2016', period: { start: '2014-06', end: '2017-06' } },
  ]

  function apply(period: Period) {
    if (!period.start || !period.end) {
      setError('Renseignez un mois de début et un mois de fin.')
      return
    }
    if (period.start > period.end) {
      setError('Le mois de début doit précéder le mois de fin.')
      return
    }
    setError(null)
    setDraft(period)
    onChange(period)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    apply(draft)
  }

  const isActive = (p: Period) => p.start === value.start && p.end === value.end

  return (
    <form className="period-filter" onSubmit={handleSubmit} aria-label="Filtre de période">
      <div className="period-fields">
        <label>
          Début
          <input
            type="month"
            name="start"
            min={min}
            max={max}
            value={draft.start}
            onChange={(e) => setDraft({ ...draft, start: e.target.value })}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error !== null}
          />
        </label>
        <label>
          Fin
          <input
            type="month"
            name="end"
            min={min}
            max={max}
            value={draft.end}
            onChange={(e) => setDraft({ ...draft, end: e.target.value })}
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error !== null}
          />
        </label>
        <button type="submit" className="button-primary">
          Afficher
        </button>
      </div>
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="presets" role="group" aria-label="Périodes prédéfinies">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="chip"
            aria-pressed={isActive(preset.period)}
            onClick={() => apply(preset.period)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </form>
  )
}
