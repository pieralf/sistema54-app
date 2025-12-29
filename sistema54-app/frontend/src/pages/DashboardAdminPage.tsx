import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Users, Package, Archive, Settings, User, Activity, LogOut, Shield } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../config/api';

export default function DashboardAdminPage() {
  const { user, logout } = useAuthStore();
  const { settings, loadSettings } = useSettingsStore();
  const navigate = useNavigate();
  const [interventiOggi, setInterventiOggi] = useState(0);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline'>('offline');

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    // Conta interventi di oggi
    const loadInterventiOggi = async () => {
      try {
        const res = await axios.get(`${getApiUrl()}/interventi/`);
        const oggi = new Date().toISOString().split('T')[0];
        const count = res.data.filter((i: any) => {
          const dataIntervento = new Date(i.data_creazione).toISOString().split('T')[0];
          return dataIntervento === oggi;
        }).length;
        setInterventiOggi(count);
      } catch (err) {
        console.error('Errore caricamento interventi:', err);
      }
    };

    // Verifica stato API - Controlla se il backend risponde correttamente
    const checkApiStatus = async () => {
      try {
        // Prova a chiamare l'endpoint /api/auth/me che richiede autenticazione
        // Se risponde, significa che:
        // 1. Il backend è raggiungibile
        // 2. Il token JWT è valido
        // 3. Il database è connesso
        await axios.get(`${getApiUrl()}/api/auth/me`);
        setApiStatus('online');
      } catch (err: any) {
        // Se fallisce, potrebbe essere:
        // - Backend non raggiungibile (offline)
        // - Token scaduto (ma backend online)
        // - Database non connesso
        // Per semplicità, consideriamo offline solo se è un errore di rete
        if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
          setApiStatus('offline');
        } else {
          // Se è un errore 401/403, il backend è online ma il token non è valido
          // Consideriamo comunque online perché il backend risponde
          setApiStatus('online');
        }
      }
    };

    loadInterventiOggi();
    checkApiStatus();
    const interval = setInterval(checkApiStatus, 30000); // Check ogni 30 secondi

    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const logoUrl = settings?.logo_url || '';
  const nomeAzienda = settings?.nome_azienda || 'SISTEMA54';

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl && (
              <img 
                src={`${getApiUrl()}${logoUrl}`} 
                alt={nomeAzienda}
                className="h-12 w-12 object-contain"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{nomeAzienda}</h1>
              <p className="text-slate-500 mt-1">Benvenuto nella tua area operativa.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/settings"
              className="p-3 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all text-slate-600"
            >
              <Settings className="w-5 h-5" />
            </Link>
            <button
              onClick={handleLogout}
              className="p-3 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all text-slate-600"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* Grid Azioni Rapide */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* Card Nuovo Intervento */}
          <Link
            to="/new-rit"
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-purple-700 p-6 shadow-lg transition-transform hover:scale-[1.02] hover:shadow-xl"
          >
            <div className="relative z-10 text-white">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <PlusCircle className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">Nuovo Intervento</h3>
              <p className="mt-1 text-sm text-purple-100">Crea un rapporto tecnico</p>
            </div>
            <div className="absolute -right-4 -bottom-4 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-all group-hover:scale-150" />
          </Link>

          {/* Card Clienti */}
          <Link
            to="/admin?tab=clienti"
            className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg border border-slate-100 transition-transform hover:scale-[1.02] hover:shadow-xl"
          >
            <div className="relative z-10">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Clienti</h3>
              <p className="mt-1 text-sm text-slate-500">Gestisci anagrafiche</p>
            </div>
          </Link>

          {/* Card Magazzino */}
          <Link
            to="/admin?tab=magazzino"
            className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg border border-slate-100 transition-transform hover:scale-[1.02] hover:shadow-xl"
          >
            <div className="relative z-10">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Magazzino</h3>
              <p className="mt-1 text-sm text-slate-500">Prodotti e Listini</p>
            </div>
          </Link>

          {/* Card Archivio */}
          <Link
            to="/admin?tab=interventi"
            className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg border border-slate-100 transition-transform hover:scale-[1.02] hover:shadow-xl"
          >
            <div className="relative z-10">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Archive className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Archivio</h3>
              <p className="mt-1 text-sm text-slate-500">Consulta interventi passati</p>
            </div>
          </Link>
        </div>

        {/* Seconda riga - Utenti */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {/* Card Utenti */}
          <Link
            to="/admin?tab=users"
            className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-lg border border-slate-100 transition-transform hover:scale-[1.02] hover:shadow-xl"
          >
            <div className="relative z-10">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Utenti</h3>
              <p className="mt-1 text-sm text-slate-500">Gestisci utenti e permessi</p>
            </div>
          </Link>
        </div>

        {/* Stato Sistema */}
        <div className="rounded-2xl bg-white p-6 shadow-lg border border-slate-100">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-bold text-slate-800">Stato Sistema</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-500 mb-2">Interventi Oggi</p>
              <p className="text-3xl font-bold text-slate-900">{interventiOggi}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-2">Stato API</p>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      apiStatus === 'online' ? 'bg-green-500' : 'bg-red-500'
                    } ${
                      apiStatus === 'online' ? 'animate-pulse' : ''
                    }`}
                  />
                  {apiStatus === 'online' && (
                    <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-75" />
                  )}
                </div>
                <span
                  className={`font-semibold ${
                    apiStatus === 'online' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {apiStatus === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Verifica connessione backend ogni 30s
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

