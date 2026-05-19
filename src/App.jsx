import { useMemo, useState } from 'react'
import './App.css'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

function formatDistance(distance) {
  if (!Number.isFinite(distance)) {
    return 'Unknown'
  }

  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(2)} km`
  }

  return `${Math.round(distance)} m`
}

function stopKey(stop, index) {
  return stop.atcocode || stop.tiploc || stop.station_code || `${stop.name}-${index}`
}

function App() {
  const [searchText, setSearchText] = useState('51.5074, -0.1278')
  const [stops, setStops] = useState([])
  const [source, setSource] = useState('London coordinates')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  const filteredStops = useMemo(() => {
    const term = filter.trim().toLowerCase()

    if (!term) {
      return stops
    }

    return stops.filter((stop) =>
      [stop.name, stop.description, stop.atcocode, stop.type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    )
  }, [filter, stops])

  const nearestStop = stops[0]

  async function fetchBusStops() {
    const params = new URLSearchParams({
      query: searchText.trim(),
    })

    const response = await fetch(`${API_BASE_URL}/api/bus-stops?${params}`)
    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const message = data?.detail || 'Bus stop search failed.'
      throw new Error(message)
    }

    return {
      source: data.source || searchText,
      stops: Array.isArray(data.stops) ? data.stops : [],
    }
  }

  async function handleSearch(event) {
    event.preventDefault()
    setStatus('loading')
    setError('')

    try {
      if (!searchText.trim()) {
        throw new Error('Enter a postcode or coordinates.')
      }

      const results = await fetchBusStops()
      setStops(results.stops)
      setSource(results.source)
      setFilter('')
      setStatus('success')
    } catch (searchError) {
      setError(searchError.message)
      setStatus('error')
    }
  }

  function useCurrentLocation() {
    setError('')

    if (!navigator.geolocation) {
      setStatus('error')
      setError('Current location is not available in this browser.')
      return
    }

    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(5)
        const lon = position.coords.longitude.toFixed(5)
        setSearchText(`${lat}, ${lon}`)
        setSource('Current location')
        setStatus('idle')
      },
      () => {
        setStatus('error')
        setError('Could not access current location.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">TransportAPI Places</p>
          <h1>Bus stop dashboard</h1>
        </div>
        <div className="status-pill">
          <span className={`status-dot ${status}`}></span>
          {status === 'loading'
            ? 'Searching'
            : status === 'locating'
              ? 'Locating'
              : `${stops.length} stops`}
        </div>
      </header>

      <section className="control-band">
        <form className="search-panel" onSubmit={handleSearch}>
          <label className="location-field">
            <span>Location</span>
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Postcode or lat, lon"
            />
          </label>

          <div className="actions">
            <button type="button" className="secondary" onClick={useCurrentLocation}>
              Use current location
            </button>
            <button type="submit" disabled={status === 'loading'}>
              Search stops
            </button>
          </div>
        </form>

        {error ? <p className="error-message">{error}</p> : null}
      </section>

      <section className="metrics-grid" aria-label="Bus stop summary">
        <article>
          <span>Total stops</span>
          <strong>{stops.length}</strong>
        </article>
        <article>
          <span>Nearest stop</span>
          <strong>{nearestStop?.name || 'None yet'}</strong>
        </article>
        <article>
          <span>Search source</span>
          <strong>{source}</strong>
        </article>
      </section>

      <section className="results-section">
        <div className="results-toolbar">
          <div>
            <h2>Bus stops</h2>
            <p>{filteredStops.length} visible results</p>
          </div>
          <label className="filter-field">
            <span>Filter</span>
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Name, area, ATCO"
            />
          </label>
        </div>

        <div className="stops-list">
          {filteredStops.length ? (
            filteredStops.map((stop, index) => (
              <article className="stop-row" key={stopKey(stop, index)}>
                <div className="stop-main">
                  <h3>{stop.name || 'Unnamed stop'}</h3>
                  <p>{stop.description || 'No locality provided'}</p>
                </div>
                <div className="stop-meta">
                  <span>{stop.atcocode || 'No ATCO'}</span>
                  <span>{formatDistance(Number(stop.distance))}</span>
                  <span>
                    {Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)
                      ? `${stop.latitude.toFixed(5)}, ${stop.longitude.toFixed(5)}`
                      : 'No coordinates'}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <h3>No bus stops to show</h3>
              <p>Search by postcode or coordinates to populate this dashboard.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
