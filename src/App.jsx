// import { useState } from 'react'
// import Landing from './Pages/Landing'
// import Map from './Pages/Map'

// export default function App() {
//   const [page, setPage] = useState('landing')

//   return (
//     <>
//       {page === 'landing' && <Landing onEnter={() => setPage('map')} />}
//       {page === 'map' && <Map />}
//     </>
//   )
// }

import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./Pages/Landing";
import LoginPage from "./Pages/LoginPage";
import Map from "./Pages/Map";

const isAuthenticated = () => !!localStorage.getItem("token");

function ProtectedRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/map"
        element={
          <ProtectedRoute>
            <Map />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
