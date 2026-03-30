import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RepertoirePage from './pages/RepertoirePage'
import SongDetailPage from './pages/SongDetailPage'
import AddSongPage from './pages/AddSongPage'
import EvenementsPage from './pages/EvenementsPage'
import EvenementDetailPage from './pages/EvenementDetailPage'
import VueJourJPage from './pages/VueJourJPage'
import HistoriquePage from './pages/HistoriquePage'
import MembresPage from './pages/MembresPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Chargement…</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Chargement…</div>
  if (!user) return <LoginPage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/repertoire" replace />} />
        <Route path="/repertoire" element={<RepertoirePage />} />
        <Route path="/repertoire/ajouter" element={<AddSongPage />} />
        <Route path="/repertoire/:id" element={<SongDetailPage />} />
        <Route path="/evenements" element={<EvenementsPage />} />
        <Route path="/evenements/:id" element={<EvenementDetailPage />} />
        <Route path="/evenements/:id/jour-j" element={<VueJourJPage />} />
        <Route path="/historique" element={<HistoriquePage />} />
        <Route path="/membres" element={<MembresPage />} />
        <Route path="*" element={<Navigate to="/repertoire" replace />} />
      </Route>
    </Routes>
  )
}
