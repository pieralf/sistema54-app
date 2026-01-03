import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { ChevronLeft, Plus, Trash2, Printer, Monitor, Wrench, Receipt, Save, AlertCircle, Search, UserPlus, X, Package, PenTool, Home } from 'lucide-react';
import { IOSCard, IOSInput, IOSToggle } from '../components/ui/ios-elements';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { getApiUrl } from '../config/api';
import { useAuthStore } from '../store/authStore';

// --- TIPI ---
type AssetDetail = {
  categoria_it: "Hardware" | "Software" | "Network" | "Generico";
  marca_modello: string;
  serial_number: string;
  part_number?: string;
  descrizione_lavoro: string;
};

type Ricambio = {
  descrizione: string;
  quantita: number;
  prezzo_unitario: number;
  prodotto_id?: number;
};

type FormValues = {
  macro_categoria: "Printing & Office" | "Informatica & IT" | "Manutenzione Gen." | "Sistemi Fiscali";
  cliente_id: number;
  cliente_ragione_sociale: string;
  cliente_indirizzo: string;
  sede_id?: number;
  dettagli: AssetDetail[];
  is_contratto: boolean;
  is_garanzia: boolean;
  is_chiamata: boolean;
  is_sopralluogo: boolean;
  is_prelievo_copie?: boolean; // Prelievo numero copie (solo per Printing)
  flag_diritto_chiamata: boolean;
  ora_inizio?: string; // Formato HH:MM
  ora_fine?: string; // Formato HH:MM
  costi_extra: number;
  descrizione_extra: string;
  difetto_segnalato?: string; // Campo separato per il difetto segnalato
  ricambi: Ricambio[];
  firma_tecnico?: string;
  firma_cliente?: string;
  nome_cliente?: string;
  cognome_cliente?: string;
};

