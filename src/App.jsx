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

function displayDepartureTime(departure) {
  return (
    departure.best_departure_estimate ||
    departure.expected_departure_time ||
    departure.aimed_departure_time ||
    'TBC'
  )
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
  const [selectedStop, setSelectedStop] = useState(null)
  const [departures, setDepartures] = useState([])
  const [departuresStatus, setDeparturesStatus] = useState('idle')
  const [departuresError, setDeparturesError] = useState('')

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
  const selectedStopName = selectedStop?.name || 'No stop selected'

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

  async function fetchDepartures(stop) {
    if (!stop.atcocode) {
      throw new Error('This stop does not include an ATCO code.')
    }

    const response = await fetch(
      `${API_BASE_URL}/api/bus-stops/${encodeURIComponent(
        stop.atcocode,
      )}/departures?limit=5`,
    )
    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const message = data?.detail || 'Live departures failed.'
      throw new Error(message)
    }

    return Array.isArray(data.departures) ? data.departures : []
  }

  async function handleSearch(event) {
    event.preventDefault()
    setStatus('loading')
    setError('')
    setSelectedStop(null)
    setDepartures([])
    setDeparturesError('')
    setDeparturesStatus('idle')

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

  async function selectStop(stop) {
    setSelectedStop(stop)
    setDepartures([])
    setDeparturesError('')
    setDeparturesStatus('loading')

    try {
      const results = await fetchDepartures(stop)
      setDepartures(results)
      setDeparturesStatus('success')
    } catch (departureError) {
      setDeparturesError(departureError.message)
      setDeparturesStatus('error')
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
          <h1>Live bus stop display</h1>
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
        <article>
          <span>Selected stop</span>
          <strong>{selectedStopName}</strong>
        </article>
      </section>

      <section className="display-grid">
        <div className="stop-browser">
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
                <button
                  className={`stop-row ${
                    selectedStop?.atcocode === stop.atcocode ? 'selected' : ''
                  }`}
                  key={stopKey(stop, index)}
                  type="button"
                  onClick={() => selectStop(stop)}
                >
                  <div className="stop-main">
                    <h3>{stop.name || 'Unnamed stop'}</h3>
                    <p>{stop.description || 'No locality provided'}</p>
                  </div>
                  <div className="stop-meta">
                    <span>{formatDistance(Number(stop.distance))}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="empty-state">
                <h3>No bus stops to show</h3>
                <p>Search by postcode or coordinates to populate this dashboard.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="departures-panel">
          <div className="departures-header">
            <div>
              <p className="eyebrow">Live display</p>
              <h2>Next five buses</h2>
            </div>
            <span className={`status-dot ${departuresStatus}`}></span>
          </div>

          {selectedStop ? (
            <div className="selected-stop">
              <h3>{selectedStop.name}</h3>
              <p>{selectedStop.description || selectedStop.atcocode}</p>
            </div>
          ) : null}

          {departuresError ? (
            <p className="error-message departures-error">{departuresError}</p>
          ) : null}

          <div className="departure-list">
            {departures.length ? (
              departures.map((departure, index) => (
                <article
                  className="departure-row"
                  key={`${departure.line}-${departure.departure_date}-${index}`}
                >
                  <div className="route-badge">{departure.line || '-'}</div>
                  <div>
                    <h3>{departure.direction || 'Direction unavailable'}</h3>
                    <p>{departure.operator_name || departure.source || 'Bus service'}</p>
                  </div>
                  <time>{displayDepartureTime(departure)}</time>
                </article>
              ))
            ) : selectedStop && departuresStatus === 'loading' ? (
              <div className="empty-state compact">
                <h3>Loading departures</h3>
                <p>Fetching live times for the selected stop.</p>
              </div>
            ) : (
              <div className="empty-state compact">
                <h3>Select a bus stop</h3>
                <p>Choose a stop from the filtered list to show live departures.</p>
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  )
}

export default App
