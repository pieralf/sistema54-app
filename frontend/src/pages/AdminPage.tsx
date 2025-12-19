import { useState, useEffect } from 'react';
import { ChevronLeft, Users, Building2, FileText, Search, Plus, Edit, Trash2, Shield, Package, Home } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { IOSCard, IOSInput } from '../components/ui/ios-elements';
import { getApiUrl } from '../config/api';
import EditUserModal from '../components/EditUserModal';

export default function AdminPage() {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as any) || 'users';
  const [activeTab, setActiveTab] = useState<'users' | 'clienti' | 'interventi' | 'magazzino'>(initialTab);
  const [users, setUsers] = useState<any[]>([]);
  const [clienti, setClienti] = useState<any[]>([]);
  const [interventi, setInterventi] = useState<any[]>([]);
  const [magazzino, setMagazzino] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    setSearchParams({ tab: activeTab });
  }, [activeTab]);

  // Carica tutti i contatori all'avvio (per mostrare i numeri nelle tab)
  const loadAllCounts = async () => {
    if (!token) return;
    
    try {
      // Carica tutti i dati in parallelo per i contatori
      const [usersRes, clientiRes, interventiRes, magazzinoRes] = await Promise.allSettled([
        axios.get(`${getApiUrl()}/api/users/`),
        axios.get(`${getApiUrl()}/clienti/?q=`),
        axios.get(`${getApiUrl()}/interventi/`),
        axios.get(`${getApiUrl()}/magazzino/?q=`)
      ]);

      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value.data || []);
      }
      if (clientiRes.status === 'fulfilled') {
        setClienti(clientiRes.value.data || []);
      }
      if (interventiRes.status === 'fulfilled') {
        setInterventi(interventiRes.value.data || []);
      }
      if (magazzinoRes.status === 'fulfilled') {
        setMagazzino(magazzinoRes.value.data || []);
      }
    } catch (err: any) {
      console.error('Errore caricamento contatori:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const res = await axios.get(`${getApiUrl()}/api/users/`);
        setUsers(res.data);
      } else if (activeTab === 'clienti') {
        const apiUrl = getApiUrl();
        console.log('Caricamento clienti...', { apiUrl, searchTerm, authHeader: axios.defaults.headers.common['Authorization'] });
        const res = await axios.get(`${apiUrl}/clienti/?q=${searchTerm}`);
        console.log('Risposta clienti:', res.data, 'Numero clienti:', res.data?.length);
        setClienti(res.data || []);
      } else if (activeTab === 'interventi') {
        const res = await axios.get(`${getApiUrl()}/interventi/?q=${searchTerm}`);
        setInterventi(res.data);
      } else if (activeTab === 'magazzino') {
        const res = await axios.get(`${getApiUrl()}/magazzino/?q=${searchTerm}`);
        setMagazzino(res.data);
      }
    } catch (err: any) {
      console.error('Errore caricamento dati:', err);
      if (err.response) {
        console.error('Status:', err.response.status);
        console.error('Data:', err.response.data);
        if (err.response.status === 401) {
          console.error('Errore di autenticazione - token non valido');
        }
      } else if (err.request) {
        console.error('Request:', err.request);
      }
      // Imposta array vuoto in caso di errore per evitare errori di rendering
      if (activeTab === 'clienti') {
        setClienti([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Carica tutti i contatori all'avvio
  useEffect(() => {
    if (token) {
      loadAllCounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Carica i dati quando cambia il tab (solo se c'è un token)
  useEffect(() => {
    if (token) {
      loadData();
    } else {
      console.warn('Token non presente, impossibile caricare i dati');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, token, searchTerm]);

  // Carica i dati quando cambia il termine di ricerca (solo per clienti e magazzino)
  useEffect(() => {
    if (activeTab === 'clienti' || activeTab === 'magazzino') {
      if (searchTerm.length > 2) {
        const delay = setTimeout(() => loadData(), 300);
        return () => clearTimeout(delay);
      } else if (searchTerm.length === 0) {
        // Carica immediatamente quando il campo di ricerca è vuoto
        loadData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const TabButton = ({ id, label, icon: Icon, count }: { id: string; label: string; icon: any; count?: number }) => (
    <button
      onClick={() => setActiveTab(id as any)}
      className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all font-semibold ${
        activeTab === id
          ? 'bg-blue-600 text-white shadow-md'
          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
      {count !== undefined && (
        <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === id ? 'bg-white/20' : 'bg-gray-100'}`}>
          {count}
        </span>
      )}
    </button>
  );

  const handleCreateProdotto = async (data: any) => {
    try {
      await axios.post(`${getApiUrl()}/magazzino/`, data);
      alert('Prodotto creato con successo!');
      loadData();
      // Aggiorna anche i contatori
      loadAllCounts();
    } catch (err: any) {
      alert('Errore: ' + (err.response?.data?.detail || 'Errore sconosciuto'));
    }
  };

  const handleOpenPDF = async (interventoId: number) => {
    try {
      // Prima recupera i dati dell'intervento per ottenere il numero_relazione
      let numeroRit = `RIT-${interventoId}`;
      try {
        const interventoResponse = await axios.get(`${getApiUrl()}/interventi/${interventoId}`);
        if (interventoResponse.data?.numero_relazione) {
          numeroRit = interventoResponse.data.numero_relazione;
        }
      } catch (e) {
        console.warn('Impossibile recuperare numero relazione, uso ID:', e);
      }

      const response = await axios.get(`${getApiUrl()}/interventi/${interventoId}/pdf`, {
        responseType: 'blob',
      });
      
      // Verifica che il contenuto sia valido
      if (!response.data || response.data.size === 0) {
        alert('⚠️ Errore: Il PDF è vuoto o non valido.');
        return;
      }
      
      // Estrai il nome file dall'header Content-Disposition se presente
      const contentDisposition = response.headers['content-disposition'];
      let filename = `${numeroRit}.pdf`;
      if (contentDisposition) {
        // Prova a estrarre il filename da Content-Disposition (supporta sia filename che filename*)
        const filenameMatch = contentDisposition.match(/filename\*?=['"]?([^'";\n]+)['"]?/i);
        if (filenameMatch && filenameMatch[1]) {
          // Rimuovi eventuali prefissi UTF-8 e pulisci il nome
          let extractedFilename = filenameMatch[1].replace(/^UTF-8''/i, '').replace(/['"]/g, '');
          // Rimuovi estensione .pdf se presente (la aggiungiamo dopo)
          extractedFilename = extractedFilename.replace(/\.pdf$/i, '');
          if (extractedFilename) {
            filename = `${extractedFilename}.pdf`;
          }
        }
      }
      
      // Crea un File object invece di Blob per preservare meglio il nome
      const file = new File([response.data], filename, { type: 'application/pdf' });
      const url = window.URL.createObjectURL(file);
      
      // Crea un link temporaneo per il download con il nome corretto
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.setAttribute('download', filename);
      
      // Aggiungi al DOM, clicca e rimuovi (questo forza il download con il nome corretto)
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Apri anche in una nuova finestra per visualizzazione
      // Nota: window.open potrebbe non rispettare il nome del file, ma il download è già avvenuto con il nome corretto
      setTimeout(() => {
        const pdfWindow = window.open(url, '_blank');
        if (!pdfWindow) {
          // Se il popup è bloccato, almeno il download è già avvenuto con il nome corretto
          console.log('Popup bloccato, ma il download è già avvenuto con il nome:', filename);
        }
        
        // Pulisci l'URL dopo un delay più lungo per permettere il caricamento
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, 5000);
      }, 100);
    } catch (err: any) {
      alert('Errore nel caricamento del PDF: ' + (err.response?.data?.detail || 'Errore sconosciuto'));
    }
  };

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
              <Shield className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-slate-800">Pannello Admin</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Tabs */}
        <div className="flex flex-wrap gap-3 mb-6">
          <TabButton id="users" label="Utenti" icon={Users} count={users.length} />
          <TabButton id="clienti" label="Clienti" icon={Building2} count={clienti.length} />
          <TabButton id="magazzino" label="Magazzino" icon={Package} count={magazzino.length} />
          <TabButton id="interventi" label="Interventi" icon={FileText} count={interventi.length} />
        </div>

        {/* Search Bar per Clienti, Magazzino e Interventi */}
        {(activeTab === 'clienti' || activeTab === 'magazzino' || activeTab === 'interventi') && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={
                  activeTab === 'clienti'
                    ? 'Cerca cliente per ragione sociale, P.IVA o CF...'
                    : activeTab === 'magazzino'
                    ? 'Cerca prodotto per codice o descrizione...'
                    : 'Cerca RIT per cliente, numero RIT, seriale, part number o prodotto...'
                }
                className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Caricamento...</div>
        ) : (
          <>
            {activeTab === 'users' && (
              <IOSCard>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Gestione Utenti</h2>
                  <button 
                    onClick={() => setCreatingUser(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    Nuovo Utente
                  </button>
                </div>
                <div className="space-y-3">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{u.nome_completo}</div>
                          <div className="text-sm text-gray-600">{u.email}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Ruolo: <span className="font-semibold">{u.ruolo}</span>
                          </div>
                        </div>
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
                        <button 
                          onClick={() => setEditingUser(u)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </IOSCard>
            )}

            {activeTab === 'clienti' && (
              <IOSCard>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Anagrafica Clienti</h2>
                  <Link
                    to="/nuovo-cliente"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    Nuovo Cliente
                  </Link>
                </div>
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-center py-12 text-gray-500">Caricamento...</div>
                  ) : clienti.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      {searchTerm ? 'Nessun cliente trovato' : 'Nessun cliente presente'}
                    </div>
                  ) : (
                    clienti.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                      >
                        <div>
                          <div className="font-bold text-gray-900">{c.ragione_sociale}</div>
                          <div className="text-sm text-gray-600 mt-1">{c.indirizzo}</div>
                          {c.p_iva && (
                            <div className="text-xs text-gray-500 mt-1">P.IVA: {c.p_iva}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/nuovo-cliente/${c.id}`}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </IOSCard>
            )}

            {activeTab === 'magazzino' && (
              <IOSCard>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Gestione Magazzino</h2>
                  <Link
                    to="/nuovo-prodotto"
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                  >
                    <Plus className="w-4 h-4" />
                    Nuovo Prodotto
                  </Link>
                </div>
                <div className="space-y-3">
                  {magazzino.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <div className="font-bold text-gray-900">{p.descrizione}</div>
                        <div className="text-sm text-gray-600 mt-1">Codice: {p.codice_articolo}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Prezzo: €{p.prezzo_vendita?.toFixed(2)} | Giacenza: {p.giacenza}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            p.giacenza > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {p.giacenza > 0 ? 'Disponibile' : 'Esaurito'}
                        </span>
                        <Link
                          to={`/nuovo-prodotto/${p.id}`}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </IOSCard>
            )}

            {activeTab === 'interventi' && (
              <IOSCard>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Lista Interventi</h2>
                </div>
                <div className="space-y-3">
                  {interventi.map((i) => (
                    <div
                      key={i.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <div className="font-bold text-gray-900">{i.numero_relazione}</div>
                        <div className="text-sm text-gray-600 mt-1">{i.cliente_ragione_sociale}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(i.data_creazione).toLocaleDateString('it-IT')} - {i.macro_categoria}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/edit-rit/${i.id}`)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                        >
                          Modifica
                        </button>
                        <button
                          onClick={() => handleOpenPDF(i.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                        >
                          PDF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </IOSCard>
            )}
          </>
        )}
      </main>

      {/* Modale Modifica Utente */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={() => {
            loadAllCounts();
            loadData();
          }}
        />
      )}

      {/* Modale Crea Utente */}
      {creatingUser && (
        <EditUserModal
          user={null}
          onClose={() => setCreatingUser(false)}
          onSave={() => {
            setCreatingUser(false);
            loadAllCounts();
            loadData();
          }}
        />
      )}
    </div>
  );
}