// --- MODALE NUOVO CLIENTE ---
const NewClientModal = ({ isOpen, onClose, onClientCreated }: any) => {
    const { register, handleSubmit, watch, formState: { errors }, getValues } = useForm();
    const isPa = watch("is_pa");

    const onSave = async (data: any) => {
        try {
            const res = await axios.post(`${getApiUrl()}/clienti/`, {
                ...data,
                citta: data.citta || "-",
                cap: data.cap || "00000"
            });
            onClientCreated(res.data);
            onClose();
        } catch (err: any) {
            const msg = err.response?.data?.detail || "Errore sconosciuto.";
            alert("Attenzione: " + msg);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-all">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                <div className="bg-blue-600 p-4 flex justify-between items-center text-white shrink-0">
                    <h3 className="font-bold flex items-center gap-2"><UserPlus className="w-5 h-5" /> Nuovo Cliente</h3>
                    <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded-full"><X className="w-6 h-6" /></button>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto">
                    <div>
                        <IOSInput label="Ragione Sociale *" {...register("ragione_sociale", { required: "Campo obbligatorio" })} />
                        {errors.ragione_sociale && <p className="text-red-500 text-xs mt-1 ml-1">{String(errors.ragione_sociale.message)}</p>}
                    </div>
                    <div>
                        <IOSInput label="Indirizzo Completo *" {...register("indirizzo", { required: "Campo obbligatorio" })} />
                        {errors.indirizzo && <p className="text-red-500 text-xs mt-1 ml-1">{String(errors.indirizzo.message)}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                         <div><IOSInput label="P.IVA" {...register("p_iva")} /></div>
                         <div><IOSInput label="Codice Fiscale" {...register("codice_fiscale")} /></div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                        <label className="flex items-center gap-2 font-semibold text-sm mb-2 text-gray-700 cursor-pointer">
                            <input type="checkbox" {...register("is_pa")} className="w-4 h-4 rounded text-blue-600" /> È Pubblica Amministrazione
                        </label>
                        {isPa && (
                            <div className="grid grid-cols-2 gap-3 animate-in fade-in">
                                <IOSInput label="Codice SDI" {...register("codice_sdi")} />
                                <IOSInput label="PEC" type="email" {...register("email_pec")} />
                            </div>
                        )}
                    </div>
                    <button onClick={handleSubmit(onSave)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold mt-4 shadow-lg">SALVA ANAGRAFICA</button>
                </div>
            </div>
        </div>
    );
};

// --- MODALE CERCA PRODOTTO ---
const ProductSearchModal = ({ isOpen, onClose, onProductSelect }: any) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) { setResults([]); setSearchTerm(""); return; }
        const delay = setTimeout(async () => {
             if(!searchTerm) return;
             setLoading(true);
             try {
                const res = await axios.get(`${getApiUrl()}/magazzino/?q=${searchTerm}`);
                setResults(res.data);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        }, 300);
        return () => clearTimeout(delay);
    }, [searchTerm, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                <div className="bg-green-600 p-4 flex justify-between items-center text-white shrink-0">
                    <h3 className="font-bold flex items-center gap-2"><Package className="w-5 h-5" /> Cerca in Magazzino</h3>
                    <button onClick={onClose}><X className="w-6 h-6" /></button>
                </div>
                <div className="p-4 border-b bg-white">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input autoFocus type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-green-500" placeholder="Cerca codice o descrizione..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gray-50/50">
                    {loading && <div className="text-center py-4 text-gray-400">Ricerca in corso...</div>}
                    {!loading && results.map(p => (
                        <div key={p.id} onClick={() => onProductSelect(p)} className="p-3 bg-white border border-gray-100 rounded-xl hover:bg-green-50 hover:border-green-200 cursor-pointer flex justify-between items-center shadow-sm">
                            <div>
                                <div className="font-bold text-gray-800">{p.descrizione}</div>
                                <div className="text-xs text-gray-500 font-mono">{p.codice_articolo}</div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-green-700">€ {p.prezzo_vendita.toFixed(2)}</div>
                                <div className={`text-xs font-bold ${p.giacenza > 0 ? 'text-gray-500' : 'text-red-500'}`}>Giacenza: {p.giacenza}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- MODALE FIRMA PROFESSIONALE (MIGLIORATA) ---
const SignatureModal = ({ isOpen, onClose, onConfirm, formData }: any) => {
    const sigPadRef = useRef<any>(null);
    const [step, setStep] = useState(1); 
    const [tempTecnico, setTempTecnico] = useState<string>("");
    const [isDrawing, setIsDrawing] = useState(false);
    const [nomeCliente, setNomeCliente] = useState(formData?.nome_cliente || '');
    const [cognomeCliente, setCognomeCliente] = useState(formData?.cognome_cliente || '');

    // Reset quando si apre
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setTempTecnico("");
            setIsDrawing(false);
            setNomeCliente(formData?.nome_cliente || '');
            setCognomeCliente(formData?.cognome_cliente || '');
        }
    }, [isOpen, formData]);

    // Reset canvas quando cambia step
    useEffect(() => {
        if (sigPadRef.current && isOpen) {
            sigPadRef.current.clear();
        }
    }, [step, isOpen]);

    if (!isOpen) return null;

    const handleNext = () => {
        if (sigPadRef.current && sigPadRef.current.isEmpty()) {
            alert("⚠️ Errore: Manca la firma del tecnico.");
            return;
        }
        const data = sigPadRef.current.getTrimmedCanvas().toDataURL('image/png');
        setTempTecnico(data);
        setStep(2);
    };

    const handleFinish = () => {
        if (sigPadRef.current && sigPadRef.current.isEmpty()) {
            alert("⚠️ Errore: Manca la firma del cliente.");
            return;
        }
        if (!nomeCliente.trim() || !cognomeCliente.trim()) {
            alert("⚠️ Errore: Inserisci nome e cognome del firmatario.");
            return;
        }
        const firmaCliente = sigPadRef.current.getTrimmedCanvas().toDataURL('image/png');
        onConfirm(tempTecnico, firmaCliente, nomeCliente.trim(), cognomeCliente.trim());
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
            <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-5 text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <PenTool className="w-6 h-6" /> 
                        Firma Digitale {step === 1 ? "Tecnico (1/2)" : "Cliente (2/2)"}
                    </h3>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-6 md:p-8">
                    <div key={step} className="space-y-5 animate-in fade-in">
                        <div className="text-center">
                            <p className="text-base font-semibold text-gray-800 mb-1">
                                {step === 1 ? "Firma del Tecnico Esecutore" : "Firma Cliente per Accettazione"}
                            </p>
                            <p className="text-xs text-gray-500">
                                {step === 1 
                                    ? "Firma nell'area sottostante utilizzando il dito o lo stilo" 
                                    : "Il cliente deve firmare per accettare l'intervento"}
                            </p>
                        </div>
                        
                        {/* Canvas Firma - Ottimizzato per Touch */}
                        <div className="border-3 border-dashed border-blue-300 rounded-2xl bg-gradient-to-br from-gray-50 to-white p-2 shadow-inner">
                            <div className="relative bg-white rounded-xl overflow-hidden" style={{ height: '300px', touchAction: 'none' }}>
                                <SignatureCanvas 
                                    ref={sigPadRef}
                                    penColor="#1e293b"
                                    backgroundColor="transparent"
                                    velocityFilterWeight={0.7}
                                    minWidth={2}
                                    maxWidth={3}
                                    throttle={16}
                                    onBegin={() => setIsDrawing(true)}
                                    onEnd={() => setIsDrawing(false)}
                                    canvasProps={{
                                        className: 'w-full h-full touch-none',
                                        style: { touchAction: 'none' }
                                    }} 
                                />
                                {!isDrawing && sigPadRef.current?.isEmpty() && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <p className="text-gray-300 text-sm font-medium">Firma qui</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Controlli */}
                        <div className="flex gap-3">
                            <button 
                                onClick={() => sigPadRef.current?.clear()} 
                                className="flex-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 py-2.5 rounded-xl font-semibold transition-all border border-red-200"
                            >
                                🗑️ Pulisci
                            </button>
                            {step === 1 ? (
                                <button 
                                    onClick={handleNext} 
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold transition-all shadow-md"
                                >
                                    Avanti →
                                </button>
                            ) : (
                                <>
                                    <button 
                                        onClick={() => setStep(1)} 
                                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold transition-all"
                                    >
                                        ← Indietro
                                    </button>
                                    <button 
                                        onClick={handleFinish} 
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-4 h-4" /> Conferma
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Campi Nome/Cognome Firmatario - Solo nel passo 2 */}
                        {step === 2 && (
                            <>
                                <div className="space-y-3 mt-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                            Nome Firmatario *
                                        </label>
                                        <input
                                            type="text"
                                            value={nomeCliente}
                                            onChange={(e) => setNomeCliente(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Nome"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                            Cognome Firmatario *
                                        </label>
                                        <input
                                            type="text"
                                            value={cognomeCliente}
                                            onChange={(e) => setCognomeCliente(e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Cognome"
                                            required
                                        />
                                    </div>
                                </div>
                                
                                {/* Disclaimer Legale */}
                                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg mt-4">
                                    <p className="text-xs text-amber-800 leading-relaxed text-justify">
                                        Il Cliente, apponendo la propria firma, dichiara di aver verificato l'intervento e di accettarlo senza riserve, riconoscendone l'esecuzione a regola d'arte e la congruità di tempi e materiali. Autorizza altresì il trattamento dei dati personali raccolti, inclusa l'acquisizione del tratto grafico della firma, esclusivamente per finalità amministrative, contabili e di gestione contrattuale, ai sensi del Regolamento UE 2016/679 (GDPR). La presente sottoscrizione ha piena validità legale.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- PAGINA PRINCIPALE ---
export default function NewInterventionPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const navigate = useNavigate();
  const { token } = useAuthStore();

  // Stati Modali
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  
  // Ricerca Cliente
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [contractLocked, setContractLocked] = useState(false);
  const [clienteMultisede, setClienteMultisede] = useState<any>(null);
  const [sediCliente, setSediCliente] = useState<any[]>([]);
  const [assetsNoleggioCliente, setAssetsNoleggioCliente] = useState<any[]>([]); // Assets a noleggio del cliente
  const [lettureCopie, setLettureCopie] = useState<{[key: number]: {contatore_bn: number, contatore_colore: number}}>({}); // Letture copie per ogni asset
  const [ultimeLetture, setUltimeLetture] = useState<{[key: number]: {data: string, contatore_bn: number, contatore_colore: number}}>({}); // Ultime letture per validazione
  
  // Dati temporanei
  const [formDataTemp, setFormDataTemp] = useState<any>(null);
  
  const { register, control, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      macro_categoria: "Informatica & IT",
      dettagli: [{ categoria_it: "Hardware", marca_modello: "", serial_number: "", part_number: "", descrizione_lavoro: "" }],
      flag_diritto_chiamata: true,
      ora_inizio: "",
      ora_fine: new Date().toTimeString().slice(0, 5), // Default = ora corrente
      costi_extra: 0,
      descrizione_extra: "",
      difetto_segnalato: "",
      ricambi: []
    }
  });

  const { fields: assetFields, append: appendAsset, remove: removeAsset } = useFieldArray({ control, name: "dettagli" });
  const { fields: ricambiFields, append: appendRicambio, remove: removeRicambio } = useFieldArray({ control, name: "ricambi" });

  const isContratto = watch("is_contratto");
  const macroCategoria = watch("macro_categoria");
  const clienteSelezionato = watch("cliente_ragione_sociale");
  const ricambiValues = watch("ricambi");
  
  const totaleRicambi = ricambiValues?.reduce((acc, curr) => acc + ((Number(curr.quantita) || 0) * (Number(curr.prezzo_unitario) || 0)), 0) || 0;

  useEffect(() => {
    axios.get(`${getApiUrl()}/impostazioni/`).then(res => setSettings(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    // Se contratto è attivo, disabilita chiamata
    if (isContratto) {
      setValue("flag_diritto_chiamata", false);
      setValue("is_chiamata", false);
    }
  }, [isContratto, setValue]);

  // Sincronizza is_chiamata con flag_diritto_chiamata
  const flagDirittoChiamata = watch("flag_diritto_chiamata");
  useEffect(() => {
    // Quando flag_diritto_chiamata cambia, aggiorna anche is_chiamata
    setValue("is_chiamata", flagDirittoChiamata);
  }, [flagDirittoChiamata, setValue]);

  // Aggiorna contratto/chiamata quando cambia la macro categoria
  useEffect(() => {
    const clienteId = watch("cliente_id");
    const macroCategoria = watch("macro_categoria");
    
    if (clienteId && clienteMultisede) {
      // Ricalcola se il cliente ha contratto per la nuova macro categoria
      let hasContrattoPerCategoria = false;
      
      if (macroCategoria === "Informatica & IT") {
        hasContrattoPerCategoria = clienteMultisede.has_contratto_assistenza || false;
      } else if (macroCategoria === "Printing & Office") {
        // Controlla se ci sono assets printing a noleggio
        hasContrattoPerCategoria = assetsNoleggioCliente.length > 0;
      }
      
      if (hasContrattoPerCategoria) {
        setValue("is_contratto", true);
        setValue("flag_diritto_chiamata", false);
        setValue("is_chiamata", false);
        setContractLocked(true);
      } else {
        setValue("is_contratto", false);
        setValue("flag_diritto_chiamata", true);
        setValue("is_chiamata", true);
        setContractLocked(false);
      }
    }
  }, [watch("macro_categoria"), watch("cliente_id"), clienteMultisede, assetsNoleggioCliente.length, setValue]);
  
  // Aggiorna le macchine Printing quando cambia la sede selezionata
  useEffect(() => {
    const sedeIdSelezionata = watch("sede_id");
    const clienteId = watch("cliente_id");
    
    if (clienteId && clienteMultisede && clienteMultisede.has_noleggio && macroCategoria === "Printing & Office") {
      // Ricarica gli assets filtrati per sede
      const caricaAssetsPerSede = async () => {
        try {
          const clienteRes = await axios.get(`${getApiUrl()}/clienti/${clienteId}`);
          if (clienteRes.data?.assets_noleggio) {
            let assetsPrinting = clienteRes.data.assets_noleggio.filter((a: any) => a.tipo_asset === "Printing");
            
            // Filtra per sede: se è selezionata una sede specifica, mostra SOLO quelle di quella sede
            // Se è selezionata "Sede Centrale/Legale" (sedeIdSelezionata è null/undefined), mostra SOLO quelle senza sede_id
            if (sedeIdSelezionata !== undefined && sedeIdSelezionata !== null) {
              // Sede specifica selezionata: mostra solo macchine di quella sede
              const sedeIdNum = parseInt(sedeIdSelezionata.toString());
              assetsPrinting = assetsPrinting.filter((a: any) => 
                a.sede_id === sedeIdNum
              );
            } else {
              // Sede Centrale/Legale selezionata: mostra solo macchine senza sede_id (sede centrale)
              assetsPrinting = assetsPrinting.filter((a: any) => 
                a.sede_id === null || a.sede_id === undefined
              );
            }
            
            setAssetsNoleggioCliente(assetsPrinting);
            
            // Ricarica anche le ultime letture
            const lettureMap: {[key: number]: {data: string, contatore_bn: number, contatore_colore: number}} = {};
            for (const asset of assetsPrinting) {
              try {
                const lettureRes = await axios.get(`${getApiUrl()}/letture-copie/asset/${asset.id}/ultima`);
                if (lettureRes.data) {
                  lettureMap[asset.id] = {
                    data: lettureRes.data.data_lettura,
                    contatore_bn: lettureRes.data.contatore_bn || 0,
                    contatore_colore: lettureRes.data.contatore_colore || 0
                  };
                }
              } catch (err) {
                lettureMap[asset.id] = {
                  data: asset.data_installazione || new Date().toISOString(),
                  contatore_bn: asset.contatore_iniziale_bn || 0,
                  contatore_colore: asset.contatore_iniziale_colore || 0
                };
              }
            }
            setUltimeLetture(lettureMap);
          }
        } catch (err) {
          console.error('Errore ricaricamento assets per sede:', err);
        }
      };
      
      caricaAssetsPerSede();
    }
  }, [watch("sede_id"), watch("cliente_id"), clienteMultisede, macroCategoria]);

  useEffect(() => {
      const delay = setTimeout(async () => {
        if (searchTerm.length > 2) {
            try {
                const res = await axios.get(`${getApiUrl()}/clienti/?q=${searchTerm}`);
                setSearchResults(res.data);
                setShowResults(true);
            } catch (e) { console.error(e); }
        } else {
            setSearchResults([]); setShowResults(false);
        }
      }, 300);
      return () => clearTimeout(delay);
  }, [searchTerm]);

  const selezionaCliente = async (c: any) => {
      setValue("cliente_id", c.id);
      setValue("cliente_ragione_sociale", c.ragione_sociale);
      setValue("cliente_indirizzo", c.indirizzo);
      setValue("is_contratto", c.has_contratto_assistenza || false);
      setContractLocked(c.has_contratto_assistenza || false);
      setValue("sede_id", undefined); // Reset sede selezionata
      setSearchTerm(""); setShowResults(false);
      
      // Se il cliente ha multisede, carica le sedi
      if (c.has_multisede) {
        try {
          const res = await axios.get(`${getApiUrl()}/clienti/${c.id}/sedi`);
          setSediCliente(res.data);
          setClienteMultisede(c);
        } catch (err) {
          console.error('Errore caricamento sedi:', err);
          setSediCliente([]);
          setClienteMultisede(null);
        }
      } else {
        setSediCliente([]);
        setClienteMultisede(null);
      }
      
      // Carica assets a noleggio se il cliente ha contratto noleggio
      let clienteCompleto: any = null;
      if (c.has_noleggio) {
        try {
          const clienteRes = await axios.get(`${getApiUrl()}/clienti/${c.id}`);
          clienteCompleto = clienteRes.data;
          if (clienteCompleto?.assets_noleggio) {
            // Filtra per tipo Printing e per sede se selezionata
            const sedeIdSelezionata = watch("sede_id");
            let assetsPrinting = clienteRes.data.assets_noleggio.filter((a: any) => a.tipo_asset === "Printing");
            
            // Filtra per sede: se è selezionata una sede specifica, mostra SOLO quelle di quella sede
            // Se è selezionata "Sede Centrale/Legale" (sedeIdSelezionata è null/undefined), mostra SOLO quelle senza sede_id
            if (sedeIdSelezionata !== undefined && sedeIdSelezionata !== null) {
              // Sede specifica selezionata: mostra solo macchine di quella sede
              const sedeIdNum = parseInt(sedeIdSelezionata.toString());
              assetsPrinting = assetsPrinting.filter((a: any) => 
                a.sede_id === sedeIdNum
              );
            } else {
              // Sede Centrale/Legale selezionata: mostra solo macchine senza sede_id (sede centrale)
              assetsPrinting = assetsPrinting.filter((a: any) => 
                a.sede_id === null || a.sede_id === undefined
              );
            }
            
            setAssetsNoleggioCliente(assetsPrinting);
            
            // Carica ultime letture per ogni asset printing
            const lettureMap: {[key: number]: {data: string, contatore_bn: number, contatore_colore: number}} = {};
            for (const asset of assetsPrinting) {
              try {
                const lettureRes = await axios.get(`${getApiUrl()}/letture-copie/asset/${asset.id}/ultima`);
                if (lettureRes.data) {
                  lettureMap[asset.id] = {
                    data: lettureRes.data.data_lettura,
                    contatore_bn: lettureRes.data.contatore_bn || 0,
                    contatore_colore: lettureRes.data.contatore_colore || 0
                  };
                }
              } catch (err) {
                // Nessuna lettura precedente, usa contatori iniziali
                lettureMap[asset.id] = {
                  data: asset.data_installazione || new Date().toISOString(),
                  contatore_bn: asset.contatore_iniziale_bn || 0,
                  contatore_colore: asset.contatore_iniziale_colore || 0
                };
              }
            }
            setUltimeLetture(lettureMap);
          } else {
            setAssetsNoleggioCliente([]);
          }
        } catch (err) {
          console.error('Errore caricamento assets noleggio:', err);
          setAssetsNoleggioCliente([]);
        }
      } else {
        setAssetsNoleggioCliente([]);
      }
      
      // Gestione contratto/chiamata in base al cliente e macro categoria
      const macroCategoriaCorrente = watch("macro_categoria");
      
      // Determina se il cliente ha contratto per la macro categoria corrente
      let hasContrattoPerCategoria = false;
      
      if (macroCategoriaCorrente === "Informatica & IT") {
        // Per Informatica: controlla contratto assistenza
        hasContrattoPerCategoria = c.has_contratto_assistenza || false;
      } else if (macroCategoriaCorrente === "Printing & Office") {
        // Per Printing: controlla se ha prodotti a noleggio (printing)
        if (clienteCompleto) {
          const hasPrintingNoleggio = clienteCompleto.has_noleggio && 
            clienteCompleto.assets_noleggio?.some((a: any) => a.tipo_asset === "Printing");
          hasContrattoPerCategoria = hasPrintingNoleggio || false;
        } else {
          // Se non abbiamo caricato i dati completi, usa i dati base
          hasContrattoPerCategoria = c.has_noleggio || false;
        }
      }
      
      if (hasContrattoPerCategoria) {
        // Cliente CON contratto per questa categoria: contratto attivo, chiamata disabilitata
        setValue("is_contratto", true);
        setValue("flag_diritto_chiamata", false);
        setValue("is_chiamata", false);
        setContractLocked(true);
      } else {
        // Cliente SENZA contratto per questa categoria: chiamata attiva di default
        setValue("is_contratto", false);
        setValue("flag_diritto_chiamata", true);
        setValue("is_chiamata", true);
        setContractLocked(false);
      }
  };

  const handleAddProductFromStore = (product: any) => {
      // Verifica se ci sono asset a noleggio nei dettagli
      const dettagli = watch("dettagli") || [];
      const hasNoleggioAsset = dettagli.some((det: any) => {
        const partNumber = det.part_number || '';
        return partNumber.startsWith('NOLEGGIO_');
      });
      
      // Se c'è almeno un asset a noleggio, applica sconto 100% (prezzo = 0)
      const prezzoFinale = hasNoleggioAsset ? 0 : product.prezzo_vendita;
      
      appendRicambio({ descrizione: product.descrizione, quantita: 1, prezzo_unitario: prezzoFinale, prodotto_id: product.id });
      setIsProductModalOpen(false);
  };

  const getCurrentPrice = () => {
    if (!settings?.tariffe_categorie) return 0;
    return settings.tariffe_categorie[macroCategoria]?.chiamata || 30.00;
  };

  // Funzione helper per verificare se una macchina può fare il prelievo
  const puoPrelievoMacchina = (asset: any): boolean => {
    const ultimaLettura = ultimeLetture[asset.id];
    const dataUltima = ultimaLettura ? new Date(ultimaLettura.data) : null;
    const giorniDaUltima = dataUltima ? Math.floor((new Date().getTime() - dataUltima.getTime()) / (1000 * 60 * 60 * 24)) : null;
    
    // Calcola giorni minimi in base alla cadenza configurata
    const cadenza = asset.cadenza_letture_copie || 'trimestrale';
    const giorniMinimi: {[key: string]: number} = {
      'mensile': 30,
      'bimestrale': 60,
      'trimestrale': 90,
      'semestrale': 180
    };
    const giorniMinimiRichiesti = giorniMinimi[cadenza] || 90;
    return giorniDaUltima === null || giorniDaUltima >= giorniMinimiRichiesti;
  };

  const onSubmit = (data: FormValues) => {
    if (!data.cliente_id) { alert("Seleziona un cliente!"); return; }
    
    // Validazione prelievo copie: se è attivo, solo le macchine che possono fare il prelievo devono avere le copie inserite
    if (data.is_prelievo_copie && macroCategoria === "Printing & Office") {
      const assetsPrinting = assetsNoleggioCliente.filter((a: any) => a.tipo_asset === "Printing");
      
      // Filtra solo le macchine che possono fare il prelievo (escludi quelle bloccate)
      const macchineCheRichiedonoPrelievo = assetsPrinting.filter((asset: any) => puoPrelievoMacchina(asset));
      
      // Verifica quali macchine che richiedono prelievo non hanno le letture inserite
      const macchineSenzaLetture = macchineCheRichiedonoPrelievo.filter((asset: any) => {
        const lettura = lettureCopie[asset.id];
        return !lettura || lettura.contatore_bn === undefined || lettura.contatore_bn === null || (asset.is_colore && (lettura.contatore_colore === undefined || lettura.contatore_colore === null));
      });
      
      if (macchineSenzaLetture.length > 0) {
        alert(`Devi inserire le letture copie per tutte le macchine a noleggio che richiedono il prelievo:\n${macchineSenzaLetture.map((a: any) => `${a.marca} ${a.modello}`).join('\n')}`);
        return;
      }
    }
    
    setFormDataTemp(data);
    setIsSignatureModalOpen(true);
  };

 // --- LOGICA CRITICA: SALVATAGGIO CON DEBUG AVANZATO ---
  const handleSignatureConfirm = async (firmaTec: string, firmaCli: string, nomeCliente: string, cognomeCliente: string) => {
    console.log("Inizio processo di salvataggio..."); 
    
    // Validazione prelievo copie anche qui (doppio controllo)
    if (formDataTemp?.is_prelievo_copie && macroCategoria === "Printing & Office") {
      const assetsPrinting = assetsNoleggioCliente.filter((a: any) => a.tipo_asset === "Printing");
      const macchineCheRichiedonoPrelievo = assetsPrinting.filter((asset: any) => puoPrelievoMacchina(asset));
      const macchineSenzaLetture = macchineCheRichiedonoPrelievo.filter((asset: any) => {
        const lettura = lettureCopie[asset.id];
        return !lettura || lettura.contatore_bn === undefined || lettura.contatore_bn === null || (asset.is_colore && (lettura.contatore_colore === undefined || lettura.contatore_colore === null));
      });
      
      if (macchineSenzaLetture.length > 0) {
        alert(`Devi inserire le letture copie per tutte le macchine a noleggio che richiedono il prelievo:\n${macchineSenzaLetture.map((a: any) => `${a.marca} ${a.modello}`).join('\n')}`);
        return;
      }
    }
    
    setIsSignatureModalOpen(false);
    setIsSubmitting(true);
    
    try {
        // 1. Pulizia e Preparazione Dati
        // Pydantic (Backend) è severo: se un campo stringa è obbligatorio, non può essere vuoto o null.
        const dettagliPuliti = formDataTemp.dettagli.map((d: any) => ({
            ...d,
            // Se marca_modello è vuota, mettiamo un trattino per evitare errore 422
            marca_modello: d.marca_modello?.trim() || "-", 
            // Idem per la descrizione
            descrizione_lavoro: d.descrizione_lavoro?.trim() || "-",
            // Serial number è opzionale nel backend, quindi stringa vuota va bene (diventerà null)
            serial_number: d.serial_number || "",
            // Part number è opzionale - rimuovi il prefisso NOLEGGIO_ se presente prima di inviare
            part_number: d.part_number && d.part_number.startsWith('NOLEGGIO_') ? null : (d.part_number || null)
        }));

        const finalData = {
            ...formDataTemp,
            firma_tecnico: firmaTec,
            firma_cliente: firmaCli,
            nome_cliente: nomeCliente,
            cognome_cliente: cognomeCliente,
            dettagli: dettagliPuliti,
            // Forziamo i numeri
            costi_extra: Number(formDataTemp.costi_extra) || 0,
            cliente_id: Number(formDataTemp.cliente_id),
            sede_id: formDataTemp.sede_id ? Number(formDataTemp.sede_id) : null,
            ricambi: formDataTemp.ricambi ? formDataTemp.ricambi.map((r: any) => ({
                ...r,
                quantita: Number(r.quantita),
                prezzo_unitario: Number(r.prezzo_unitario)
            })) : []
        };


        // 2. Chiamata API
        const response = await axios.post(`${getApiUrl()}/interventi/`, finalData);
      
        // 3. Successo
        const nuovoId = response.data.id;
        const numeroRit = response.data.numero_relazione;
        
        // 4. Salva letture copie se prelievo copie è attivo
        if (formDataTemp.is_prelievo_copie && macroCategoria === "Printing & Office") {
          const assetsPrinting = assetsNoleggioCliente.filter((a: any) => a.tipo_asset === "Printing");
          if (!token) {
            console.error('Token non disponibile per salvare le letture copie');
            alert('Errore: sessione scaduta. Le letture copie non sono state salvate. Ricarica la pagina e riprova.');
          } else {
            for (const asset of assetsPrinting) {
              const lettura = lettureCopie[asset.id];
              if (lettura && lettura.contatore_bn !== undefined && lettura.contatore_bn !== null) {
                try {
                  // Usa axios con gli header di default già configurati
                  const response = await axios.post(`${getApiUrl()}/letture-copie/`, {
                    asset_id: asset.id,
                    intervento_id: nuovoId,
                    data_lettura: new Date().toISOString(),
                    contatore_bn: lettura.contatore_bn,
                    contatore_colore: lettura.contatore_colore || 0
                  });
                  console.log(`Lettura copie salvata per asset ${asset.id}:`, response.data);
                } catch (err: any) {
                  console.error(`Errore salvataggio lettura per asset ${asset.id}:`, err);
                  if (err.response?.status === 401) {
                    alert(`Errore di autenticazione. Le letture copie per ${asset.marca} ${asset.modello} non sono state salvate. Ricarica la pagina e riprova.`);
                  } else {
                    alert(`Errore nel salvare la lettura copie per ${asset.marca} ${asset.modello}: ${err.response?.data?.detail || err.message}`);
                  }
                }
              }
            }
          }
          
          // Ricarica le ultime letture dopo il salvataggio per aggiornare lo stato
          if (formDataTemp.is_prelievo_copie && macroCategoria === "Printing & Office") {
            try {
              const clienteId = formDataTemp.cliente_id;
              const clienteRes = await axios.get(`${getApiUrl()}/clienti/${clienteId}`);
              if (clienteRes.data?.assets_noleggio) {
                const assetsPrinting = clienteRes.data.assets_noleggio.filter((a: any) => a.tipo_asset === "Printing");
                const lettureMap: {[key: number]: {data: string, contatore_bn: number, contatore_colore: number}} = {};
                for (const asset of assetsPrinting) {
                  try {
                    // Usa axios con gli header di default già configurati
                    const lettureRes = await axios.get(`${getApiUrl()}/letture-copie/asset/${asset.id}/ultima`);
                    if (lettureRes.data) {
                      lettureMap[asset.id] = {
                        data: lettureRes.data.data_lettura,
                        contatore_bn: lettureRes.data.contatore_bn || 0,
                        contatore_colore: lettureRes.data.contatore_colore || 0
                      };
                    }
                  } catch (err) {
                    // Nessuna lettura precedente, usa contatori iniziali
                    lettureMap[asset.id] = {
                      data: asset.data_installazione || new Date().toISOString(),
                      contatore_bn: asset.contatore_iniziale_bn || 0,
                      contatore_colore: asset.contatore_iniziale_colore || 0
                    };
                  }
                }
                setUltimeLetture(lettureMap);
              }
            } catch (err) {
              console.error('Errore ricaricamento ultime letture:', err);
            }
          }
        }

        // Scarica e apre il PDF con autenticazione
        let pdfOpened = false;
        try {
          const pdfResponse = await axios.get(`${getApiUrl()}/interventi/${nuovoId}/pdf`, {
            responseType: 'blob',
          });
          
          // Verifica che il contenuto sia valido
          if (pdfResponse.data && pdfResponse.data.size > 0) {
            // Estrai il nome file dall'header Content-Disposition se disponibile
            let filename = numeroRit;
            const contentDisposition = pdfResponse.headers['content-disposition'];
            if (contentDisposition) {
              const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
              if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '').replace('.pdf', '');
              }
            }
            
            // Crea un File object con il nome corretto per preservare il nome file
            const file = new File([pdfResponse.data], `${filename}.pdf`, { type: 'application/pdf' });
            const url = window.URL.createObjectURL(file);
            
            // Forza il download con il nome corretto invece di aprire in una nuova finestra
            const link = document.createElement('a');
            link.href = url;
            link.download = `${filename}.pdf`;
            link.style.display = 'none';
            document.body.appendChild(link);
            
            // Apri in una nuova finestra dopo il download per visualizzarlo
            setTimeout(() => {
              link.click();
              pdfOpened = true;
              
              // Apri anche in una nuova finestra per visualizzazione
              const pdfWindow = window.open(url, '_blank');
              if (!pdfWindow) {
                // Se il popup è bloccato, almeno il download è avvenuto
                console.log('Popup bloccato, ma download completato');
              }
              
              // Pulisci dopo un delay
              setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
              }, 2000);
            }, 100);
          } else {
            console.error('PDF vuoto o non valido');
          }
        } catch (pdfErr: any) {
          console.error('Errore apertura PDF:', pdfErr);
          const errorMsg = pdfErr.response?.data?.detail || pdfErr.message || 'Errore sconosciuto';
          alert(`⚠️ R.I.T. ${numeroRit} CREATO!\n\nErrore nell'apertura del PDF: ${errorMsg}\n\nPuoi scaricarlo dall'archivio interventi.`);
        }
      
        // Non bloccare con alert - naviga direttamente
        navigate('/');
      
    } catch (error: any) {
      console.error("ERRORE SALVATAGGIO:", error);
      
      // 4. Gestione Errore Leggibile
      let errorMsg = "Errore sconosciuto";
      
      if (error.response?.data?.detail) {
          const detail = error.response.data.detail;
          if (Array.isArray(detail)) {
              // Se è un array di errori Pydantic, li formattiamo
              errorMsg = detail.map((e: any) => `Campo: ${e.loc.join('.')} -> ${e.msg}`).join('\n');
          } else {
              errorMsg = String(detail);
          }
      } else {
          errorMsg = error.message;
      }

      alert(`❌ ERRORE DATI (422):\n${errorMsg}\n\nControlla di aver compilato tutti i campi obbligatori (es. Marca/Modello).`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const MacroCatCard = ({ value, icon: Icon, label }: any) => (
    <div onClick={() => setValue("macro_categoria", value)} className={`cursor-pointer p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${macroCategoria === value ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-md transform scale-[1.02]' : 'bg-white border-gray-200 text-gray-400 hover:border-blue-300'}`}>
        <Icon className="w-6 h-6" />
        <span className="text-[10px] font-bold uppercase text-center">{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 relative font-sans">
      <NewClientModal isOpen={isClientModalOpen} onClose={() => setIsClientModalOpen(false)} onClientCreated={selezionaCliente} />
      <ProductSearchModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} onProductSelect={handleAddProductFromStore} />
      
      {/* MODALE FIRMA */}
      <SignatureModal 
        isOpen={isSignatureModalOpen} 
        onClose={() => setIsSignatureModalOpen(false)} 
        onConfirm={handleSignatureConfirm}
        formData={formDataTemp}
      />

      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/')} 
            className="p-2 -ml-2 text-gray-600 rounded-full hover:bg-gray-100"
            title="Home"
          >
            <Home className="w-6 h-6" />
          </button>
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 text-gray-600 rounded-full hover:bg-gray-100"
            title="Torna indietro"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Nuovo Intervento</h1>
        </div>
        <button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className={`text-sm font-semibold flex items-center gap-2 px-4 py-2 rounded-full transition-all ${isSubmitting ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'}`}>
          {isSubmitting ? 'Attendere...' : <><Save className="w-4 h-4" /> Firma</>}
        </button>
      </header>

      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <MacroCatCard value="Printing & Office" icon={Printer} label="Print" />
            <MacroCatCard value="Informatica & IT" icon={Monitor} label="IT" />
            <MacroCatCard value="Sistemi Fiscali" icon={Receipt} label="Fiscali" />
            <MacroCatCard value="Manutenzione Gen." icon={Wrench} label="Altro" />
        </div>

        <IOSCard className="overflow-visible">
            <div className="flex justify-between items-center mb-3">
                 <h2 className="font-bold text-gray-900 text-base">Cliente</h2>
                 <button onClick={() => setIsClientModalOpen(true)} className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full flex items-center gap-1 border border-blue-100"><UserPlus className="w-3 h-3" /> NUOVO</button>
            </div>
            <div className="relative z-20">
                {!clienteSelezionato ? (
                    <>
                        <div className="relative group">
                            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input type="text" className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" placeholder="Cerca Ragione Sociale..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        {showResults && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl mt-2 max-h-64 overflow-y-auto z-30">
                                {searchResults.map(c => (
                                    <div key={c.id} onClick={() => selezionaCliente(c)} className="p-3 hover:bg-blue-50 cursor-pointer border-b last:border-0">
                                        <div className="font-bold text-gray-800">{c.ragione_sociale}</div>
                                        <div className="text-xs text-gray-500">{c.indirizzo}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 relative">
                        <button onClick={() => { 
                          setValue("cliente_id", 0); 
                          setValue("cliente_ragione_sociale", ""); 
                          setValue("sede_id", undefined);
                          setSediCliente([]);
                          setClienteMultisede(null);
                        }} className="absolute top-3 right-3 text-blue-300 hover:text-red-500"><X className="w-4 h-4" /></button>
                        <div className="font-bold text-blue-900 text-lg pr-8">{clienteSelezionato}</div>
                        
                        {clienteMultisede && sediCliente.length > 0 ? (
                          <div className="mt-3">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                              Seleziona Sede
                            </label>
                            <select
                              {...register("sede_id")}
                              onChange={(e) => {
                                const sedeId = e.target.value ? parseInt(e.target.value) : undefined;
                                setValue("sede_id", sedeId);
                                if (sedeId) {
                                  const sede = sediCliente.find(s => s.id === sedeId);
                                  if (sede) {
                                    setValue("cliente_indirizzo", sede.indirizzo_completo);
                                  }
                                } else {
                                  setValue("cliente_indirizzo", clienteMultisede.indirizzo);
                                }
                              }}
                              className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                              {!clienteMultisede?.sede_legale_operativa && (
                                <option value="">Sede Centrale/Legale</option>
                              )}
                              {sediCliente.map((sede) => (
                                <option key={sede.id} value={sede.id}>
                                  {sede.nome_sede}
                                </option>
                              ))}
                            </select>
                            <div className="text-sm text-blue-600/80 mt-2">
                              {watch("sede_id") ? (
                                sediCliente.find(s => s.id === parseInt(watch("sede_id")?.toString() || "0"))?.indirizzo_completo
                              ) : (
                                watch("cliente_indirizzo")
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-blue-600/80 mt-1">{watch("cliente_indirizzo")}</div>
                        )}
                    </div>
                )}
            </div>
        </IOSCard>

        <div>
             <div className="flex justify-between items-end mb-3 px-1">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Dettaglio Lavori</h2>
                <button type="button" onClick={() => appendAsset({ categoria_it: "Hardware", marca_modello: "", serial_number: "", part_number: "", descrizione_lavoro: "" })} className="text-xs font-bold text-blue-600 bg-white px-3 py-1.5 rounded-full flex items-center border border-gray-200 shadow-sm"><Plus className="w-3 h-3 mr-1" /> AGGIUNGI</button>
            </div>
            <div className="space-y-4">
                {assetFields.map((field, index) => {
                  // Filtra assets a noleggio in base alla macro categoria
                  const assetsFiltrati = assetsNoleggioCliente.filter((asset: any) => {
                    if (macroCategoria === "Informatica & IT") {
                      return asset.tipo_asset === "IT";
                    } else if (macroCategoria === "Printing & Office") {
                      return asset.tipo_asset === "Printing";
                    }
                    return false;
                  });
                  
                  const partNumberValue = watch(`dettagli.${index}.part_number`) || '';
                  const isNoleggio = partNumberValue.startsWith('NOLEGGIO_');
                  
                  return (
                    <div key={field.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm relative group">
                        <button type="button" onClick={() => removeAsset(index)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        <div className="mb-4 flex items-center gap-2">
                          <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded border border-gray-200 uppercase">Asset #{index + 1}</span>
                          {isNoleggio && (
                            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded border border-green-300 uppercase">A NOLEGGIO</span>
                          )}
                        </div>
                        
                        {/* Dropdown per selezionare prodotto a noleggio */}
                        {assetsFiltrati.length > 0 && (
                          <div className="mb-3">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                              Seleziona Prodotto a Noleggio (opzionale)
                            </label>
                            <select
                              className="w-full bg-blue-50 border-2 border-blue-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                              onChange={(e) => {
                                const assetId = e.target.value;
                                if (assetId && assetId !== '') {
                                  const assetSelezionato = assetsFiltrati.find((a: any) => a.id === parseInt(assetId));
                                  if (assetSelezionato) {
                                    // Precompila i campi con i dati del prodotto a noleggio
                                    if (macroCategoria === "Informatica & IT") {
                                      setValue(`dettagli.${index}.marca_modello`, `${assetSelezionato.marca || ''} ${assetSelezionato.modello || ''}`.trim() || assetSelezionato.descrizione || '');
                                      setValue(`dettagli.${index}.serial_number`, assetSelezionato.seriale || '');
                                      setValue(`dettagli.${index}.categoria_it`, "Hardware");
                                    } else if (macroCategoria === "Printing & Office") {
                                      setValue(`dettagli.${index}.marca_modello`, `${assetSelezionato.marca || ''} ${assetSelezionato.modello || ''}`.trim());
                                      setValue(`dettagli.${index}.serial_number`, assetSelezionato.matricola || '');
                                    }
                                    // Marca questo asset come a noleggio (salviamo l'ID nel campo part_number)
                                    setValue(`dettagli.${index}.part_number`, `NOLEGGIO_${assetSelezionato.id}`);
                                    
                                    // Imposta automaticamente contratto e disabilita diritto di chiamata
                                    setValue("is_contratto", true);
                                    setValue("flag_diritto_chiamata", false);
                                  }
                                } else {
                                  // Reset se si seleziona "Seleziona..."
                                  setValue(`dettagli.${index}.part_number`, '');
                                  // Verifica se ci sono ancora altri prodotti a noleggio
                                  const dettagli = watch("dettagli") || [];
                                  const hasOtherNoleggio = dettagli.some((det: any, idx: number) => {
                                    if (idx === index) return false;
                                    const partNumber = det.part_number || '';
                                    return partNumber.startsWith('NOLEGGIO_');
                                  });
                                  // Se non ci sono altri prodotti a noleggio, ripristina lo stato originale
                                  if (!hasOtherNoleggio) {
                                    const clienteId = watch("cliente_id");
                                    // Ripristina in base al cliente (se ha contratto assistenza mantieni contratto)
                                    // Altrimenti ripristina chiamata
                                  }
                                }
                              }}
                              value={isNoleggio ? partNumberValue.replace('NOLEGGIO_', '') : ''}
                            >
                              <option value="">-- Seleziona prodotto a noleggio o inserisci manualmente --</option>
                              {assetsFiltrati.map((asset: any) => (
                                <option key={asset.id} value={asset.id}>
                                  {macroCategoria === "Informatica & IT" 
                                    ? `${asset.marca || ''} ${asset.modello || ''} ${asset.descrizione || ''} - SN: ${asset.seriale || 'N/A'}`.trim()
                                    : `${asset.marca || ''} ${asset.modello || ''} - Matricola: ${asset.matricola || 'N/A'}`.trim()
                                  }
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        
                        {macroCategoria === "Informatica & IT" && (
                            <select {...register(`dettagli.${index}.categoria_it`)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none mb-3">
                                <option value="Hardware">Hardware</option><option value="Software">Software</option><option value="Network">Network</option>
                            </select>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                            <IOSInput label="Prodotto / Modello" {...register(`dettagli.${index}.marca_modello`)} />
                            <IOSInput label="Serial Number" {...register(`dettagli.${index}.serial_number`)} />
                            <IOSInput label="Part Number" {...register(`dettagli.${index}.part_number`)} />
                        </div>
                        <textarea {...register(`dettagli.${index}.descrizione_lavoro`)} rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none" placeholder="Descrizione lavoro..." />
                    </div>
                  );
                })}
            </div>
        </div>

        <IOSCard className="mt-6">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Difetto Segnalato</h2>
          <textarea {...register("difetto_segnalato")} rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none" placeholder="Descrivi il difetto segnalato dal cliente..." />
        </IOSCard>

        <IOSCard className="mt-6 border-l-4 border-l-blue-600 shadow-md">
          <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center"><Receipt className="w-5 h-5 mr-2 text-blue-600" /> Condizioni & Costi</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
             <div className={contractLocked ? "opacity-60 pointer-events-none grayscale" : ""}>
               <Controller 
                 name="is_contratto" 
                 control={control} 
                 render={({ field }) => (
                   <IOSToggle 
                     label="Contratto" 
                     checked={field.value} 
                     onChange={(checked) => {
                       field.onChange(checked);
                       if (checked) {
                         setValue("flag_diritto_chiamata", false);
                       }
                     }} 
                   />
                 )} 
               />
             </div>
             <Controller name="is_garanzia" control={control} render={({ field }) => <IOSToggle label="Garanzia" checked={field.value} onChange={field.onChange} />} />
             <Controller name="is_chiamata" control={control} render={({ field }) => <IOSToggle label="Chiamata" checked={field.value} onChange={field.onChange} />} />
             <Controller name="is_sopralluogo" control={control} render={({ field }) => <IOSToggle label="Sopralluogo" checked={field.value} onChange={field.onChange} />} />
             {macroCategoria === "Printing & Office" && (
               <Controller 
                 name="is_prelievo_copie" 
                 control={control} 
                 render={({ field }) => (
                   <IOSToggle 
                     label="Prelievo Numero Copie" 
                     checked={field.value} 
                     onChange={(checked) => {
                       field.onChange(checked);
                       if (checked) {
                         // Reset letture quando si attiva
                         setLettureCopie({});
                         // Abilita automaticamente contratto e disabilita diritto di chiamata
                         setValue("is_contratto", true);
                         setValue("flag_diritto_chiamata", false);
                       }
                     }} 
                   />
                 )} 
               />
             )}
          </div>
          
          {/* Sezione Prelievo Copie (solo per Printing) */}
          {macroCategoria === "Printing & Office" && watch("is_prelievo_copie") && assetsNoleggioCliente.filter((a: any) => a.tipo_asset === "Printing").length > 0 && (
            <IOSCard className="mt-6 border-l-4 border-l-green-600">
              <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center">
                <Printer className="w-5 h-5 mr-2 text-green-600" /> Prelievo Numero Copie
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Inserisci i contatori attuali per tutte le macchine a noleggio. Le nuove letture devono essere maggiori o uguali alle precedenti e devono essere rispettata la cadenza configurata per ogni prodotto.
              </p>
              <div className="space-y-4">
                {assetsNoleggioCliente.filter((a: any) => a.tipo_asset === "Printing").map((asset: any) => {
                  const ultimaLettura = ultimeLetture[asset.id];
                  const letturaAttuale = lettureCopie[asset.id] || {contatore_bn: 0, contatore_colore: 0};
                  const dataUltima = ultimaLettura ? new Date(ultimaLettura.data) : null;
                  const giorniDaUltima = dataUltima ? Math.floor((new Date().getTime() - dataUltima.getTime()) / (1000 * 60 * 60 * 24)) : null;
                  
                  // Calcola giorni minimi in base alla cadenza configurata
                  const cadenza = asset.cadenza_letture_copie || 'trimestrale';
                  const giorniMinimi: {[key: string]: number} = {
                    'mensile': 30,
                    'bimestrale': 60,
                    'trimestrale': 90,
                    'semestrale': 180
                  };
                  const giorniMinimiRichiesti = giorniMinimi[cadenza] || 90;
                  const puoPrelievo = giorniDaUltima === null || giorniDaUltima >= giorniMinimiRichiesti;
                  
                  return (
                    <div key={asset.id} className="bg-white p-4 rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {asset.marca} {asset.modello}
                          </h3>
                          <p className="text-xs text-gray-500">Matricola: {asset.matricola || 'N/A'}</p>
                        </div>
                        {!puoPrelievo && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                            Minimo {cadenza === 'mensile' ? '1 mese' : cadenza === 'bimestrale' ? '2 mesi' : cadenza === 'trimestrale' ? '3 mesi' : '6 mesi'} dall'ultima lettura ({giorniMinimiRichiesti} giorni)
                          </span>
                        )}
                      </div>
                      
                      {ultimaLettura && (
                        <div className="text-xs text-gray-500 mb-3 bg-gray-50 p-2 rounded">
                          Ultima lettura: {dataUltima?.toLocaleDateString('it-IT')} ({giorniDaUltima} giorni fa)
                          <br />
                          B/N: {ultimaLettura.contatore_bn} | Colore: {ultimaLettura.contatore_colore || 0}
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                            Contatore B/N *
                          </label>
                          <input
                            type="number"
                            min={ultimaLettura?.contatore_bn || asset.contatore_iniziale_bn || 0}
                            value={letturaAttuale.contatore_bn || ''}
                            onChange={(e) => {
                              setLettureCopie({
                                ...lettureCopie,
                                [asset.id]: {
                                  ...letturaAttuale,
                                  contatore_bn: parseInt(e.target.value) || 0
                                }
                              });
                            }}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                            placeholder={ultimaLettura?.contatore_bn?.toString() || '0'}
                            disabled={!puoPrelievo}
                            required
                          />
                        </div>
                        {asset.is_colore && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                              Contatore Colore *
                            </label>
                            <input
                              type="number"
                              min={ultimaLettura?.contatore_colore || asset.contatore_iniziale_colore || 0}
                              value={letturaAttuale.contatore_colore || ''}
                              onChange={(e) => {
                                setLettureCopie({
                                  ...lettureCopie,
                                  [asset.id]: {
                                    ...letturaAttuale,
                                    contatore_colore: parseInt(e.target.value) || 0
                                  }
                                });
                              }}
                              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                              placeholder={ultimaLettura?.contatore_colore?.toString() || '0'}
                              disabled={!puoPrelievo}
                              required
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </IOSCard>
          )}
          
          {/* Orari */}
          <div className="bg-blue-50 p-4 rounded-xl mb-4 border border-blue-200/60">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Orari Intervento</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                  Ora Inizio *
                </label>
                <input 
                  type="time" 
                  {...register("ora_inizio", { required: "Ora inizio obbligatoria" })} 
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                  Ora Fine *
                </label>
                <input 
                  type="time" 
                  {...register("ora_fine", { required: "Ora fine obbligatoria" })} 
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl space-y-4 border border-gray-200/60">
            <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">Diritto di Chiamata</div>
                  <div className="text-xs text-gray-500">
                    {isContratto ? "Incluso nel contratto" : `Tariffa: € ${getCurrentPrice().toFixed(2)}`}
                  </div>
                </div>
                <Controller 
                  name="flag_diritto_chiamata" 
                  control={control} 
                  render={({ field }) => (
                    <div className={isContratto ? "opacity-50 pointer-events-none" : ""}>
                      <IOSToggle label="" checked={field.value} onChange={field.onChange} />
                    </div>
                  )} 
                />
            </div>
            <div className="border-t border-gray-200 pt-4 grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <input 
                    {...register("descrizione_extra")} 
                    placeholder="Costi Extra (Descrizione)" 
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" 
                  />
                </div>
                <div className="col-span-1">
                  <input 
                    type="number" 
                    step="0.01" 
                    {...register("costi_extra", {valueAsNumber: true})} 
                    placeholder="€ 0.00" 
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-right text-sm outline-none" 
                  />
                </div>
            </div>
          </div>
        </IOSCard>

        <IOSCard>
            <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-gray-900">Ricambi</h2>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setIsProductModalOpen(true)} className="text-[10px] font-bold bg-green-50 text-green-700 px-3 py-2 rounded-full flex items-center border border-green-200"><Search className="w-3 h-3 mr-1" /> MAGAZZINO</button>
                    <button type="button" onClick={() => appendRicambio({ descrizione: "", quantita: 1, prezzo_unitario: 0 })} className="text-[10px] font-bold bg-blue-50 text-blue-700 px-3 py-2 rounded-full flex items-center border border-blue-200"><Plus className="w-3 h-3 mr-1" /> MANUALE</button>
                </div>
            </div>
            
            {/* Intestazione descrittiva dei campi */}
            {ricambiFields.length > 0 && (
              <div className="grid grid-cols-12 gap-2 mb-2 px-1 text-xs font-semibold text-gray-600">
                <div className="col-span-6">Descrizione prodotto</div>
                <div className="col-span-2 text-center">Quantità</div>
                <div className="col-span-3 text-right">Prezzo unitario (€)</div>
                <div className="col-span-1"></div>
              </div>
            )}
            
            <div className="space-y-3">
                {ricambiFields.map((field, index) => {
                  const prezzoAttuale = watch(`ricambi.${index}.prezzo_unitario`) || 0;
                  
                  return (
                    <div key={field.id} className="flex gap-2 items-start">
                        <input 
                          {...register(`ricambi.${index}.descrizione`)} 
                          className="bg-white border p-2 rounded-lg w-full text-sm" 
                          placeholder="Inserisci descrizione prodotto" 
                        />
                        <input 
                          type="number" 
                          {...register(`ricambi.${index}.quantita`, {valueAsNumber: true})} 
                          className="bg-white border p-2 rounded-lg w-16 text-center text-sm" 
                          placeholder="Qt" 
                          min="1"
                        />
                        <div className="relative">
                          <input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            {...register(`ricambi.${index}.prezzo_unitario`, {
                              valueAsNumber: true
                            })} 
                            className="bg-white border p-2 rounded-lg w-24 text-right text-sm" 
                            placeholder="0.00" 
                          />
                        </div>
                        <button type="button" onClick={() => removeRicambio(index)} className="text-red-400 p-2 hover:text-red-600 transition-colors" title="Rimuovi prodotto"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  );
                })}
            </div>
            {ricambiFields.length > 0 && <div className="mt-5 pt-4 border-t text-right font-bold font-mono">Totale Materiale: € {totaleRicambi.toFixed(2)}</div>}
        </IOSCard>
      </main>
    </div>
  );
}