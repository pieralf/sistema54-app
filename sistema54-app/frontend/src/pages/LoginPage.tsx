import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { LogIn, Lock, Mail, AlertCircle, Shield } from 'lucide-react';
import { IOSCard, IOSInput } from '../components/ui/ios-elements';
import { getApiUrl } from '../config/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const { login, isAuthenticated, checkAuth, requires2FA: storeRequires2FA } = useAuthStore();
  const { settings, loadSettings } = useSettingsStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Carica impostazioni azienda
    loadSettings();
    
    // Verifica se già autenticato
    checkAuth().then(() => {
      if (isAuthenticated) {
        navigate('/');
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password, requires2FA ? twoFactorCode : undefined);
      navigate('/');
    } catch (err: any) {
      if (err.message === '2FA_REQUIRED') {
        setRequires2FA(true);
        setError('');
      } else {
        setError(err.message || 'Errore durante il login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logoUrl = settings?.logo_url || '';
  const nomeAzienda = settings?.nome_azienda || 'SISTEMA54';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {logoUrl ? (
            <div className="flex flex-col items-center mb-4">
              <img 
                src={`${getApiUrl()}${logoUrl}`} 
                alt={nomeAzienda}
                className="h-20 w-20 sm:h-24 sm:w-24 object-contain mb-4"
              />
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{nomeAzienda}</h1>
            </div>
          ) : (
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{nomeAzienda}</h1>
          )}
          <p className="text-gray-600">Gestionale CRM Interventi Tecnici</p>
        </div>

        <IOSCard className="shadow-xl">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-blue-100 p-4 rounded-full">
              <LogIn className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block pl-11 pr-3 py-3 transition-shadow outline-none"
                  placeholder="tuo@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={requires2FA}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block pl-11 pr-3 py-3 transition-shadow outline-none disabled:opacity-50"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {requires2FA && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-blue-700">
                  <Shield className="w-5 h-5" />
                  <span className="font-semibold">Autenticazione a due fattori richiesta</span>
                </div>
                <p className="text-sm text-blue-600">
                  Inserisci il codice a 6 cifre dalla tua app di autenticazione (Authy, Google Authenticator, ecc.)
                  oppure usa un codice di backup.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                    Codice 2FA
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-3.5 w-5 h-5 text-blue-400" />
                    <input
                      type="text"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      required
                      autoFocus
                      className="w-full bg-white border-2 border-blue-300 text-gray-900 text-base rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block pl-11 pr-3 py-3 transition-shadow outline-none font-mono text-center text-lg tracking-widest"
                      placeholder="000000"
                      maxLength={8}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-1">
                    Codice a 6 cifre dall'app o codice di backup a 8 caratteri
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>Caricamento...</>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Accedi
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Credenziali di default: admin@sistema54.it / admin123
            </p>
          </div>
        </IOSCard>

        <div className="mt-6 text-center text-xs text-gray-400">
          <p>Versione 1.0 - Sistema54 Digital</p>
        </div>
      </div>
    </div>
  );
}

