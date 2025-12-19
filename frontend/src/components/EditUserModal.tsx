import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Save, Shield, Eye, Edit as EditIcon, Plus, Trash2, Settings, Package, Building2, FileText, Users } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { IOSCard, IOSInput, IOSToggle, IOSSelect } from './ui/ios-elements';
import { getApiUrl } from '../config/api';

interface EditUserModalProps {
  user: any | null; // null per creazione nuovo utente
  onClose: () => void;
  onSave: () => void;
}

// Definizione dei permessi disponibili
const PERMESSI_DISPONIBILI = [
  {
    categoria: 'Clienti',
    icon: Building2,
    permessi: [
      { key: 'can_view_clienti', label: 'Visualizza Clienti' },
      { key: 'can_create_clienti', label: 'Crea Clienti' },
      { key: 'can_edit_clienti', label: 'Modifica Clienti' },
      { key: 'can_delete_clienti', label: 'Elimina Clienti' }
    ]
  },
  {
    categoria: 'Interventi',
    icon: FileText,
    permessi: [
      { key: 'can_view_interventi', label: 'Visualizza Interventi' },
      { key: 'can_create_interventi', label: 'Crea Interventi' },
      { key: 'can_edit_interventi', label: 'Modifica Interventi' },
      { key: 'can_delete_interventi', label: 'Elimina Interventi' },
      { key: 'can_generate_pdf', label: 'Genera PDF RIT' }
    ]
  },
  {
    categoria: 'Magazzino',
    icon: Package,
    permessi: [
      { key: 'can_view_magazzino', label: 'Visualizza Magazzino' },
      { key: 'can_create_magazzino', label: 'Crea Prodotti' },
      { key: 'can_edit_magazzino', label: 'Modifica Prodotti' },
      { key: 'can_delete_magazzino', label: 'Elimina Prodotti' }
    ]
  },
  {
    categoria: 'Utenti',
    icon: Users,
    permessi: [
      { key: 'can_view_users', label: 'Visualizza Utenti' },
      { key: 'can_create_users', label: 'Crea Utenti' },
      { key: 'can_edit_users', label: 'Modifica Utenti' },
      { key: 'can_delete_users', label: 'Elimina Utenti' }
    ]
  },
  {
    categoria: 'Impostazioni',
    icon: Settings,
    permessi: [
      { key: 'can_view_settings', label: 'Visualizza Impostazioni' },
      { key: 'can_edit_settings', label: 'Modifica Impostazioni' }
    ]
  }
];

