import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import NewInterventionPage from './pages/NewInterventionPage';
import EditInterventionPage from './pages/EditInterventionPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import SuperAdminPage from './pages/SuperAdminPage';
import AdminPage from './pages/AdminPage';
import DashboardAdminPage from './pages/DashboardAdminPage';
import DashboardOperatorePage from './pages/DashboardOperatorePage';
import ClientiPage from './pages/ClientiPage';
import NuovoClientePage from './pages/NuovoClientePage';
import NuovoProdottoPage from './pages/NuovoProdottoPage';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';

// Componente che decide quale dashboard mostrare in base al ruolo
function DashboardRouter() {
  const { user } = useAuthStore();
  const isAdmin = user?.ruolo === 'admin' || user?.ruolo === 'superadmin';

  if (isAdmin) {
    return <DashboardAdminPage />;
  }

  return <DashboardOperatorePage />;
}

function App() {
  const { loadSettings } = useSettingsStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Carica sempre le impostazioni all'avvio
    loadSettings();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardRouter />
            </ProtectedRoute>
          }
        />
        <Route
          path="/new-rit"
          element={
            <ProtectedRoute>
              <NewInterventionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/edit-rit/:id"
          element={
            <ProtectedRoute>
              <EditInterventionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clienti"
          element={
            <ProtectedRoute>
              <ClientiPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nuovo-cliente"
          element={
            <ProtectedRoute>
              <NuovoClientePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nuovo-cliente/:id"
          element={
            <ProtectedRoute>
              <NuovoClientePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nuovo-prodotto"
          element={
            <ProtectedRoute requiredPermission="can_create_magazzino">
              <NuovoProdottoPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nuovo-prodotto/:id"
          element={
            <ProtectedRoute requiredPermission="can_edit_magazzino">
              <NuovoProdottoPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute requiredRole={['admin', 'superadmin']}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/superadmin"
          element={
            <ProtectedRoute requiredRole={['superadmin']}>
              <SuperAdminPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App