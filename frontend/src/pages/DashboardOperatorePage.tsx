import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Users, LogOut, User, Package } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useNavigate } from 'react-router-dom';
import { getApiUrl } from '../config/api';

export default function DashboardOperatorePage() {
  const { user, logout } = useAuthStore();
  const { settings, loadSettings } = useSettingsStore();
  const navigate = useNavigate();
  const logoUrl = settings?.logo_url || '';
  const nomeAzienda = settings?.nome_azienda || 'SISTEMA54';

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 pb-20">
      {/* Header iOS Style */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-4 py-4 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img 
                src={`${getApiUrl()}${logoUrl}`} 
                alt={nomeAzienda}
                className="h-10 w-10 object-contain rounded-full bg-white p-1"
              />
            ) : (
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">S</span>
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-gray-900">{nomeAzienda}</h1>
              <p className="text-xs text-gray-500">{user?.nome_completo}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-6 space-y-6">
        {/* Card Nuovo Intervento - Stile iOS */}
        <Link
          to="/new-rit"
          className="block bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform"
        >
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <PlusCircle className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-1">Nuovo Intervento</h2>
                <p className="text-blue-100 text-sm">Crea un nuovo rapporto tecnico</p>
              </div>
            </div>
          </div>
        </Link>

        {/* Card Clienti - Stile iOS */}
        <Link
          to="/clienti"
          className="block bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform"
        >
          <div className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                <Users className="w-7 h-7 text-green-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Clienti</h2>
                <p className="text-gray-500 text-sm">Gestisci anagrafiche clienti</p>
              </div>
              <div className="text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </div>
        </Link>

        {/* Card Magazzino - Mostrata solo se l'utente ha i permessi */}
        {(user?.permessi?.can_view_magazzino || user?.ruolo === 'admin' || user?.ruolo === 'superadmin') && (
          <Link
            to="/admin?tab=magazzino"
            className="block bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform"
          >
            <div className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <Package className="w-7 h-7 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Magazzino</h2>
                  <p className="text-gray-500 text-sm">Gestisci prodotti e giacenze</p>
                </div>
                <div className="text-gray-300">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Spacer per iOS bottom safe area */}
        <div className="h-8" />
      </main>
    </div>
  );
}

