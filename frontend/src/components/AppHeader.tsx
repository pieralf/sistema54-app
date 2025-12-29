import { Home, ChevronLeft, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { getApiUrl } from '../config/api';

interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  showHome?: boolean;
  rightContent?: React.ReactNode;
}

export default function AppHeader({ title, showBack = true, showHome = true, rightContent }: AppHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettingsStore();
  const { logout, isAuthenticated } = useAuthStore();
  const logoUrl = settings?.logo_url || '';
  const nomeAzienda = settings?.nome_azienda || 'SISTEMA54';

  const handleLogout = () => {
    if (window.confirm('Sei sicuro di voler uscire?')) {
      logout();
      navigate('/login');
    }
  };

  const handleBack = () => {
    // Usa navigate(-1) di React Router che gestisce correttamente la history del browser
    // Questo funziona anche quando si naviga tra tab nella stessa pagina
    navigate(-1);
  };

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showHome && (
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-all"
              title="Home"
            >
              <Home className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
          {showBack && (
            <button
              onClick={handleBack}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-all"
              title="Torna indietro"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
          <div className="flex items-center gap-2 sm:gap-3">
            {logoUrl && (
              <img 
                src={`${getApiUrl()}${logoUrl}`} 
                alt={nomeAzienda}
                className="h-8 w-8 sm:h-10 sm:w-10 object-contain"
              />
            )}
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-800">{title}</h1>
              {logoUrl && (
                <p className="text-xs text-slate-500 hidden sm:block">{nomeAzienda}</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rightContent}
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}



