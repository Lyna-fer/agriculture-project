import { useState } from 'react'
import Landing from './Pages/Landing'
import Map from './Pages/Map'

export default function App() {
  const [page, setPage] = useState('landing')

  return (
    <>
      {page === 'landing' && <Landing onEnter={() => setPage('map')} />}
      {page === 'map' && <Map />}
    </>
  )
}