/**
 * Test frontend : un changement de période déclenche un nouvel appel API
 * et met à jour les valeurs affichées.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Observation } from './api/types'

const SEASONS = ['DJF', 'JFM', 'FMA', 'MAM', 'AMJ', 'MJJ', 'JJA', 'JAS', 'ASO', 'SON', 'OND', 'NDJ']

// Série fictive de test : 1997-01 -> 1998-12, valeurs croissantes puis décroissantes.
const SERIES: Observation[] = Array.from({ length: 24 }, (_, i) => {
  const year = 1997 + Math.floor(i / 12)
  const month = (i % 12) + 1
  const anomaly = Math.round((i < 12 ? i * 0.2 : (23 - i) * 0.2) * 100) / 100
  return {
    period: `${year}-${String(month).padStart(2, '0')}-01`,
    season: SEASONS[month - 1],
    year,
    anomaly,
    total: 26.5 + anomaly,
  }
})

const SOURCE = { name: 'NOAA CPC ONI', organization: 'NOAA Climate Prediction Center (CPC)', url: 'https://www.cpc.ncep.noaa.gov/' }

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

function fakeApi(input: RequestInfo | URL) {
  const url = new URL(String(input), 'http://localhost')
  if (url.pathname === '/api/v1/indices') {
    return json([
      {
        code: 'ONI',
        name: 'Oceanic Nino Index',
        unit: '°C',
        version: 'ONI v6',
        description: 'Anomalie Niño 3.4',
        source: SOURCE,
        last_import: null,
        first_period: '1997-01-01',
        last_period: '1998-12-01',
      },
    ])
  }
  if (url.pathname === '/api/v1/indices/ONI/observations') {
    const start = url.searchParams.get('start') ?? '0000-00'
    const end = url.searchParams.get('end') ?? '9999-99'
    const observations = SERIES.filter((o) => o.period.slice(0, 7) >= start && o.period.slice(0, 7) <= end)
    return json({ index: 'ONI', unit: '°C', source: SOURCE, start, end, count: observations.length, observations })
  }
  if (url.pathname === '/api/v1/indices/ONI/episodes') {
    return json({ index: 'ONI', rule: 'règle', intensity_scale: 'échelle', episodes: [] })
  }
  return json({ detail: 'introuvable' }, 404)
}

describe('Évolution de l’ONI', () => {
  const fetchMock = vi.fn(fakeApi)

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockClear()
  })

  it('met à jour les valeurs affichées quand la période change', async () => {
    const user = userEvent.setup()
    render(<App />)

    // Série complète au chargement : 24 saisons, maximum +2,20
    expect(await screen.findByTestId('stat-count')).toHaveTextContent('24')
    expect(screen.getByTestId('stat-max')).toHaveTextContent('+2,20')

    // Nouvelle période : janvier à mars 1997 (valeurs 0 ; 0,2 ; 0,4)
    // <input type="month"> : jsdom ne gère pas la saisie caractère par caractère, on fixe la valeur.
    fireEvent.change(screen.getByLabelText('Début'), { target: { value: '1997-01' } })
    fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '1997-03' } })
    await user.click(screen.getByRole('button', { name: 'Afficher' }))

    await waitFor(() => expect(screen.getByTestId('stat-count')).toHaveTextContent('3'))
    expect(screen.getByTestId('stat-max')).toHaveTextContent('+0,40')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/indices/ONI/observations?start=1997-01&end=1997-03',
      expect.anything(),
    )
  })

  it('refuse une période inversée sans appeler l’API', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('stat-count')
    const callsBefore = fetchMock.mock.calls.length

    fireEvent.change(screen.getByLabelText('Début'), { target: { value: '1998-06' } })
    fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '1997-02' } })
    await user.click(screen.getByRole('button', { name: 'Afficher' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Le mois de début doit précéder le mois de fin.')
    expect(fetchMock.mock.calls.length).toBe(callsBefore)
  })

  it("affiche un message d'erreur si l'API est injoignable", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent("Impossible de joindre l'API")
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    fetchMock.mockImplementation(fakeApi)
  })
})
