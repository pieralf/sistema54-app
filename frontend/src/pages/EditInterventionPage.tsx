import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, Printer, Monitor, Wrench, Receipt, Save, AlertCircle, Search, UserPlus, X, Package, PenTool, Home } from 'lucide-react';
import { IOSCard, IOSInput, IOSToggle } from '../components/ui/ios-elements';
import axios from 'axios';
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
  ora_inizio?: string;
  ora_fine?: string;
  costi_extra: number;
  descrizione_extra: string;
  difetto_segnalato?: string;
  ricambi: Ricambio[];
  firma_tecnico?: string;
  firma_cliente?: string;
  nome_cliente?: string;
  cognome_cliente?: string;
};

export default function EditInterventionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clienteMultisede, setClienteMultisede] = useState<any>(null);
  const [sediCliente, setSediCliente] = useState<any[]>([]);
  const [assetsNoleggioCliente, setAssetsNoleggioCliente] = useState<any[]>([]); // Assets a noleggio del cliente
  const [lettureCopie, setLettureCopie] = useState<{[key: number]: {contatore_bn: number, contatore_colore: number}}>({}); // Letture copie per ogni asset
  const [ultimeLetture, setUltimeLetture] = useState<{[key: number]: {data: string, contatore_bn: number, contatore_colore: number}}>({}); // Ultime letture per validazione
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [formDataTemp, setFormDataTemp] = useState<any>(null);
  const [contractLocked, setContractLocked] = useState(false);
  const [numeroRit, setNumeroRit] = useState<string>("");
  
  const sigCanvasTecnico = useRef<SignatureCanvas>(null);
  const sigCanvasCliente = useRef<SignatureCanvas>(null);

  const { register, control, handleSubmit, watch, setValue, reset } = useForm<FormValues>();

  const assetFields = useFieldArray({
    control,
    name: "dettagli"
  });

  const ricambiFields = useFieldArray({
    control,
    name: "ricambi"
  });

  const macroCategoria = watch("macro_categoria");
  const sedeIdSelezionata = watch("sede_id");
  
  // Aggiorna le macchine Printing quando cambia la sede selezionata
  useEffect(() => {
    const clienteId = watch("cliente_id");
    
    if (clienteId && clienteMultisede && clienteMultisede.has_noleggio && macroCategoria === "Printing & Office") {
      // Ricarica gli assets filtrati per sede
      const caricaAssetsPerSede = async () => {
        try {
          const clienteRes = await axios.get(`${getApiUrl()}/clienti/${clienteId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (clienteRes.data?.assets_noleggio) {
            let assetsPrinting = clienteRes.data.assets_noleggio.filter((a: any) => a.tipo_asset === "Printing");
            
            // Se è selezionata una sede, mostra SOLO le macchine assegnate a quella sede
            if (sedeIdSelezionata) {
              const sedeIdNum = parseInt(sedeIdSelezionata.toString());
              assetsPrinting = assetsPrinting.filter((a: any) => 
                a.sede_id === sedeIdNum
              );
            }
            
            setAssetsNoleggioCliente(assetsPrinting);
            
            // Ricarica anche le ultime letture
            const lettureMap: {[key: number]: {data: string, contatore_bn: number, contatore_colore: number}} = {};
            for (const asset of assetsPrinting) {
              try {
                const lettureRes = await axios.get(`${getApiUrl()}/letture-copie/asset/${asset.id}/ultima`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
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
  }, [sedeIdSelezionata, watch("cliente_id"), clienteMultisede, macroCategoria, token]);

  // Carica dati intervento esistente
  useEffect(() => {
    const loadIntervento = async () => {
      if (!token) {
        console.error("Token non disponibile");
        navigate("/login");
        return;
      }
      
      // Assicurati che il token sia nell'header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      try {
        const response = await axios.get(`${getApiUrl()}/interventi/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const intervento = response.data;
        
        // Salva il numero RIT per visualizzarlo nell'header
        if (intervento.numero_relazione) {
          setNumeroRit(intervento.numero_relazione);
        }
        
        // Carica sedi se cliente multisede
        if (intervento.cliente_id) {
          const clienteRes = await axios.get(`${getApiUrl()}/clienti/${intervento.cliente_id}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const cliente = clienteRes.data;
          if (cliente.has_multisede && cliente.sedi) {
            setClienteMultisede(cliente);
            setSediCliente(cliente.sedi);
          }
          if (cliente.has_contratto_assistenza) {
            setContractLocked(true);
          }
          // Carica assets a noleggio se il cliente ha contratto noleggio
          if (cliente.has_noleggio && cliente.assets_noleggio) {
            // Filtra per tipo Printing e per sede se selezionata
            const sedeIdSelezionata = intervento.sede_id;
            let assetsPrinting = cliente.assets_noleggio.filter((a: any) => a.tipo_asset === "Printing");
            
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
                const lettureRes = await axios.get(`${getApiUrl()}/letture-copie/asset/${asset.id}/ultima`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
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
        }

        // Prepara dati per il form
        const formData = {
          macro_categoria: intervento.macro_categoria,
          cliente_id: intervento.cliente_id,
          cliente_ragione_sociale: intervento.cliente_ragione_sociale,
          cliente_indirizzo: intervento.cliente_indirizzo,
          sede_id: intervento.sede_id || null,
          dettagli: intervento.dettagli && intervento.dettagli.length > 0 
            ? intervento.dettagli.map((d: any) => ({
                categoria_it: d.categoria_it || "Hardware",
                marca_modello: d.marca_modello || "",
                serial_number: d.serial_number || "",
                part_number: d.part_number || "",
                descrizione_lavoro: d.descrizione_lavoro || ""
              }))
            : [{ categoria_it: "Hardware", marca_modello: "", serial_number: "", part_number: "", descrizione_lavoro: "" }],
          is_contratto: intervento.is_contratto || false,
          is_garanzia: intervento.is_garanzia || false,
          is_chiamata: intervento.is_chiamata || false,
          is_sopralluogo: intervento.is_sopralluogo || false,
          is_prelievo_copie: intervento.is_prelievo_copie || false,
          flag_diritto_chiamata: intervento.flag_diritto_chiamata !== false,
          ora_inizio: intervento.ora_inizio || "",
          ora_fine: intervento.ora_fine || new Date().toTimeString().slice(0, 5),
          costi_extra: intervento.costi_extra || 0,
          descrizione_extra: intervento.descrizione_extra || "",
          difetto_segnalato: intervento.difetto_segnalato || "",
          ricambi: intervento.ricambi_utilizzati && intervento.ricambi_utilizzati.length > 0
            ? intervento.ricambi_utilizzati.map((r: any) => ({
                descrizione: r.descrizione || "",
                quantita: r.quantita || 1,
                prezzo_unitario: r.prezzo_unitario || 0,
                prodotto_id: r.prodotto_id || undefined
              }))
            : [],
          nome_cliente: intervento.nome_cliente || "",
          cognome_cliente: intervento.cognome_cliente || ""
        };

        reset(formData);
        setLoading(false);
      } catch (error: any) {
        console.error("Errore caricamento intervento:", error);
        if (error.response?.status === 401) {
          alert("Sessione scaduta. Effettua nuovamente il login.");
          navigate("/login");
        } else {
          alert("Errore nel caricamento del RIT: " + (error.response?.data?.detail || error.message));
          navigate("/admin?tab=interventi");
        }
      }
    };

    if (id && token) {
      loadIntervento();
    }
  }, [id, navigate, reset, token]);
  
  // Aggiorna le macchine Printing quando cambia la sede selezionata
  useEffect(() => {
    const clienteId = watch("cliente_id");
    
    if (clienteId && clienteMultisede && clienteMultisede.has_noleggio && macroCategoria === "Printing & Office") {
      // Ricarica gli assets filtrati per sede
      const caricaAssetsPerSede = async () => {
        try {
          const clienteRes = await axios.get(`${getApiUrl()}/clienti/${clienteId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (clienteRes.data?.assets_noleggio) {
            let assetsPrinting = clienteRes.data.assets_noleggio.filter((a: any) => a.tipo_asset === "Printing");
            
            // Se è selezionata una sede, mostra SOLO le macchine assegnate a quella sede
            if (sedeIdSelezionata) {
              const sedeIdNum = parseInt(sedeIdSelezionata.toString());
              assetsPrinting = assetsPrinting.filter((a: any) => 
                a.sede_id === sedeIdNum
              );
            }
            
            setAssetsNoleggioCliente(assetsPrinting);
            
            // Ricarica anche le ultime letture
            const lettureMap: {[key: number]: {data: string, contatore_bn: number, contatore_colore: number}} = {};
            for (const asset of assetsPrinting) {
              try {
                const lettureRes = await axios.get(`${getApiUrl()}/letture-copie/asset/${asset.id}/ultima`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
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
  }, [sedeIdSelezionata, watch("cliente_id"), clienteMultisede, macroCategoria, token]);

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

  const handleSignatureConfirm = async () => {
    if (!sigCanvasTecnico.current || !sigCanvasCliente.current) return;
    
    if (!token) {
      alert("Sessione scaduta. Effettua nuovamente il login.");
      navigate("/login");
      return;
    }

    const firmaTec = sigCanvasTecnico.current.toDataURL();
    const firmaCli = sigCanvasCliente.current.toDataURL();
    const nomeCliente = (document.getElementById('nome_cliente') as HTMLInputElement)?.value || "";
    const cognomeCliente = (document.getElementById('cognome_cliente') as HTMLInputElement)?.value || "";

    if (!firmaTec || !firmaCli) {
      alert("Entrambe le firme sono obbligatorie");
      return;
    }

    setIsSubmitting(true);
    
    // Assicurati che il token sia nell'header
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // Validazione prelievo copie: se è attivo, solo le macchine che possono fare il prelievo devono avere le copie inserite
    const formData = watch();
    const macroCategoria = formData.macro_categoria;
    if (formData.is_prelievo_copie && macroCategoria === "Printing & Office") {
      const assetsPrinting = assetsNoleggioCliente.filter((a: any) => a.tipo_asset === "Printing");
      
      // Filtra solo le macchine che possono fare il prelievo (escludi quelle bloccate)
      const macchineCheRichiedonoPrelievo = assetsPrinting.filter((asset: any) => puoPrelievoMacchina(asset));
      
      // Verifica quali macchine che richiedono prelievo non hanno le letture inserite
      const macchineSenzaLetture = macchineCheRichiedonoPrelievo.filter((asset: any) => {
        const lettura = lettureCopie[asset.id];
        return !lettura || lettura.contatore_bn === undefined || lettura.contatore_bn === null || (asset.is_colore && (lettura.contatore_colore === undefined || lettura.contatore_colore === null));
      });
      
      if (macchineSenzaLetture.length > 0) {
        setIsSubmitting(false);
        alert(`Devi inserire le letture copie per tutte le macchine a noleggio che richiedono il prelievo:\n${macchineSenzaLetture.map((a: any) => `${a.marca} ${a.modello}`).join('\n')}`);
        return;
      }
    }
    
    try {
      const formDataTemp = { ...formData };

      const dettagliPuliti = formDataTemp.dettagli.map((d: any) => ({
        ...d,
        marca_modello: d.marca_modello?.trim() || "-",
        descrizione_lavoro: d.descrizione_lavoro?.trim() || "-",
        serial_number: d.serial_number || "",
        // Part number - rimuovi il prefisso NOLEGGIO_ se presente prima di inviare
        part_number: d.part_number && d.part_number.startsWith('NOLEGGIO_') ? null : (d.part_number || null)
      }));

      const finalData = {
        ...formDataTemp,
        firma_tecnico: firmaTec,
        firma_cliente: firmaCli,
        nome_cliente: nomeCliente,
        cognome_cliente: cognomeCliente,
        dettagli: dettagliPuliti,
        costi_extra: Number(formDataTemp.costi_extra) || 0,
        cliente_id: Number(formDataTemp.cliente_id),
        sede_id: formDataTemp.sede_id ? Number(formDataTemp.sede_id) : null,
        ricambi: formDataTemp.ricambi ? formDataTemp.ricambi.map((r: any) => ({
          ...r,
          quantita: Number(r.quantita),
          prezzo_unitario: Number(r.prezzo_unitario)
        })) : []
      };

      const updateResponse = await axios.put(`${getApiUrl()}/interventi/${id}`, finalData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Aggiorna il numero RIT dalla risposta
      const updatedNumeroRit = updateResponse.data?.numero_relazione || numeroRit;
      if (updatedNumeroRit) {
        setNumeroRit(updatedNumeroRit);
      }
      
      // Salva letture copie se prelievo copie è attivo
      if (formDataTemp.is_prelievo_copie && macroCategoria === "Printing & Office") {
        const assetsPrinting = assetsNoleggioCliente.filter((a: any) => a.tipo_asset === "Printing");
        for (const asset of assetsPrinting) {
          const lettura = lettureCopie[asset.id];
          if (lettura && lettura.contatore_bn) {
            try {
              await axios.post(`${getApiUrl()}/letture-copie/`, {
                asset_id: asset.id,
                intervento_id: parseInt(id || '0'),
                data_lettura: new Date().toISOString(),
                contatore_bn: lettura.contatore_bn,
                contatore_colore: lettura.contatore_colore || 0
              }, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
            } catch (err: any) {
              console.error(`Errore salvataggio lettura per asset ${asset.id}:`, err);
              alert(`Errore nel salvare la lettura copie per ${asset.marca} ${asset.modello}: ${err.response?.data?.detail || err.message}`);
            }
          }
        }
      }
      
      // Scarica e apre il PDF con autenticazione
      let pdfOpened = false;
      try {
        // Prima recupera i dati dell'intervento per ottenere il numero_relazione aggiornato
        let numeroRitFinale = updatedNumeroRit;
        try {
          const interventoResponse = await axios.get(`${getApiUrl()}/interventi/${id}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (interventoResponse.data?.numero_relazione) {
            numeroRitFinale = interventoResponse.data.numero_relazione;
            setNumeroRit(numeroRitFinale);
          }
        } catch (e) {
          console.warn('Impossibile recuperare numero relazione aggiornato:', e);
        }

        const pdfResponse = await axios.get(`${getApiUrl()}/interventi/${id}/pdf`, {
          responseType: 'blob',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        // Verifica che il contenuto sia valido
        if (!pdfResponse.data || pdfResponse.data.size === 0) {
          alert('⚠️ Errore: Il PDF è vuoto o non valido.');
          navigate("/admin?tab=interventi");
          return;
        }
        
        // Usa sempre il numero RIT come nome file (più affidabile)
        const filename = numeroRitFinale ? `${numeroRitFinale}.pdf` : `RIT-${id}.pdf`;
        
        console.log('Nome file PDF:', filename);
        console.log('Numero RIT finale:', numeroRitFinale);
        
        // Crea un File object invece di Blob per preservare il nome
        const file = new File([pdfResponse.data], filename, { type: 'application/pdf' });
        const url = window.URL.createObjectURL(file);
        
        // Crea un link per il download con il nome corretto
        const link = document.createElement('a');
        link.href = url;
        link.download = filename; // Nome file corretto
        link.style.display = 'none';
        // Imposta anche l'attributo download esplicitamente
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        
        // Forza il download con il nome corretto
        // Usa un piccolo delay per assicurarsi che il link sia completamente nel DOM
        setTimeout(() => {
          link.click();
          pdfOpened = true;
          
          // Pulisci l'URL e rimuovi il link dopo un delay per permettere il download
          setTimeout(() => {
            try {
              window.URL.revokeObjectURL(url);
              if (document.body.contains(link)) {
                document.body.removeChild(link);
              }
            } catch (e) {
              console.warn('Errore pulizia URL:', e);
            }
          }, 2000);
        }, 50);
        
        if (pdfOpened) {
          alert(`✅ R.I.T. ${numeroRitFinale} AGGIORNATO!\nIl PDF si sta aprendo in un'altra scheda.`);
        }
      } catch (pdfError: any) {
        console.error("Errore apertura PDF:", pdfError);
        const errorMsg = pdfError.response?.data?.detail || pdfError.message || 'Errore sconosciuto';
        alert(`⚠️ R.I.T. ${updatedNumeroRit || 'aggiornato'}!\n\nErrore nell'apertura del PDF: ${errorMsg}\n\nPuoi scaricarlo dall'archivio interventi.`);
      }
      
      // Aspetta un po' prima di navigare per permettere l'apertura del PDF
      setTimeout(() => {
        navigate("/admin?tab=interventi");
      }, 2000);
    } catch (error: any) {
      console.error("ERRORE SALVATAGGIO:", error);
      if (error.response?.status === 401) {
        alert("Sessione scaduta. Effettua nuovamente il login.");
        navigate("/login");
      } else {
        alert("Errore durante l'aggiornamento: " + (error.response?.data?.detail || error.message));
      }
    } finally {
      setIsSubmitting(false);
      setIsSignatureModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
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
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Modifica RIT</h1>
        </div>
        {numeroRit && (
          <div className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
            {numeroRit}
          </div>
        )}
      </header>
      
      <form onSubmit={handleSubmit(() => setIsSignatureModalOpen(true))} className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Sezioni identiche a NewInterventionPage */}
        {/* Cliente, Dettagli, Difetto Segnalato, Condizioni & Costi, Ricambi */}
        {/* Per brevità, riuso la stessa struttura */}
        
        <IOSCard>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Cliente</h2>
          <div className="space-y-3">
            <IOSInput label="Ragione Sociale" value={watch("cliente_ragione_sociale")} disabled />
            <IOSInput label="Indirizzo" value={watch("cliente_indirizzo")} disabled />
            
            {clienteMultisede && sediCliente.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Sede Intervento</label>
                <select {...register("sede_id")} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm">
                  {!clienteMultisede?.sede_legale_operativa && (
                    <option value="">Sede Legale</option>
                  )}
                  {sediCliente.map((sede: any) => (
                    <option key={sede.id} value={sede.id}>{sede.nome_sede}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </IOSCard>

        <div>
          <div className="flex justify-between items-end mb-3 px-1">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Dettaglio Lavori</h2>
            <button type="button" onClick={() => assetFields.append({ categoria_it: "Hardware", marca_modello: "", serial_number: "", part_number: "", descrizione_lavoro: "" })} className="text-xs font-bold text-blue-600 bg-white px-3 py-1.5 rounded-full flex items-center border border-gray-200 shadow-sm"><Plus className="w-3 h-3 mr-1" /> AGGIUNGI</button>
          </div>
          <div className="space-y-4">
            {assetFields.fields.map((field, index) => {
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
                  <button type="button" onClick={() => assetFields.remove(index)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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
                              // Marca questo asset come a noleggio
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
                      <option value="Hardware">Hardware</option>
                      <option value="Software">Software</option>
                      <option value="Network">Network</option>
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

        <IOSCard>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Difetto Segnalato</h2>
          <textarea {...register("difetto_segnalato")} rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm outline-none" placeholder="Descrivi il difetto segnalato dal cliente..." />
        </IOSCard>

        <IOSCard className="border-l-4 border-l-blue-600 shadow-md">
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
                    disabled={contractLocked}
                  />
                )}
              />
            </div>
            <Controller name="is_garanzia" control={control} render={({ field }) => <IOSToggle label="Garanzia" checked={field.value} onChange={field.onChange} />} />
            <Controller name="is_chiamata" control={control} render={({ field }) => <IOSToggle label="Chiamata" checked={field.value} onChange={field.onChange} disabled={contractLocked && watch("is_contratto")} />} />
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
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <IOSInput label="Ora Inizio (HH:MM)" type="text" {...register("ora_inizio")} placeholder="09:00" />
            <IOSInput label="Ora Fine (HH:MM)" type="text" {...register("ora_fine")} placeholder="17:00" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <IOSInput label="Costi Extra (€)" type="number" step="0.01" {...register("costi_extra", { valueAsNumber: true })} />
            <IOSInput label="Descrizione Costi Extra" {...register("descrizione_extra")} />
          </div>
        </IOSCard>

        <IOSCard>
          <div className="flex justify-between items-end mb-3 px-1">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Ricambi Utilizzati</h2>
            <button type="button" onClick={() => ricambiFields.append({ descrizione: "", quantita: 1, prezzo_unitario: 0 })} className="text-xs font-bold text-blue-600 bg-white px-3 py-1.5 rounded-full flex items-center border border-gray-200 shadow-sm"><Plus className="w-3 h-3 mr-1" /> AGGIUNGI</button>
          </div>
          <div className="space-y-3">
            {ricambiFields.fields.map((field, index) => {
              // Verifica se ci sono asset a noleggio nei dettagli
              const dettagli = watch("dettagli") || [];
              const hasNoleggioAsset = dettagli.some((det: any) => {
                const partNumber = det.part_number || '';
                return partNumber.startsWith('NOLEGGIO_');
              });
              
              const prezzoAttuale = watch(`ricambi.${index}.prezzo_unitario`) || 0;
              
              return (
                <div key={field.id} className="bg-white p-4 rounded-xl border border-gray-200 flex gap-3 items-end">
                  <div className="flex-1"><IOSInput label="Descrizione" {...register(`ricambi.${index}.descrizione`)} /></div>
                  <div className="w-24"><IOSInput label="Q.tà" type="number" {...register(`ricambi.${index}.quantita`, { valueAsNumber: true })} /></div>
                  <div className="relative w-32">
                    <IOSInput 
                      label="Prezzo" 
                      type="number" 
                      step="0.01" 
                      {...register(`ricambi.${index}.prezzo_unitario`, {
                        valueAsNumber: true,
                        onChange: (e) => {
                          // Se c'è un asset a noleggio, forza il prezzo a 0
                          if (hasNoleggioAsset) {
                            setValue(`ricambi.${index}.prezzo_unitario`, 0);
                          }
                        }
                      })} 
                      className={hasNoleggioAsset ? 'bg-green-50 border-green-300' : ''}
                      disabled={hasNoleggioAsset}
                      value={hasNoleggioAsset ? 0 : prezzoAttuale}
                    />
                    {hasNoleggioAsset && (
                      <span className="absolute -top-5 right-0 text-[10px] text-green-600 font-semibold">NOLEGGIO</span>
                    )}
                  </div>
                  <button type="button" onClick={() => ricambiFields.remove(index)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        </IOSCard>

        <div className="flex gap-4">
          <button type="button" onClick={() => navigate("/admin?tab=interventi")} className="flex-1 px-6 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors">Annulla</button>
          <button type="submit" disabled={isSubmitting} className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
            {isSubmitting ? "Salvataggio..." : "Salva e Rifirma"}
          </button>
        </div>
      </form>

      {/* Modale Firma */}
      {isSignatureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold">Firme Digitali</h3>
              <button onClick={() => setIsSignatureModalOpen(false)} className="hover:bg-blue-700 p-1 rounded-full"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-2">Firma Tecnico</label>
                <div className="border-2 border-gray-300 rounded-lg">
                  <SignatureCanvas ref={sigCanvasTecnico} canvasProps={{ className: "w-full" }} />
                </div>
                <button type="button" onClick={() => sigCanvasTecnico.current?.clear()} className="mt-2 text-sm text-gray-600 hover:text-gray-800">Cancella</button>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Firma Cliente</label>
                <div className="border-2 border-gray-300 rounded-lg">
                  <SignatureCanvas ref={sigCanvasCliente} canvasProps={{ className: "w-full" }} />
                </div>
                <button type="button" onClick={() => sigCanvasCliente.current?.clear()} className="mt-2 text-sm text-gray-600 hover:text-gray-800">Cancella</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <IOSInput id="nome_cliente" label="Nome Cliente" defaultValue={watch("nome_cliente")} />
                <IOSInput id="cognome_cliente" label="Cognome Cliente" defaultValue={watch("cognome_cliente")} />
              </div>
              
              {/* Disclaimer Legale */}
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg">
                <p className="text-xs text-amber-800 leading-relaxed text-justify">
                  Il Cliente, apponendo la propria firma, dichiara di aver verificato l'intervento e di accettarlo senza riserve, riconoscendone l'esecuzione a regola d'arte e la congruità di tempi e materiali. Autorizza altresì il trattamento dei dati personali raccolti, inclusa l'acquisizione del tratto grafico della firma, esclusivamente per finalità amministrative, contabili e di gestione contrattuale, ai sensi del Regolamento UE 2016/679 (GDPR). La presente sottoscrizione ha piena validità legale.
                </p>
              </div>
              
              <div className="flex gap-4">
                <button type="button" onClick={() => setIsSignatureModalOpen(false)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold">Annulla</button>
                <button type="button" onClick={handleSignatureConfirm} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">Conferma e Salva</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