export default function EditUserModal({ user, onClose, onSave }: EditUserModalProps) {
  const { user: currentUser } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [permessi, setPermessi] = useState<Record<string, boolean>>({});
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const isCreating = !user;
  const canManage2FA = currentUser?.ruolo === 'superadmin' && !isCreating;

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      nome_completo: user?.nome_completo || '',
      email: user?.email || '',
      ruolo: user?.ruolo || 'operatore',
      is_active: user?.is_active ?? true,
      password: ''
    }
  });

  // Funzione per ottenere permessi di default in base al ruolo
  const getDefaultPermessi = (ruolo: string): Record<string, boolean> => {
    if (ruolo === 'superadmin') {
      return {
        can_view_clienti: true,
        can_create_clienti: true,
        can_edit_clienti: true,
        can_delete_clienti: true,
        can_view_interventi: true,
        can_create_interventi: true,
        can_edit_interventi: true,
        can_delete_interventi: true,
        can_generate_pdf: true,
        can_view_magazzino: true,
        can_create_magazzino: true,
        can_edit_magazzino: true,
        can_delete_magazzino: true,
        can_view_users: true,
        can_create_users: true,
        can_edit_users: true,
        can_delete_users: true,
        can_view_settings: true,
        can_edit_settings: true
      };
    } else if (ruolo === 'admin') {
      return {
        can_view_clienti: true,
        can_create_clienti: true,
        can_edit_clienti: true,
        can_delete_clienti: true,
        can_view_interventi: true,
        can_create_interventi: true,
        can_edit_interventi: true,
        can_delete_interventi: true,
        can_generate_pdf: true,
        can_view_magazzino: true,
        can_create_magazzino: true,
        can_edit_magazzino: true,
        can_delete_magazzino: true,
        can_view_users: true,
        can_create_users: true,
        can_edit_users: true,
        can_delete_users: true,
        can_view_settings: false,
        can_edit_settings: false
      };
    }
    return {};
  };

  useEffect(() => {
    if (user) {
      setValue('nome_completo', user.nome_completo || '');
      setValue('email', user.email || '');
      setValue('ruolo', user.ruolo || 'operatore');
      setValue('is_active', user.is_active ?? true);
      setTwoFactorEnabled(user.two_factor_enabled || false);
      
      // Carica permessi esistenti o applica default in base al ruolo
      const ruolo = user.ruolo || 'operatore';
      if (user.permessi && Object.keys(user.permessi).length > 0) {
        setPermessi(user.permessi);
      } else {
        // Applica permessi di default se non ci sono permessi personalizzati
        setPermessi(getDefaultPermessi(ruolo));
      }
    } else {
      // Nuovo utente - reset form
      setValue('nome_completo', '');
      setValue('email', '');
      setValue('ruolo', 'operatore');
      setValue('is_active', true);
      setValue('password', '');
      setTwoFactorEnabled(false);
      setPermessi({});
    }
  }, [user, setValue]);

  // Aggiorna permessi quando cambia il ruolo
  const currentRuolo = watch('ruolo');
  useEffect(() => {
    if (currentRuolo && (!user?.permessi || Object.keys(user.permessi || {}).length === 0)) {
      // Solo se non ci sono permessi personalizzati, applica i default
      setPermessi(getDefaultPermessi(currentRuolo));
    }
  }, [currentRuolo]);

  const togglePermesso = (key: string) => {
    setPermessi(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const onSubmit = async (data: any) => {
    setIsSaving(true);
    setError('');

    try {
      if (isCreating) {
        // Creazione nuovo utente
        const payload: any = {
          email: data.email,
          password: data.password,
          nome_completo: data.nome_completo,
          ruolo: data.ruolo,
          permessi: permessi
        };

        await axios.post(`${getApiUrl()}/api/auth/register`, payload);
      } else {
        // Modifica utente esistente
        const payload: any = {
          nome_completo: data.nome_completo,
          ruolo: data.ruolo,
          is_active: data.is_active,
          permessi: permessi
        };

        // Includi password solo se è stata inserita
        if (data.password && data.password.trim() !== '') {
          payload.password = data.password;
        }

        // Includi gestione 2FA se l'utente è superadmin e currentUser può gestirlo
        if (canManage2FA && data.ruolo === 'superadmin') {
          payload.two_factor_enabled = twoFactorEnabled;
        }

        await axios.put(`${getApiUrl()}/api/users/${user.id}`, payload);
      }
      
      onSave();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Errore durante il salvataggio';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const isActive = watch('is_active');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">
              {isCreating ? 'Nuovo Utente' : 'Modifica Utente'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Dati Base */}
            <IOSCard>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Dati Utente</h3>
              
              <IOSInput
                label="Nome Completo *"
                {...register('nome_completo', { required: 'Campo obbligatorio' })}
              />
              {errors.nome_completo && (
                <p className="text-red-500 text-xs mt-1 ml-1">{String(errors.nome_completo.message)}</p>
              )}

              <IOSInput
                label="Email *"
                type="email"
                {...register('email', { required: 'Campo obbligatorio' })}
                disabled={!isCreating}
              />
              {!isCreating && <p className="text-xs text-gray-500 ml-1">L'email non può essere modificata</p>}

              <IOSSelect
                label="Ruolo"
                {...register('ruolo', {
                  onChange: (e) => {
                    const nuovoRuolo = e.target.value;
                    // Se non ci sono permessi personalizzati, applica i default del nuovo ruolo
                    if (!user?.permessi || Object.keys(user.permessi || {}).length === 0) {
                      setPermessi(getDefaultPermessi(nuovoRuolo));
                    }
                  }
                })}
                options={[
                  { value: 'superadmin', label: 'Super Admin (tutti i permessi)' },
                  { value: 'admin', label: 'Admin (tutti tranne impostazioni)' },
                  { value: 'tecnico', label: 'Tecnico' },
                  { value: 'operatore', label: 'Operatore' },
                  { value: 'magazziniere', label: 'Magazziniere' }
                ]}
              />
              <p className="text-xs text-gray-500 ml-1 -mt-3 mb-2">
                {currentRuolo === 'superadmin' && '✓ Tutti i permessi abilitati di default'}
                {currentRuolo === 'admin' && '✓ Tutti i permessi abilitati tranne Impostazioni'}
                {currentRuolo !== 'superadmin' && currentRuolo !== 'admin' && '⚠ Configura i permessi manualmente'}
              </p>

              <div className="mb-4">
                <IOSToggle
                  label="Utente Attivo"
                  checked={isActive}
                  onChange={(checked) => setValue('is_active', checked)}
                />
              </div>

              <IOSInput
                label={isCreating ? "Password *" : "Nuova Password (lascia vuoto per non modificare)"}
                type="password"
                {...register('password', { required: isCreating ? 'Campo obbligatorio' : false })}
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1 ml-1">{String(errors.password.message)}</p>
              )}
            </IOSCard>

            {/* Sezione 2FA per SuperAdmin (solo in modifica) */}
            {!isCreating && currentRuolo === 'superadmin' && (
              <IOSCard>
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-600" />
                  Autenticazione a Due Fattori (2FA)
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-semibold text-gray-900">Stato 2FA</p>
                      <p className="text-sm text-gray-600">
                        {twoFactorEnabled 
                          ? '2FA è attualmente abilitato per questo utente superadmin'
                          : '2FA non è abilitato per questo utente superadmin'}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      twoFactorEnabled 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {twoFactorEnabled ? 'Abilitato' : 'Disabilitato'}
                    </span>
                  </div>
                  
                  {canManage2FA ? (
                    <div className="space-y-3">
                      <div className="mb-4">
                        <IOSToggle
                          label="Abilita 2FA per questo utente superadmin"
                          checked={twoFactorEnabled}
                          onChange={(checked) => setTwoFactorEnabled(checked)}
                        />
                        <p className="text-xs text-gray-500 ml-1 mt-1">
                          {twoFactorEnabled 
                            ? '2FA sarà abilitato. L\'utente dovrà configurare il 2FA al prossimo login tramite la pagina Impostazioni.'
                            : '2FA sarà disabilitato. L\'utente non dovrà più inserire un codice 2FA al login.'}
                        </p>
                      </div>
                      <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                        ⚠️ <strong>Nota:</strong> Abilitare il 2FA qui permetterà all'utente di configurare il 2FA al prossimo login. 
                        Disabilitare il 2FA rimuoverà immediatamente la protezione 2FA per questo account.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">
                      ⚠️ Solo un superadmin può gestire il 2FA per altri utenti superadmin.
                    </p>
                  )}
                </div>
              </IOSCard>
            )}

            {/* Permessi */}
            <IOSCard>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Permessi</h3>
              <p className="text-sm text-gray-600 mb-4">
                Seleziona le funzionalità che questo utente può utilizzare
              </p>

              <div className="space-y-6">
                {PERMESSI_DISPONIBILI.map((categoria) => {
                  const Icon = categoria.icon;
                  return (
                    <div key={categoria.categoria} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className="w-5 h-5 text-blue-600" />
                        <h4 className="font-semibold text-gray-900">{categoria.categoria}</h4>
                      </div>
                      <div className="space-y-2 ml-7">
                        {categoria.permessi.map((permesso) => (
                          <div key={permesso.key} className="flex items-center justify-between py-2">
                            <span className="text-sm text-gray-700">{permesso.label}</span>
                            <button
                              type="button"
                              onClick={() => togglePermesso(permesso.key)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                permessi[permesso.key] ? 'bg-blue-600' : 'bg-gray-200'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition shadow-sm ${
                                  permessi[permesso.key] ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </IOSCard>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-bold transition-all"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  'Salvataggio...'
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Salva Modifiche
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

