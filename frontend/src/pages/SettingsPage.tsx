import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ChevronLeft, Save, Building2, Palette, Receipt, Upload, X, Image as ImageIcon, Home } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { IOSCard, IOSInput, IOSTextArea } from '../components/ui/ios-elements';
import { getApiUrl } from '../config/api';
import TwoFactorSettings from '../components/TwoFactorSettings';
import { useSettingsStore } from '../store/settingsStore';

const CATEGORIE = ["Informatica & IT", "Printing & Office", "Manutenzione Gen.", "Sistemi Fiscali"];

export default function SettingsPage() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const { register, handleSubmit, setValue, watch } = useForm<any>();
  const { updateSettings } = useSettingsStore();

  useEffect(() => {
    // Gestione errore connessione
    axios.get(`${getApiUrl()}/impostazioni/`)
      .then(res => {
        const data = res.data || {};
        setValue('nome_azienda', data.nome_azienda || "");
        setValue('indirizzo_completo', data.indirizzo_completo || "");
        setValue('p_iva', data.p_iva || "");
        setValue('telefono', data.telefono || "");
        setValue('email', data.email || "");
        setValue('email_notifiche_scadenze', data.email_notifiche_scadenze || "");
        setValue('email_avvisi_promemoria', data.email_avvisi_promemoria || "");
        setValue('smtp_server', data.smtp_server || "");
        setValue('smtp_port', data.smtp_port || 587);
        setValue('smtp_username', data.smtp_username || "");
        setValue('smtp_password', data.smtp_password || "");
        setValue('smtp_use_tls', data.smtp_use_tls !== false);
        setValue('colore_primario', data.colore_primario || "#4F46E5");
        setValue('logo_url', data.logo_url || "");
        setLogoUrl(data.logo_url || "");
        setValue('testo_privacy', data.testo_privacy || "");

        const tariffe = data.tariffe_categorie || {};
        CATEGORIE.forEach(cat => {
            setValue(`tariffe_${cat}_orario`, tariffe[cat]?.orario || 50);
            setValue(`tariffe_${cat}_chiamata`, tariffe[cat]?.chiamata || 30);
        });
      })
      .catch(err => console.warn("Backend non raggiungibile o dati vuoti", err));
  }, [setValue]);

  const onSubmit = async (data: any) => {
    setIsSaving(true);
    
    const tariffe_categorie: any = {};
    CATEGORIE.forEach(cat => {
        tariffe_categorie[cat] = {
            orario: parseFloat(data[`tariffe_${cat}_orario`] || 0),
            chiamata: parseFloat(data[`tariffe_${cat}_chiamata`] || 0)
        };
    });

    const payload = {
        nome_azienda: data.nome_azienda || "Azienda Demo",
        indirizzo_completo: data.indirizzo_completo || "",
        p_iva: data.p_iva || "",
        telefono: data.telefono || "",
        email: data.email || "",
        email_notifiche_scadenze: data.email_notifiche_scadenze || "",
        email_avvisi_promemoria: data.email_avvisi_promemoria || "",
        smtp_server: data.smtp_server || "",
        smtp_port: data.smtp_port ? parseInt(data.smtp_port) : 587,
        smtp_username: data.smtp_username || "",
        smtp_password: data.smtp_password || "",
        smtp_use_tls: data.smtp_use_tls !== false,
        colore_primario: data.colore_primario || "#4F46E5",
        logo_url: data.logo_url || "",
        testo_privacy: data.testo_privacy || "",
        tariffe_categorie: tariffe_categorie
    };

    try {
      await axios.put(`${getApiUrl()}/impostazioni/`, payload);
      // Aggiorna lo store delle impostazioni
      updateSettings({
        nome_azienda: payload.nome_azienda,
        logo_url: payload.logo_url,
        colore_primario: payload.colore_primario
      });
      alert('Configurazione salvata con successo.');
    } catch (error) {
      alert('Errore di connessione al server.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentColor = watch("colore_primario");

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Verifica tipo file
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Formato file non supportato. Usa PNG, JPG, GIF, SVG o WEBP');
      return;
    }

    // Verifica dimensione (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File troppo grande. Massimo 5MB');
      return;
    }

    setIsUploadingLogo(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${getApiUrl()}/api/upload/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
        setLogoUrl(res.data.logo_url);
        setValue('logo_url', res.data.logo_url);
        // Aggiorna lo store
        updateSettings({ logo_url: res.data.logo_url });
        alert('Logo caricato con successo!');
    } catch (err: any) {
      alert('Errore durante l\'upload: ' + (err.response?.data?.detail || 'Errore sconosciuto'));
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Rimuovere il logo?')) return;
    setLogoUrl('');
    setValue('logo_url', '');
    // Aggiorna lo store
    updateSettings({ logo_url: '' });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex items-center justify-between">
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
            <h1 className="text-xl font-bold text-slate-800">Impostazioni</h1>
        </div>
        <button 
            onClick={handleSubmit(onSubmit)} 
            disabled={isSaving} 
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md transition-all disabled:opacity-50"
        >
            {isSaving ? '...' : <><Save className="w-4 h-4" /> Salva</>}
        </button>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <div className="space-y-8">
                <IOSCard>
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><Building2 className="w-5 h-5 mr-2 text-blue-500" /> Azienda</h2>
                    <IOSInput label="Ragione Sociale" {...register("nome_azienda")} />
                    <IOSInput label="Indirizzo" {...register("indirizzo_completo")} />
                    <div className="grid grid-cols-2 gap-4">
                        <IOSInput label="P.IVA" {...register("p_iva")} />
                        <IOSInput label="Telefono" {...register("telefono")} />
                    </div>
                    <IOSInput label="Email" {...register("email")} />
                    <IOSInput 
                      label="Email Notifiche Scadenze e Alert" 
                      type="email"
                      {...register("email_notifiche_scadenze")} 
                      placeholder="Email per ricevere notifiche scadenze noleggi"
                    />
                    <IOSInput 
                      label="Email Avvisi e Promemoria" 
                      type="email"
                      {...register("email_avvisi_promemoria")} 
                      placeholder="Email per avvisi e promemoria (es. letture copie)"
                    />
                </IOSCard>

                <IOSCard>
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><Receipt className="w-5 h-5 mr-2 text-orange-500" /> Configurazione SMTP</h2>
                    <p className="text-xs text-gray-500 mb-4">Configurazione server email per l'invio di notifiche automatiche</p>
                    <IOSInput 
                      label="Server SMTP" 
                      {...register("smtp_server")} 
                      placeholder="smtp.gmail.com"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <IOSInput 
                          label="Porta SMTP" 
                          type="number"
                          {...register("smtp_port")} 
                          placeholder="587"
                        />
                        <div className="flex items-center pt-6">
                            <input 
                                type="checkbox" 
                                {...register("smtp_use_tls")} 
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <label className="ml-2 text-sm text-gray-700">Usa TLS/SSL</label>
                        </div>
                    </div>
                    <IOSInput 
                      label="Username/Email SMTP" 
                      type="email"
                      {...register("smtp_username")} 
                      placeholder="tuaemail@gmail.com"
                    />
                    <IOSInput 
                      label="Password App (Gmail)" 
                      type="password"
                      {...register("smtp_password")} 
                      placeholder="Password app generata da Gmail"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                        Per Gmail: genera una "Password app" da <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Account</a>
                    </p>
                </IOSCard>

                <IOSCard>
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><Palette className="w-5 h-5 mr-2 text-purple-500" /> PDF & Grafica</h2>
                    <div className="flex gap-4 items-center mb-4">
                        <div className="flex-1"><IOSInput label="Colore Hex" {...register("colore_primario")} /></div>
                        <div className="w-10 h-10 rounded-lg border shadow-sm mt-1" style={{ backgroundColor: currentColor || '#4F46E5' }}></div>
                    </div>
                    
                    {/* Upload Logo */}
                    <div className="mb-4">
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                            Logo Azienda
                        </label>
                        {logoUrl ? (
                            <div className="relative">
                                <img 
                                    src={`${getApiUrl()}${logoUrl}`} 
                                    alt="Logo" 
                                    className="w-32 h-32 object-contain border border-gray-200 rounded-xl p-2 bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={handleRemoveLogo}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                                    <p className="text-sm text-gray-500">
                                        {isUploadingLogo ? 'Caricamento...' : 'Clicca per caricare logo'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF, SVG, WEBP (max 5MB)</p>
                                </div>
                                <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    disabled={isUploadingLogo}
                                />
                            </label>
                        )}
                        <input type="hidden" {...register("logo_url")} />
                    </div>
                    
                    <IOSTextArea label="Privacy Footer" {...register("testo_privacy")} rows={3} />
                </IOSCard>
            </div>

            <div className="space-y-8">
                <IOSCard>
                    <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center"><Receipt className="w-5 h-5 mr-2 text-emerald-500" /> Listini Base</h2>
                    {CATEGORIE.map(cat => (
                        <div key={cat} className="mb-6 last:mb-0 border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                            <p className="font-semibold text-slate-700 mb-2 text-sm">{cat}</p>
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase text-slate-400">Orario €</label>
                                    <input type="number" {...register(`tariffe_${cat}_orario`)} className="w-full border-b border-gray-200 bg-transparent py-1 text-slate-800 font-medium outline-none focus:border-blue-500" />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase text-slate-400">Chiamata €</label>
                                    <input type="number" {...register(`tariffe_${cat}_chiamata`)} className="w-full border-b border-gray-200 bg-transparent py-1 text-slate-800 font-medium outline-none focus:border-blue-500" />
                                </div>
                            </div>
                        </div>
                    ))}
                </IOSCard>
            </div>
        </div>

        {/* Sezione 2FA per SuperAdmin */}
        <TwoFactorSettings />
      </main>
    </div>
  );
}