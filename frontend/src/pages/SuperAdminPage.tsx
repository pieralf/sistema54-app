import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ChevronLeft, Save, Shield, Users, Settings, FileText, Palette, Database, Home } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { IOSCard, IOSInput, IOSTextArea } from '../components/ui/ios-elements';
import { getApiUrl } from '../config/api';

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'config' | 'templates' | 'system'>('users');
  const { register, handleSubmit, setValue, watch } = useForm<any>();

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    } else if (activeTab === 'config') {
      loadConfig();
    }
  }, [activeTab]);

  const loadUsers = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/api/users/`);
      setUsers(res.data);
    } catch (err) {
      console.error('Errore caricamento utenti:', err);
    }
  };

  const loadConfig = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/impostazioni/`);
      const data = res.data || {};
      setValue('configurazioni_avanzate', JSON.stringify(data.configurazioni_avanzate || {}, null, 2));
      setValue('template_pdf_config', JSON.stringify(data.template_pdf_config || {}, null, 2));
      setValue('oauth_config', JSON.stringify(data.oauth_config || {}, null, 2));
    } catch (err) {
      console.error('Errore caricamento configurazione:', err);
    }
  };

  const handleCreateUser = async (data: any) => {
    try {
      await axios.post(`${getApiUrl()}/api/auth/register`, {
        email: data.email,
        password: data.password,
        nome_completo: data.nome_completo,
        ruolo: data.ruolo
      });
      alert('Utente creato con successo!');
      loadUsers();
    } catch (err: any) {
      alert('Errore: ' + (err.response?.data?.detail || 'Errore sconosciuto'));
    }
  };

  const handleUpdateUser = async (userId: number, updates: any) => {
    try {
      await axios.put(`${getApiUrl()}/api/users/${userId}`, updates);
      alert('Utente aggiornato!');
      loadUsers();
    } catch (err: any) {
      alert('Errore: ' + (err.response?.data?.detail || 'Errore sconosciuto'));
    }
  };

  const TabButton = ({ id, label, icon: Icon }: { id: string; label: string; icon: any }) => (
    <button
      onClick={() => setActiveTab(id as any)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
        activeTab === id
          ? 'bg-purple-600 text-white shadow-md'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-semibold">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-all"
              title="Home"
            >
              <Home className="w-6 h-6" />
            </button>
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-all"
              title="Torna indietro"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-purple-600" />
              <h1 className="text-xl font-bold text-slate-800">Pannello SuperAdmin</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <TabButton id="users" label="Utenti" icon={Users} />
          <TabButton id="config" label="Configurazioni" icon={Settings} />
          <TabButton id="templates" label="Template PDF" icon={FileText} />
          <TabButton id="system" label="Sistema" icon={Database} />
        </div>

        {/* Tab Content */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <IOSCard>
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2 text-purple-500" /> Nuovo Utente
              </h2>
              <form onSubmit={handleSubmit(handleCreateUser)} className="space-y-4">
                <IOSInput label="Email" {...register('email', { required: true })} type="email" />
                <IOSInput label="Nome Completo" {...register('nome_completo', { required: true })} />
                <IOSInput label="Password" {...register('password', { required: true })} type="password" />
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                    Ruolo
                  </label>
                  <select
                    {...register('ruolo', { required: true })}
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-base rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 block p-3"
                  >
                    <option value="operatore">Operatore</option>
                    <option value="tecnico">Tecnico</option>
                    <option value="magazziniere">Magazziniere</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">SuperAdmin</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold shadow-md"
                >
                  Crea Utente
                </button>
              </form>
            </IOSCard>

            <IOSCard>
              <h2 className="text-lg font-bold text-slate-800 mb-4">Lista Utenti</h2>
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200"
                  >
                    <div>
                      <div className="font-bold text-gray-900">{u.nome_completo}</div>
                      <div className="text-sm text-gray-600">{u.email}</div>
                      <div className="text-xs text-gray-500 mt-1">Ruolo: {u.ruolo}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          u.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {u.is_active ? 'Attivo' : 'Disattivato'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </IOSCard>
          </div>
        )}

        {activeTab === 'config' && (
          <IOSCard>
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-purple-500" /> Configurazioni Avanzate
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Configurazioni JSON personalizzabili per parametrizzare l'applicazione
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                  Configurazioni Avanzate (JSON)
                </label>
                <textarea
                  {...register('configurazioni_avanzate')}
                  rows={10}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-sm"
                  placeholder='{"parametro": "valore"}'
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                  Configurazione Template PDF (JSON)
                </label>
                <textarea
                  {...register('template_pdf_config')}
                  rows={10}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-sm"
                  placeholder='{"template_stampanti": {...}, "template_it": {...}}'
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                  Configurazione OAuth (JSON)
                </label>
                <textarea
                  {...register('oauth_config')}
                  rows={8}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-mono text-sm"
                  placeholder='{"google": {"client_id": "..."}, "microsoft": {...}}'
                />
              </div>
              <button
                onClick={handleSubmit(async (data) => {
                  try {
                    // TODO: Implementare endpoint per salvare configurazioni avanzate
                    alert('Configurazioni salvate!');
                  } catch (err) {
                    alert('Errore nel salvataggio');
                  }
                })}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold shadow-md"
              >
                <Save className="w-4 h-4 inline mr-2" />
                Salva Configurazioni
              </button>
            </div>
          </IOSCard>
        )}

        {activeTab === 'templates' && (
          <IOSCard>
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-purple-500" /> Template PDF Modulari
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Configura template PDF personalizzati per ogni tipo di intervento
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">Template Stampanti</h3>
                <p className="text-sm text-blue-700">
                  Template specifico per interventi su stampanti e dispositivi di stampa
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <h3 className="font-bold text-green-900 mb-2">Template IT</h3>
                <p className="text-sm text-green-700">
                  Template per interventi informatici, reti PC, hardware e software
                </p>
              </div>
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                <h3 className="font-bold text-orange-900 mb-2">Template Registratori di Cassa</h3>
                <p className="text-sm text-orange-700">
                  Template per interventi su registratori di cassa e sistemi fiscali
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-2">Template Manutenzione Generale</h3>
                <p className="text-sm text-purple-700">
                  Template per interventi di manutenzione e manodopera generica
                </p>
              </div>
            </div>
          </IOSCard>
        )}

        {activeTab === 'system' && (
          <IOSCard>
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <Database className="w-5 h-5 mr-2 text-purple-500" /> Informazioni Sistema
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="text-sm text-gray-600">
                  <strong>Versione:</strong> 1.0.0
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  <strong>Database:</strong> PostgreSQL
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  <strong>Backend:</strong> FastAPI
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  <strong>Frontend:</strong> React + TypeScript
                </div>
              </div>
            </div>
          </IOSCard>
        )}
      </main>
    </div>
  );
}

