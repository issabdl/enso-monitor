interface Props {
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

/** Affiche le chargement (annoncé poliment) ou l'erreur (annoncée immédiatement). */
export function StatusMessage({ loading, error, onRetry }: Props) {
  if (error) {
    return (
      <div className="status status-error" role="alert">
        <p>{error}</p>
        {onRetry && (
          <button type="button" className="button-secondary" onClick={onRetry}>
            Réessayer
          </button>
        )}
      </div>
    )
  }
  if (loading) {
    return (
      <p className="status" role="status">
        Chargement…
      </p>
    )
  }
  return null
}
