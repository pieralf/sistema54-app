import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ChevronLeft, Save, Building2, UserPlus, AlertCircle, Plus, X, MapPin, Edit, Home, Package } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { IOSCard, IOSInput, IOSTextArea } from '../components/ui/ios-elements';
import { getApiUrl } from '../config/api';
import AddressAutocomplete from '../components/AddressAutocomplete';

type Sede = {
  id?: number; // ID opzionale per identificare le sedi esistenti
  nome_sede: string;
  indirizzo_completo: string;
  citta?: string;
  cap?: string;
  telefono?: string;
  email?: string;
};

export default function NuovoClientePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [sedi, setSedi] = useState<Sede[]>([]);
  const [showSedeForm, setShowSedeForm] = useState(false);
  const [editingSedeIndex, setEditingSedeIndex] = useState<number | null>(null);
  const [assetsNoleggio, setAssetsNoleggio] = useState<any[]>([]);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAssetIndex, setEditingAssetIndex] = useState<number | null>(null);
  // Stato per valori decimali durante la digitazione (permette valori parziali come "0,")
  const [decimalInputs, setDecimalInputs] = useState<{[key: string]: string}>({});
  // Stato per le letture copie degli assets Printing
  const [lettureCopieAssets, setLettureCopieAssets] = useState<{[key: number]: any[]}>({});
  const [newSede, setNewSede] = useState({ 
    nome_sede: '', 
    indirizzo_completo: '',
    citta: '',
    cap: '',
    telefono: '',
    email: ''
  });
  const isEdit = !!id;

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      ragione_sociale: '',
      indirizzo: '',
      numero_civico: '',
      citta: '',
      cap: '',
      p_iva: '',
      codice_fiscale: '',
      email_amministrazione: '',
      email_pec: '',
      is_pa: false,
      codice_sdi: '',
      has_contratto_assistenza: false,
      has_noleggio: false,
      has_multisede: false,
      sede_legale_operativa: false,
      data_inizio_contratto_assistenza: '',
      data_fine_contratto_assistenza: '',
      limite_chiamate_contratto: null,
      costo_chiamata_fuori_limite: null,
      chiamate_utilizzate_contratto: 0
    }
  });

  const isPa = watch('is_pa');
  const hasMultisede = watch('has_multisede');
  const hasNoleggio = watch('has_noleggio');
  const hasContrattoAssistenza = watch('has_contratto_assistenza');

  useEffect(() => {
    if (isEdit && id) {
      loadCliente();
    }
  }, [id, isEdit]);

  const loadCliente = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/clienti/${id}`);
      const cliente = res.data;
      if (cliente) {
        setValue('ragione_sociale', cliente.ragione_sociale || '');
        // Carica indirizzo e numero civico se presenti
        const indirizzoCompleto = cliente.indirizzo || '';
        // Se l'indirizzo contiene un numero civico alla fine, separalo
        const indirizzoMatch = indirizzoCompleto.match(/^(.+?),\s*(\d+[A-Za-z]?)$/);
        if (indirizzoMatch) {
          setValue('indirizzo', indirizzoMatch[1].trim());
          setValue('numero_civico', indirizzoMatch[2].trim());
        } else {
          setValue('indirizzo', indirizzoCompleto);
          setValue('numero_civico', '');
        }
        setValue('citta', cliente.citta || '');
        setValue('cap', cliente.cap || '');
        setValue('p_iva', cliente.p_iva || '');
        setValue('codice_fiscale', cliente.codice_fiscale || '');
        setValue('email_amministrazione', cliente.email_amministrazione || '');
        setValue('email_pec', cliente.email_pec || '');
        setValue('is_pa', cliente.is_pa || false);
        setValue('codice_sdi', cliente.codice_sdi || '');
        setValue('has_contratto_assistenza', cliente.has_contratto_assistenza || false);
        setValue('has_noleggio', cliente.has_noleggio || false);
        setValue('has_multisede', cliente.has_multisede || false);
        setValue('sede_legale_operativa', cliente.sede_legale_operativa || false);
        // Carica dettagli contratto assistenza
        if (cliente.data_inizio_contratto_assistenza) {
          setValue('data_inizio_contratto_assistenza', cliente.data_inizio_contratto_assistenza.split('T')[0]);
        }
        if (cliente.data_fine_contratto_assistenza) {
          setValue('data_fine_contratto_assistenza', cliente.data_fine_contratto_assistenza.split('T')[0]);
        }
        setValue('limite_chiamate_contratto', cliente.limite_chiamate_contratto || null);
        setValue('costo_chiamata_fuori_limite', cliente.costo_chiamata_fuori_limite || null);
        setValue('chiamate_utilizzate_contratto', cliente.chiamate_utilizzate_contratto || 0);
        // Carica sedi se multisede è abilitato
        if (cliente.has_multisede && cliente.sedi) {
          setSedi(cliente.sedi.map((s: any) => ({
            id: s.id, // Mantieni l'ID per identificare le sedi esistenti
            nome_sede: s.nome_sede,
            indirizzo_completo: s.indirizzo_completo,
            citta: s.citta || '',
            cap: s.cap || '',
            telefono: s.telefono || '',
            email: s.email || ''
          })));
        }
        // Carica assets noleggio se presenti e ricostruisci la configurazione copie
        if (cliente.has_noleggio && cliente.assets_noleggio) {
          const assetsWithConfig = cliente.assets_noleggio.map((asset: any) => {
            const assetWithConfig = { ...asset };
            
            // Formatta le date per i campi input (YYYY-MM-DD) se presenti
            if (asset.data_installazione) {
              try {
                const dateInstall = new Date(asset.data_installazione);
                if (!isNaN(dateInstall.getTime())) {
                  assetWithConfig.data_installazione = dateInstall.toISOString().split('T')[0];
                } else {
                  assetWithConfig.data_installazione = null;
                }
              } catch (e) {
                assetWithConfig.data_installazione = null;
              }
            } else {
              assetWithConfig.data_installazione = null;
            }
            
            if (asset.data_scadenza_noleggio) {
              try {
                const dateScadenza = new Date(asset.data_scadenza_noleggio);
                if (!isNaN(dateScadenza.getTime())) {
                  assetWithConfig.data_scadenza_noleggio = dateScadenza.toISOString().split('T')[0];
                } else {
                  assetWithConfig.data_scadenza_noleggio = null;
                }
              } catch (e) {
                assetWithConfig.data_scadenza_noleggio = null;
              }
            } else {
              assetWithConfig.data_scadenza_noleggio = null;
            }
            
            // Mantieni i contatori iniziali come sono (0 o valore numerico)
            // Non convertirli in null per mantenere i valori salvati
            // I campi input gestiranno la visualizzazione vuota se necessario
            
            // Ricostruisci tipo_configurazione_bn
            if (asset.copie_incluse_bn === null && asset.costo_copia_bn_non_incluse !== null) {
              assetWithConfig.tipo_configurazione_bn = 'non_incluse';
            } else if (asset.copie_incluse_bn !== null) {
              assetWithConfig.tipo_configurazione_bn = 'incluse';
            } else {
              // Default a 'incluse' se non è possibile determinare (per retrocompatibilità con vecchi dati)
              assetWithConfig.tipo_configurazione_bn = 'incluse';
            }
            // Ricostruisci tipo_configurazione_colore
            if (asset.copie_incluse_colore === null && asset.costo_copia_colore_non_incluse !== null) {
              assetWithConfig.tipo_configurazione_colore = 'non_incluse';
            } else if (asset.copie_incluse_colore !== null) {
              assetWithConfig.tipo_configurazione_colore = 'incluse';
            } else {
              // Default a 'incluse' se non è possibile determinare (per retrocompatibilità con vecchi dati)
              assetWithConfig.tipo_configurazione_colore = 'incluse';
            }
            return assetWithConfig;
          });
          setAssetsNoleggio(assetsWithConfig);
          
          // Carica le letture copie per gli assets Printing
          const assetsPrinting = assetsWithConfig.filter((a: any) => a.tipo_asset === 'Printing');
          if (assetsPrinting.length > 0) {
            const lettureMap: {[key: number]: any[]} = {};
            for (const asset of assetsPrinting) {
              try {
                const lettureRes = await axios.get(`${getApiUrl()}/letture-copie/asset/${asset.id}/all`);
                if (lettureRes.data && Array.isArray(lettureRes.data)) {
                  lettureMap[asset.id] = lettureRes.data;
                } else {
                  lettureMap[asset.id] = [];
                }
              } catch (err) {
                // Nessuna lettura trovata o errore
                lettureMap[asset.id] = [];
              }
            }
            setLettureCopieAssets(lettureMap);
          }
        }
      }
    } catch (err) {
      setError('Errore nel caricamento del cliente');
    }
  };

  const handleAddSede = () => {
    if (newSede.nome_sede.trim() && newSede.indirizzo_completo.trim()) {
      if (editingSedeIndex !== null) {
        // Modifica sede esistente
        const updatedSedi = [...sedi];
        updatedSedi[editingSedeIndex] = { ...updatedSedi[editingSedeIndex], ...newSede };
        setSedi(updatedSedi);
        setEditingSedeIndex(null);
      } else {
        // Aggiungi nuova sede
        setSedi([...sedi, { ...newSede }]);
      }
      setNewSede({ 
        nome_sede: '', 
        indirizzo_completo: '',
        citta: '',
        cap: '',
        telefono: '',
        email: ''
      });
      setShowSedeForm(false);
    }
  };

  const handleEditSede = (index: number) => {
    const sede = sedi[index];
    setNewSede({
      nome_sede: sede.nome_sede || '',
      indirizzo_completo: sede.indirizzo_completo || '',
      citta: sede.citta || '',
      cap: sede.cap || '',
      telefono: sede.telefono || '',
      email: sede.email || ''
    });
    setEditingSedeIndex(index);
    setShowSedeForm(true);
  };

  const handleRemoveSede = (index: number) => {
    setSedi(sedi.filter((_, i) => i !== index));
    if (editingSedeIndex === index) {
      setEditingSedeIndex(null);
      setShowSedeForm(false);
      setNewSede({ 
        nome_sede: '', 
        indirizzo_completo: '',
        citta: '',
        cap: '',
        telefono: '',
        email: ''
      });
    }
  };

  const handleCancelSedeForm = () => {
    setShowSedeForm(false);
    setEditingSedeIndex(null);
    setNewSede({ 
      nome_sede: '', 
      indirizzo_completo: '',
      citta: '',
      cap: '',
      telefono: '',
      email: ''
    });
  };

  // Gestione Assets Noleggio
  const [newAsset, setNewAsset] = useState<any>({
    tipo_asset: 'Printing',
    sede_id: null, // Sede di ubicazione del prodotto noleggio
    marca: '',
    modello: '',
    matricola: '',
    data_installazione: null,
    data_scadenza_noleggio: null,
    is_colore: false,
    tipo_formato: 'A4',
    cadenza_letture_copie: 'trimestrale', // mensile, bimestrale, trimestrale, semestrale
    contatore_iniziale_bn: null,
    contatore_iniziale_colore: null,
    tipo_configurazione_bn: 'incluse', // 'incluse', 'non_incluse'
    copie_incluse_bn: null,
    costo_copia_bn_fuori_limite: null,
    costo_copia_bn_non_incluse: null,
    tipo_configurazione_colore: 'incluse', // 'incluse', 'non_incluse'
    copie_incluse_colore: null,
    costo_copia_colore_fuori_limite: null,
    costo_copia_colore_non_incluse: null,
    codice_prodotto: '',
    seriale: '',
    descrizione: '',
    is_nuovo: true
  });

  const handleAddAsset = () => {
    if (newAsset.tipo_asset === 'Printing' && (!newAsset.marca || !newAsset.modello)) {
      alert('Inserisci marca e modello per le macchine Printing');
      return;
    }
    if (newAsset.tipo_asset === 'IT' && (!newAsset.descrizione || !newAsset.seriale)) {
      alert('Inserisci descrizione e seriale per i prodotti IT');
      return;
    }
    
    // Mappa la configurazione copie nel formato backend
    const assetToSave: any = { ...newAsset };
    
    // Configurazione B/N
    if (assetToSave.tipo_configurazione_bn === 'incluse') {
      assetToSave.costo_copia_bn_non_incluse = null;
    } else if (assetToSave.tipo_configurazione_bn === 'non_incluse') {
      assetToSave.copie_incluse_bn = null;
      assetToSave.costo_copia_bn_fuori_limite = null;
    }
    
    // Configurazione Colore
    if (assetToSave.tipo_configurazione_colore === 'incluse') {
      assetToSave.costo_copia_colore_non_incluse = null;
    } else if (assetToSave.tipo_configurazione_colore === 'non_incluse') {
      assetToSave.copie_incluse_colore = null;
      assetToSave.costo_copia_colore_fuori_limite = null;
    }
    
    // Rimuovi i campi temporanei tipo_configurazione
    delete assetToSave.tipo_configurazione_bn;
    delete assetToSave.tipo_configurazione_colore;
    
    if (editingAssetIndex !== null) {
      const updated = [...assetsNoleggio];
      updated[editingAssetIndex] = assetToSave;
      setAssetsNoleggio(updated);
      setEditingAssetIndex(null);
    } else {
      setAssetsNoleggio([...assetsNoleggio, assetToSave]);
    }
    
    // Reset form
    setNewAsset({
      tipo_asset: 'Printing',
      sede_id: null,
      marca: '',
      modello: '',
      matricola: '',
      data_installazione: null,
      data_scadenza_noleggio: null,
      is_colore: false,
      tipo_formato: 'A4',
      cadenza_letture_copie: 'trimestrale',
      contatore_iniziale_bn: null,
      contatore_iniziale_colore: null,
      tipo_configurazione_bn: 'incluse',
      copie_incluse_bn: null,
      costo_copia_bn_fuori_limite: null,
      costo_copia_bn_non_incluse: null,
      tipo_configurazione_colore: 'incluse',
      copie_incluse_colore: null,
      costo_copia_colore_fuori_limite: null,
      costo_copia_colore_non_incluse: null,
      codice_prodotto: '',
      seriale: '',
      descrizione: '',
      is_nuovo: true
    });
    setShowAssetForm(false);
    // Pulisci gli input decimali quando si chiude il form
    setDecimalInputs({});
  };

  const handleEditAsset = (index: number) => {
    const asset = assetsNoleggio[index];
    const assetWithConfig = { ...asset };
    
    // Formatta le date per i campi input (YYYY-MM-DD) se presenti
    if (asset.data_installazione) {
      try {
        const dateInstall = new Date(asset.data_installazione);
        if (!isNaN(dateInstall.getTime())) {
          assetWithConfig.data_installazione = dateInstall.toISOString().split('T')[0];
        } else {
          assetWithConfig.data_installazione = null;
        }
      } catch (e) {
        assetWithConfig.data_installazione = null;
      }
    } else {
      assetWithConfig.data_installazione = null;
    }
    
    if (asset.data_scadenza_noleggio) {
      try {
        const dateScadenza = new Date(asset.data_scadenza_noleggio);
        if (!isNaN(dateScadenza.getTime())) {
          assetWithConfig.data_scadenza_noleggio = dateScadenza.toISOString().split('T')[0];
        } else {
          assetWithConfig.data_scadenza_noleggio = null;
        }
      } catch (e) {
        assetWithConfig.data_scadenza_noleggio = null;
      }
    } else {
      assetWithConfig.data_scadenza_noleggio = null;
    }
    
    // Mantieni i contatori iniziali come sono (0 o valore numerico)
    // Non convertirli in null per mantenere i valori salvati
    
    // Ricostruisci tipo_configurazione_bn se non presente
    if (!assetWithConfig.tipo_configurazione_bn) {
      if (asset.copie_incluse_bn === null && asset.costo_copia_bn_non_incluse !== null) {
        assetWithConfig.tipo_configurazione_bn = 'non_incluse';
      } else if (asset.copie_incluse_bn !== null) {
        assetWithConfig.tipo_configurazione_bn = 'incluse';
      } else {
        // Default a 'incluse' se non è possibile determinare (per retrocompatibilità con vecchi dati)
        assetWithConfig.tipo_configurazione_bn = 'incluse';
      }
    }
    // Ricostruisci tipo_configurazione_colore se non presente
    if (!assetWithConfig.tipo_configurazione_colore) {
      if (asset.copie_incluse_colore === null && asset.costo_copia_colore_non_incluse !== null) {
        assetWithConfig.tipo_configurazione_colore = 'non_incluse';
      } else if (asset.copie_incluse_colore !== null) {
        assetWithConfig.tipo_configurazione_colore = 'incluse';
      } else {
        // Default a 'incluse' se non è possibile determinare (per retrocompatibilità con vecchi dati)
        assetWithConfig.tipo_configurazione_colore = 'incluse';
      }
    }
    setNewAsset(assetWithConfig);
    setEditingAssetIndex(index);
    setShowAssetForm(true);
  };

  const handleRemoveAsset = (index: number) => {
    setAssetsNoleggio(assetsNoleggio.filter((_, i) => i !== index));
    if (editingAssetIndex === index) {
      setEditingAssetIndex(null);
      setShowAssetForm(false);
    }
  };

  const handleCancelAssetForm = () => {
    setShowAssetForm(false);
    setEditingAssetIndex(null);
    setNewAsset({
      tipo_asset: 'Printing',
      sede_id: null,
      marca: '',
      modello: '',
      matricola: '',
      data_installazione: null,
      data_scadenza_noleggio: null,
      is_colore: false,
      tipo_formato: 'A4',
      cadenza_letture_copie: 'trimestrale',
      contatore_iniziale_bn: null,
      contatore_iniziale_colore: null,
      copie_incluse_bn: null,
      copie_incluse_colore: null,
      costo_copia_bn_fuori_limite: null,
      costo_copia_colore_fuori_limite: null,
      costo_copia_bn_non_incluse: null,
      costo_copia_colore_non_incluse: null,
      codice_prodotto: '',
      seriale: '',
      descrizione: '',
      is_nuovo: true
    });
  };

  // Funzione per salvare solo una sezione specifica
  const saveSection = async (section: 'anagrafica' | 'configurazioni' | 'contratto') => {
    if (!isEdit || !id) {
      alert('Funzione disponibile solo in modalità modifica');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // IMPORTANTE: Carica prima i dati attuali del cliente dal backend per garantire
      // che tutti i campi obbligatori siano presenti nel payload
      const clienteRes = await axios.get(`${getApiUrl()}/clienti/${id}`);
      const clienteAttuale = clienteRes.data;
      
      // Ottieni i valori attuali del form
      const formValues = watch();
      
      // Prepara gli assets rimuovendo i campi temporanei tipo_configurazione e convertendo le date
      const assetsToSend = watch('has_noleggio') ? assetsNoleggio.map((asset: any) => {
        const { tipo_configurazione_bn, tipo_configurazione_colore, ...assetClean } = asset;
        
        // Converti data_installazione in formato ISO se presente (e non vuota)
        if (assetClean.data_installazione && assetClean.data_installazione.trim && assetClean.data_installazione.trim() !== '') {
          try {
            assetClean.data_installazione = new Date(assetClean.data_installazione).toISOString();
          } catch (e) {
            assetClean.data_installazione = null;
          }
        } else if (assetClean.data_installazione && typeof assetClean.data_installazione === 'string' && assetClean.data_installazione !== '') {
          try {
            assetClean.data_installazione = new Date(assetClean.data_installazione).toISOString();
          } catch (e) {
            assetClean.data_installazione = null;
          }
        } else {
          assetClean.data_installazione = null;
        }
        
        // Converti data_scadenza_noleggio in formato ISO se presente (e non vuota)
        if (assetClean.data_scadenza_noleggio && assetClean.data_scadenza_noleggio.trim && assetClean.data_scadenza_noleggio.trim() !== '') {
          try {
            assetClean.data_scadenza_noleggio = new Date(assetClean.data_scadenza_noleggio).toISOString();
          } catch (e) {
            assetClean.data_scadenza_noleggio = null;
          }
        } else if (assetClean.data_scadenza_noleggio && typeof assetClean.data_scadenza_noleggio === 'string' && assetClean.data_scadenza_noleggio !== '') {
          try {
            assetClean.data_scadenza_noleggio = new Date(assetClean.data_scadenza_noleggio).toISOString();
          } catch (e) {
            assetClean.data_scadenza_noleggio = null;
          }
        } else {
          assetClean.data_scadenza_noleggio = null;
        }
        
        // Assicurati che i contatori iniziali siano 0 se null (per il backend)
        if (assetClean.contatore_iniziale_bn === null || assetClean.contatore_iniziale_bn === undefined) {
          assetClean.contatore_iniziale_bn = 0;
        }
        if (assetClean.contatore_iniziale_colore === null || assetClean.contatore_iniziale_colore === undefined) {
          assetClean.contatore_iniziale_colore = 0;
        }
        
        // Assicurati che sede_id sia null se non valido (non può essere 0)
        if (assetClean.sede_id === 0 || assetClean.sede_id === '0' || assetClean.sede_id === '') {
          assetClean.sede_id = null;
        }
        
        return assetClean;
      }) : [];
      
      // Combina indirizzo e numero civico
      const indirizzoCompleto = formValues.numero_civico 
        ? `${formValues.indirizzo || ''}, ${formValues.numero_civico}`.trim()
        : (formValues.indirizzo || '');
      
      // Costruisci il payload partendo dai dati attuali del cliente e sovrascrivendo solo i campi modificati
      // Questo garantisce che tutti i campi obbligatori siano presenti
      // IMPORTANTE: Usa sempre i valori dal form (formValues) per i campi anagrafici per preservare le modifiche non salvate
      let payload: any = {
        // Campi obbligatori sempre presenti (dal form per preservare modifiche non salvate, altrimenti dal cliente attuale)
        ragione_sociale: formValues.ragione_sociale || clienteAttuale.ragione_sociale || '',
        indirizzo: indirizzoCompleto || clienteAttuale.indirizzo || '',
        citta: formValues.citta || clienteAttuale.citta || '',
        cap: formValues.cap || clienteAttuale.cap || '',
        p_iva: formValues.p_iva || clienteAttuale.p_iva || '',
        codice_fiscale: formValues.codice_fiscale || clienteAttuale.codice_fiscale || '',
        // IMPORTANTE: Usa sempre email_amministrazione dal form per preservare le modifiche fatte nella sezione anagrafica
        email_amministrazione: formValues.email_amministrazione !== undefined ? formValues.email_amministrazione : (clienteAttuale.email_amministrazione || ''),
        email_pec: formValues.email_pec !== undefined ? formValues.email_pec : (clienteAttuale.email_pec || ''),
        // Campi configurazione (sovrascritti se modificati)
        is_pa: Boolean(formValues.is_pa !== undefined ? formValues.is_pa : clienteAttuale.is_pa),
        codice_sdi: formValues.codice_sdi !== undefined ? formValues.codice_sdi : (clienteAttuale.codice_sdi || ''),
        has_contratto_assistenza: Boolean(formValues.has_contratto_assistenza !== undefined ? formValues.has_contratto_assistenza : clienteAttuale.has_contratto_assistenza),
        has_noleggio: Boolean(formValues.has_noleggio !== undefined ? formValues.has_noleggio : clienteAttuale.has_noleggio),
        has_multisede: Boolean(formValues.has_multisede !== undefined ? formValues.has_multisede : clienteAttuale.has_multisede),
        sede_legale_operativa: Boolean(formValues.sede_legale_operativa !== undefined ? formValues.sede_legale_operativa : clienteAttuale.sede_legale_operativa),
        // Sedi e assets sempre inclusi (potrebbero essere modificati)
        sedi: hasMultisede ? sedi : (clienteAttuale.sedi || []),
        assets_noleggio: assetsToSend.length > 0 ? assetsToSend : (clienteAttuale.assets_noleggio || [])
      };
      
      // Sovrascrivi solo i campi specifici della sezione da salvare
      if (section === 'anagrafica') {
        // Aggiorna solo i dati anagrafici
        payload.ragione_sociale = formValues.ragione_sociale || '';
        payload.indirizzo = indirizzoCompleto;
        payload.citta = formValues.citta || '';
        payload.cap = formValues.cap || '';
        payload.p_iva = formValues.p_iva || '';
        payload.codice_fiscale = formValues.codice_fiscale || '';
        payload.email_amministrazione = formValues.email_amministrazione || '';
        payload.email_pec = formValues.email_pec || '';
        payload.is_pa = Boolean(formValues.is_pa);
        payload.codice_sdi = formValues.codice_sdi || '';
        payload.sedi = hasMultisede ? sedi : [];
        payload.assets_noleggio = assetsToSend;
      } else if (section === 'configurazioni') {
        // Aggiorna solo le configurazioni (mantieni i dati anagrafici esistenti dal form)
        // IMPORTANTE: Mantieni email_amministrazione e email_pec dal form per preservare le modifiche fatte nella sezione anagrafica
        payload.email_amministrazione = formValues.email_amministrazione !== undefined ? formValues.email_amministrazione : (clienteAttuale.email_amministrazione || '');
        payload.email_pec = formValues.email_pec !== undefined ? formValues.email_pec : (clienteAttuale.email_pec || '');
        payload.is_pa = Boolean(formValues.is_pa);
        payload.codice_sdi = formValues.codice_sdi || '';
        payload.has_contratto_assistenza = Boolean(formValues.has_contratto_assistenza);
        payload.has_noleggio = Boolean(formValues.has_noleggio);
        payload.has_multisede = Boolean(formValues.has_multisede);
        payload.sede_legale_operativa = Boolean(formValues.sede_legale_operativa);
        payload.sedi = hasMultisede ? sedi : [];
        payload.assets_noleggio = assetsToSend;
      } else if (section === 'contratto') {
        // Aggiorna solo i dettagli contratto assistenza (mantieni tutto il resto)
        payload.has_contratto_assistenza = Boolean(formValues.has_contratto_assistenza);
        payload.data_inizio_contratto_assistenza = formValues.data_inizio_contratto_assistenza || null;
        payload.data_fine_contratto_assistenza = formValues.data_fine_contratto_assistenza || null;
        payload.limite_chiamate_contratto = formValues.limite_chiamate_contratto || null;
        payload.costo_chiamata_fuori_limite = formValues.costo_chiamata_fuori_limite || null;
      }
      
      console.log(`[Salvataggio sezione ${section}] Payload:`, JSON.stringify(payload, null, 2));

      await axios.put(`${getApiUrl()}/clienti/${id}`, payload);
      alert(`Sezione "${section === 'anagrafica' ? 'Dati Anagrafici' : section === 'configurazioni' ? 'Configurazioni' : 'Contratto Assistenza'}" salvata con successo!`);
      
      // NON ricaricare i dati per evitare loop - i valori del form sono già aggiornati
      // Se necessario, aggiorna solo i valori specifici della sezione salvata
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Errore durante il salvataggio';
      setError(msg);
      console.error('Errore salvataggio sezione:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = async (data: any) => {
    setIsSaving(true);
    setError('');

    try {
      // Prepara gli assets rimuovendo i campi temporanei tipo_configurazione e convertendo le date
      const assetsToSend = watch('has_noleggio') ? assetsNoleggio.map((asset: any) => {
        const { tipo_configurazione_bn, tipo_configurazione_colore, ...assetClean } = asset;
        
        // Converti data_installazione in formato ISO se presente (e non vuota)
        if (assetClean.data_installazione && assetClean.data_installazione.trim && assetClean.data_installazione.trim() !== '') {
          try {
            assetClean.data_installazione = new Date(assetClean.data_installazione).toISOString();
          } catch (e) {
            assetClean.data_installazione = null;
          }
        } else if (assetClean.data_installazione && typeof assetClean.data_installazione === 'string' && assetClean.data_installazione !== '') {
          try {
            assetClean.data_installazione = new Date(assetClean.data_installazione).toISOString();
          } catch (e) {
            assetClean.data_installazione = null;
          }
        } else {
          assetClean.data_installazione = null;
        }
        
        // Converti data_scadenza_noleggio in formato ISO se presente (e non vuota)
        if (assetClean.data_scadenza_noleggio && assetClean.data_scadenza_noleggio.trim && assetClean.data_scadenza_noleggio.trim() !== '') {
          try {
            assetClean.data_scadenza_noleggio = new Date(assetClean.data_scadenza_noleggio).toISOString();
          } catch (e) {
            assetClean.data_scadenza_noleggio = null;
          }
        } else if (assetClean.data_scadenza_noleggio && typeof assetClean.data_scadenza_noleggio === 'string' && assetClean.data_scadenza_noleggio !== '') {
          try {
            assetClean.data_scadenza_noleggio = new Date(assetClean.data_scadenza_noleggio).toISOString();
          } catch (e) {
            assetClean.data_scadenza_noleggio = null;
          }
        } else {
          assetClean.data_scadenza_noleggio = null;
        }
        
        // Assicurati che i contatori iniziali siano 0 se null (per il backend)
        if (assetClean.contatore_iniziale_bn === null || assetClean.contatore_iniziale_bn === undefined) {
          assetClean.contatore_iniziale_bn = 0;
        }
        if (assetClean.contatore_iniziale_colore === null || assetClean.contatore_iniziale_colore === undefined) {
          assetClean.contatore_iniziale_colore = 0;
        }
        
        // Assicurati che sede_id sia null se non valido (non può essere 0)
        if (assetClean.sede_id === 0 || assetClean.sede_id === '0' || assetClean.sede_id === '') {
          assetClean.sede_id = null;
        }
        
        return assetClean;
      }) : [];
      
      // Combina indirizzo e numero civico
      const indirizzoCompleto = data.numero_civico 
        ? `${data.indirizzo || ''}, ${data.numero_civico}`.trim()
        : (data.indirizzo || '');
      
      const payload = {
        ...data,
        indirizzo: indirizzoCompleto,
        citta: data.citta || '',
        cap: data.cap || '',
        is_pa: Boolean(data.is_pa), // Assicurati che sia sempre un booleano
        codice_sdi: data.codice_sdi || '',
        sedi: hasMultisede ? sedi : [],
        assets_noleggio: assetsToSend,
        // Converti le date per il contratto assistenza
        data_inizio_contratto_assistenza: data.data_inizio_contratto_assistenza || null,
        data_fine_contratto_assistenza: data.data_fine_contratto_assistenza || null,
        limite_chiamate_contratto: data.limite_chiamate_contratto || null,
        costo_chiamata_fuori_limite: data.costo_chiamata_fuori_limite || null
      };
      
      console.log('Payload inviato:', JSON.stringify(payload, null, 2));
      console.log('is_pa nel payload:', payload.is_pa, typeof payload.is_pa);
      console.log('codice_sdi nel payload:', payload.codice_sdi);
      console.log('Assets noleggio:', assetsToSend);

      if (isEdit) {
        await axios.put(`${getApiUrl()}/clienti/${id}`, payload);
        alert('Cliente aggiornato con successo!');
      } else {
        await axios.post(`${getApiUrl()}/clienti/`, payload);
        alert('Cliente creato con successo!');
      }
      navigate('/clienti');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Errore durante il salvataggio';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3">
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
          <h1 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Modifica Cliente' : 'Nuovo Cliente'}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <IOSCard>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900">Dati Anagrafici</h2>
              </div>
              {isEdit && (
                <button
                  type="button"
                  onClick={() => saveSection('anagrafica')}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Salva
                </button>
              )}
            </div>

            <IOSInput
              label="Ragione Sociale *"
              {...register('ragione_sociale', { required: 'Campo obbligatorio' })}
            />
            {errors.ragione_sociale && (
              <p className="text-red-500 text-xs mt-1 ml-1">{String(errors.ragione_sociale.message)}</p>
            )}

            <div>
              <AddressAutocomplete
                value={watch('indirizzo') || ''}
                onChange={(value) => {
                  setValue('indirizzo', value);
                }}
                onSelect={(address) => {
                  setValue('indirizzo', address.indirizzo);
                  setValue('citta', address.citta || '');
                  setValue('cap', address.cap || '');
                }}
                label="Via/Strada"
                placeholder="Inizia a digitare l'indirizzo (es: Via Roma, Milano)..."
              />
              <div className="mt-3">
                <IOSInput
                  label="Numero Civico"
                  {...register('numero_civico')}
                  placeholder="Es: 15, 15/A"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <IOSInput label="Città" {...register('citta')} />
              <IOSInput label="CAP" {...register('cap')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <IOSInput label="P.IVA" {...register('p_iva')} />
              <IOSInput label="Codice Fiscale" {...register('codice_fiscale')} />
            </div>

            <IOSInput
              label="Email Amministrazione"
              type="email"
              {...register('email_amministrazione')}
            />
          </IOSCard>

          <IOSCard>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-bold text-gray-900">Configurazioni</h2>
              </div>
              {isEdit && (
                <button
                  type="button"
                  onClick={() => saveSection('configurazioni')}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Salva
                </button>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
              <label className="flex items-center gap-2 font-semibold text-sm mb-2 text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('is_pa')}
                  className="w-4 h-4 rounded text-blue-600"
                />
                È Pubblica Amministrazione
              </label>
              {isPa && (
                <div className="grid grid-cols-2 gap-3 mt-3 animate-in fade-in">
                  <IOSInput label="Codice SDI" {...register('codice_sdi')} />
                  <IOSInput label="PEC" type="email" {...register('email_pec')} />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2 font-semibold text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('has_contratto_assistenza')}
                  className="w-4 h-4 rounded text-blue-600"
                />
                Ha Contratto di Assistenza
              </label>
              <label className="flex items-center gap-2 font-semibold text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('has_noleggio')}
                  className="w-4 h-4 rounded text-blue-600"
                />
                Ha Contratto di Noleggio
              </label>
              <label className="flex items-center gap-2 font-semibold text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('has_multisede')}
                  className="w-4 h-4 rounded text-blue-600"
                />
                Cliente Multisede
              </label>
              
              <label className="flex items-center gap-2 font-semibold text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('sede_legale_operativa')}
                  className="w-4 h-4 rounded text-blue-600"
                />
                Sede Legale/Centrale come Sede Operativa (appare nella lista sedi per interventi)
              </label>
            </div>
          </IOSCard>

          {hasContrattoAssistenza && (
            <IOSCard className="mt-6 border-l-4 border-l-green-600 shadow-md">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <Package className="w-5 h-5 mr-2 text-green-600" />
                  Dettagli Contratto di Assistenza
                </h2>
                {isEdit && (
                  <button
                    type="button"
                    onClick={() => saveSection('contratto')}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    Salva
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <IOSInput
                  label="Data Inizio Contratto"
                  type="date"
                  {...register('data_inizio_contratto_assistenza')}
                />
                <IOSInput
                  label="Data Fine Contratto"
                  type="date"
                  {...register('data_fine_contratto_assistenza')}
                />
                <IOSInput
                  label="Limite Chiamate Incluse"
                  type="number"
                  {...register('limite_chiamate_contratto', { valueAsNumber: true })}
                  placeholder="Es: 10 (lascia vuoto per illimitato)"
                />
                <IOSInput
                  label="Costo Chiamata Fuori Limite (€)"
                  type="number"
                  step="0.01"
                  {...register('costo_chiamata_fuori_limite', { valueAsNumber: true })}
                  placeholder="Es: 50.00"
                />
              </div>
              {isEdit && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-700">
                    <strong>Chiamate Utilizzate:</strong> {watch('chiamate_utilizzate_contratto') || 0}
                    {watch('limite_chiamate_contratto') && (
                      <span className="ml-2">
                        / {watch('limite_chiamate_contratto')} 
                        ({watch('limite_chiamate_contratto') - (watch('chiamate_utilizzate_contratto') || 0)} rimanenti)
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <strong>Info:</strong> Il contatore delle chiamate utilizzate viene aggiornato automaticamente quando viene creato un RIT con contratto. Se il limite viene superato, verrà applicato il costo fuori limite.
              </div>
            </IOSCard>
          )}

          {hasMultisede && (
            <IOSCard>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-green-600" />
                  <h2 className="text-lg font-bold text-gray-900">Sedi</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (showSedeForm && editingSedeIndex === null) {
                      handleCancelSedeForm();
                    } else {
                      setShowSedeForm(true);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  {editingSedeIndex !== null ? 'Annulla Modifica' : 'Aggiungi Sede'}
                </button>
              </div>

              {showSedeForm && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4 space-y-3">
                  <IOSInput
                    label="Nome Sede *"
                    value={newSede.nome_sede}
                    onChange={(e) => setNewSede({ ...newSede, nome_sede: e.target.value })}
                    placeholder="Es: Sede Uffici Salerno"
                  />
                  <AddressAutocomplete
                    value={newSede.indirizzo_completo}
                    onChange={(value) => {
                      setNewSede({ ...newSede, indirizzo_completo: value });
                    }}
                    onSelect={(address) => {
                      setNewSede({
                        ...newSede,
                        indirizzo_completo: address.indirizzo,
                        citta: address.citta || newSede.citta,
                        cap: address.cap || newSede.cap
                      });
                    }}
                    label="Indirizzo Completo *"
                    placeholder="Inizia a digitare l'indirizzo (es: Via Roma, Milano)..."
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <IOSInput
                      label="Città"
                      value={newSede.citta}
                      onChange={(e) => setNewSede({ ...newSede, citta: e.target.value })}
                      placeholder="Città"
                    />
                    <IOSInput
                      label="CAP"
                      value={newSede.cap}
                      onChange={(e) => setNewSede({ ...newSede, cap: e.target.value })}
                      placeholder="CAP"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <IOSInput
                      label="Telefono"
                      value={newSede.telefono}
                      onChange={(e) => setNewSede({ ...newSede, telefono: e.target.value })}
                      placeholder="Telefono"
                    />
                    <IOSInput
                      label="Email"
                      type="email"
                      value={newSede.email}
                      onChange={(e) => setNewSede({ ...newSede, email: e.target.value })}
                      placeholder="Email"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddSede}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold text-sm"
                    >
                      {editingSedeIndex !== null ? 'Salva Modifiche' : 'Aggiungi'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelSedeForm}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold text-sm"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}

              {sedi.length > 0 && (
                <div className="space-y-2">
                  {sedi.map((sede, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-xl border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{sede.nome_sede}</div>
                        <div className="text-sm text-gray-600 mt-1">{sede.indirizzo_completo}</div>
                        {(sede.citta || sede.cap) && (
                          <div className="text-xs text-gray-500 mt-1">
                            {sede.citta}{sede.citta && sede.cap ? ', ' : ''}{sede.cap}
                          </div>
                        )}
                        {(sede.telefono || sede.email) && (
                          <div className="text-xs text-gray-500 mt-1">
                            {sede.telefono}{sede.telefono && sede.email ? ' • ' : ''}{sede.email}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditSede(index)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Modifica sede"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveSede(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Rimuovi sede"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sedi.length === 0 && !showSedeForm && (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nessuna sede aggiunta. Clicca su "Aggiungi Sede" per inserirne una.
                </p>
              )}
            </IOSCard>
          )}

          {hasNoleggio && (
            <IOSCard>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-orange-600" />
                  <h2 className="text-lg font-bold text-gray-900">Macchine Noleggiate</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (showAssetForm && editingAssetIndex === null) {
                      handleCancelAssetForm();
                    } else {
                      setShowAssetForm(true);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  {editingAssetIndex !== null ? 'Annulla Modifica' : 'Aggiungi Macchina'}
                </button>
              </div>

              {showAssetForm && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                      Tipo Macchina *
                    </label>
                    <select
                      value={newAsset.tipo_asset}
                      onChange={(e) => setNewAsset({ ...newAsset, tipo_asset: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                    >
                      <option value="Printing">Printing (Stampanti/Fotocopiatrici)</option>
                      <option value="IT">IT (PC/Tablet)</option>
                    </select>
                  </div>

                  {newAsset.tipo_asset === 'Printing' ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <IOSInput
                          label="Marca *"
                          value={newAsset.marca}
                          onChange={(e) => setNewAsset({ ...newAsset, marca: e.target.value })}
                          placeholder="Es: HP, Canon"
                        />
                        <IOSInput
                          label="Modello *"
                          value={newAsset.modello}
                          onChange={(e) => setNewAsset({ ...newAsset, modello: e.target.value })}
                          placeholder="Es: LaserJet Pro"
                        />
                      </div>
                      <IOSInput
                        label="Matricola"
                        value={newAsset.matricola}
                        onChange={(e) => setNewAsset({ ...newAsset, matricola: e.target.value })}
                        placeholder="Numero di matricola"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <IOSInput
                          label="Data Installazione"
                          type="date"
                          value={newAsset.data_installazione || ''}
                          onChange={(e) => setNewAsset({ ...newAsset, data_installazione: e.target.value || null })}
                        />
                        <IOSInput
                          label="Scadenza Noleggio *"
                          type="date"
                          value={newAsset.data_scadenza_noleggio || ''}
                          onChange={(e) => setNewAsset({ ...newAsset, data_scadenza_noleggio: e.target.value || null })}
                        />
                      </div>
                      {watch('has_multisede') && sedi.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                            Sede di Ubicazione
                          </label>
                          <select
                            value={newAsset.sede_id || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewAsset({ ...newAsset, sede_id: val === '' || val === '0' ? null : parseInt(val) });
                            }}
                            className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                          >
                            <option value="">Sede Principale (Legale)</option>
                            {sedi.map((sede, idx) => (
                              <option key={sede.id || idx} value={sede.id || idx}>
                                {sede.nome_sede} - {sede.indirizzo_completo}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1 ml-1">
                            Seleziona la sede dove è ubicato il prodotto noleggio. Gli avvisi di scadenza verranno inviati anche alla sede selezionata.
                          </p>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                          Tipologia Formato *
                        </label>
                        <select
                          value={newAsset.tipo_formato || 'A4'}
                          onChange={(e) => setNewAsset({ ...newAsset, tipo_formato: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                        >
                          <option value="A4">A4</option>
                          <option value="A3">A3</option>
                          <option value="A0">A0</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                          Cadenza Letture Copie *
                        </label>
                        <select
                          value={newAsset.cadenza_letture_copie || 'trimestrale'}
                          onChange={(e) => setNewAsset({ ...newAsset, cadenza_letture_copie: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                        >
                          <option value="mensile">Mensile (30 giorni)</option>
                          <option value="bimestrale">Bimestrale (60 giorni)</option>
                          <option value="trimestrale">Trimestrale (90 giorni)</option>
                          <option value="semestrale">Semestrale (180 giorni)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1 ml-1">
                          Frequenza con cui devono essere effettuate le letture copie per questo prodotto.
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <label className="flex items-center gap-2 font-semibold text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newAsset.is_colore}
                            onChange={(e) => setNewAsset({ ...newAsset, is_colore: e.target.checked })}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          Macchina a Colori
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <IOSInput
                          label="Contatore Iniziale B/N"
                          type="number"
                          value={newAsset.contatore_iniziale_bn !== null && newAsset.contatore_iniziale_bn !== undefined ? String(newAsset.contatore_iniziale_bn) : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewAsset({ ...newAsset, contatore_iniziale_bn: val === '' ? null : (isNaN(parseInt(val)) ? null : parseInt(val)) });
                          }}
                          placeholder=""
                        />
                        <IOSInput
                          label="Contatore Iniziale Colore"
                          type="number"
                          value={newAsset.contatore_iniziale_colore !== null && newAsset.contatore_iniziale_colore !== undefined ? String(newAsset.contatore_iniziale_colore) : ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewAsset({ ...newAsset, contatore_iniziale_colore: val === '' ? null : (isNaN(parseInt(val)) ? null : parseInt(val)) });
                          }}
                          disabled={!newAsset.is_colore}
                          placeholder=""
                        />
                      </div>
                      <div className="border-t border-gray-200 pt-3 mt-3">
                        <h4 className="font-semibold text-sm text-gray-700 mb-3">Configurazione Copie B/N</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                              Tipo Configurazione *
                            </label>
                            <select
                              value={newAsset.tipo_configurazione_bn || 'incluse'}
                              onChange={(e) => {
                                const tipo = e.target.value;
                                setNewAsset({
                                  ...newAsset,
                                  tipo_configurazione_bn: tipo,
                                  copie_incluse_bn: tipo === 'incluse' ? newAsset.copie_incluse_bn : null,
                                  costo_copia_bn_fuori_limite: tipo === 'incluse' ? newAsset.costo_copia_bn_fuori_limite : null,
                                  costo_copia_bn_non_incluse: tipo === 'non_incluse' ? newAsset.costo_copia_bn_non_incluse : null
                                });
                              }}
                              className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                            >
                              <option value="incluse">Copie Incluse</option>
                              <option value="non_incluse">Copie Non Incluse</option>
                            </select>
                          </div>
                          {newAsset.tipo_configurazione_bn === 'incluse' && (
                            <>
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                                  COPIE INCLUSE MENSILI *
                                </label>
                                <input
                                  type="number"
                                  value={newAsset.copie_incluse_bn || ''}
                                  onChange={(e) => setNewAsset({ ...newAsset, copie_incluse_bn: e.target.value ? parseInt(e.target.value) : null })}
                                  className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                                  placeholder="Es: 1000"
                                />
                                <p className="text-xs text-gray-500 mt-1 ml-1">
                                  Numero di copie incluse mensilmente. Al prelievo verranno moltiplicate per il periodo (es. trimestrale = 3 mesi).
                                </p>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                                  Costo Copia Extra (€) *
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={decimalInputs['costo_copia_bn_fuori_limite'] !== undefined 
                                    ? decimalInputs['costo_copia_bn_fuori_limite']
                                    : (newAsset.costo_copia_bn_fuori_limite !== null && newAsset.costo_copia_bn_fuori_limite !== undefined 
                                        ? newAsset.costo_copia_bn_fuori_limite.toString().replace('.', ',') 
                                        : '')}
                                  onChange={(e) => {
                                    let inputVal = e.target.value;
                                    // Rimuovi caratteri non validi (solo numeri, virgola o punto)
                                    inputVal = inputVal.replace(/[^0-9,\.]/g, '');
                                    // Permetti qualsiasi sequenza valida durante la digitazione
                                    if (inputVal === '' || /^[0-9]*([,\.][0-9]*)?$/.test(inputVal)) {
                                      // Converti punto in virgola per visualizzazione italiana
                                      inputVal = inputVal.replace(/\./g, ',');
                                      // Se c'è più di una virgola, mantieni solo la prima
                                      const parts = inputVal.split(',');
                                      if (parts.length > 2) {
                                        inputVal = parts[0] + ',' + parts.slice(1).join('');
                                      }
                                      // Salva il valore visualizzato durante la digitazione
                                      setDecimalInputs({ ...decimalInputs, 'costo_copia_bn_fuori_limite': inputVal });
                                      // Converti virgola in punto per il parsing numerico
                                      const valForParse = inputVal.replace(',', '.');
                                      // Permetti anche valori parziali durante la digitazione (0., 0,, etc.)
                                      const num = valForParse === '' || valForParse === '.' || valForParse === ',' ? null : parseFloat(valForParse);
                                      setNewAsset({ ...newAsset, costo_copia_bn_fuori_limite: isNaN(num) ? null : num });
                                    }
                                  }}
                                  onBlur={() => {
                                    // Quando perde il focus, pulisci lo stato temporaneo
                                    setDecimalInputs({ ...decimalInputs, 'costo_copia_bn_fuori_limite': undefined });
                                  }}
                                  className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                                  placeholder="0,05 (virgola o punto)"
                                />
                              </div>
                            </>
                          )}
                          {newAsset.tipo_configurazione_bn === 'non_incluse' && (
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                                Costo Copia (€) *
                              </label>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={(() => {
                                  if (newAsset.costo_copia_bn_non_incluse === null || newAsset.costo_copia_bn_non_incluse === undefined) return '';
                                  return newAsset.costo_copia_bn_non_incluse.toString().replace('.', ',');
                                })()}
                                onChange={(e) => {
                                  let inputVal = e.target.value;
                                  // Rimuovi caratteri non validi (solo numeri, virgola o punto)
                                  inputVal = inputVal.replace(/[^0-9,\.]/g, '');
                                  // Permetti qualsiasi sequenza valida durante la digitazione
                                  if (inputVal === '' || /^[0-9]*([,\.][0-9]*)?$/.test(inputVal)) {
                                    // Converti punto in virgola per visualizzazione italiana
                                    inputVal = inputVal.replace(/\./g, ',');
                                    // Se c'è più di una virgola, mantieni solo la prima
                                    const parts = inputVal.split(',');
                                    if (parts.length > 2) {
                                      inputVal = parts[0] + ',' + parts.slice(1).join('');
                                    }
                                    // Converti virgola in punto per il parsing numerico
                                    const valForParse = inputVal.replace(',', '.');
                                    // Permetti anche valori parziali durante la digitazione
                                    const num = valForParse === '' || valForParse === '.' || valForParse === ',' ? null : parseFloat(valForParse);
                                    setNewAsset({ ...newAsset, costo_copia_bn_non_incluse: isNaN(num) ? null : num });
                                  }
                                }}
                                className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                                placeholder="0,05 (usa la virgola)"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      {newAsset.is_colore && (
                        <div className="border-t border-gray-200 pt-3 mt-3">
                          <h4 className="font-semibold text-sm text-gray-700 mb-3">Configurazione Copie Colore</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                                Tipo Configurazione *
                              </label>
                              <select
                                value={newAsset.tipo_configurazione_colore || 'incluse'}
                                onChange={(e) => {
                                  const tipo = e.target.value;
                                  setNewAsset({
                                    ...newAsset,
                                    tipo_configurazione_colore: tipo,
                                    copie_incluse_colore: tipo === 'incluse' ? newAsset.copie_incluse_colore : null,
                                    costo_copia_colore_fuori_limite: tipo === 'incluse' ? newAsset.costo_copia_colore_fuori_limite : null,
                                    costo_copia_colore_non_incluse: tipo === 'non_incluse' ? newAsset.costo_copia_colore_non_incluse : null
                                  });
                                }}
                                className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                              >
                                <option value="incluse">Copie Incluse</option>
                                <option value="non_incluse">Copie Non Incluse</option>
                              </select>
                            </div>
                            {newAsset.tipo_configurazione_colore === 'incluse' && (
                              <>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                                    COPIE INCLUSE MENSILI *
                                  </label>
                                  <input
                                    type="number"
                                    value={newAsset.copie_incluse_colore || ''}
                                    onChange={(e) => setNewAsset({ ...newAsset, copie_incluse_colore: e.target.value ? parseInt(e.target.value) : null })}
                                    className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                                    placeholder="Es: 500"
                                  />
                                  <p className="text-xs text-gray-500 mt-1 ml-1">
                                    Numero di copie incluse mensilmente. Al prelievo verranno moltiplicate per il periodo (es. trimestrale = 3 mesi).
                                  </p>
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                                    Costo Copia Extra (€) *
                                  </label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={decimalInputs['costo_copia_colore_fuori_limite'] !== undefined 
                                      ? decimalInputs['costo_copia_colore_fuori_limite']
                                      : (newAsset.costo_copia_colore_fuori_limite !== null && newAsset.costo_copia_colore_fuori_limite !== undefined 
                                          ? newAsset.costo_copia_colore_fuori_limite.toString().replace('.', ',') 
                                          : '')}
                                    onChange={(e) => {
                                      let inputVal = e.target.value;
                                      // Rimuovi caratteri non validi (solo numeri, virgola o punto)
                                      inputVal = inputVal.replace(/[^0-9,\.]/g, '');
                                      // Permetti qualsiasi sequenza valida durante la digitazione
                                      if (inputVal === '' || /^[0-9]*([,\.][0-9]*)?$/.test(inputVal)) {
                                        // Converti punto in virgola per visualizzazione italiana
                                        inputVal = inputVal.replace(/\./g, ',');
                                        // Se c'è più di una virgola, mantieni solo la prima
                                        const parts = inputVal.split(',');
                                        if (parts.length > 2) {
                                          inputVal = parts[0] + ',' + parts.slice(1).join('');
                                        }
                                        // Salva il valore visualizzato durante la digitazione
                                        setDecimalInputs({ ...decimalInputs, 'costo_copia_colore_fuori_limite': inputVal });
                                        // Converti virgola in punto per il parsing numerico
                                        const valForParse = inputVal.replace(',', '.');
                                        // Permetti anche valori parziali durante la digitazione
                                        const num = valForParse === '' || valForParse === '.' || valForParse === ',' ? null : parseFloat(valForParse);
                                        setNewAsset({ ...newAsset, costo_copia_colore_fuori_limite: isNaN(num) ? null : num });
                                      }
                                    }}
                                    onBlur={() => {
                                      // Quando perde il focus, pulisci lo stato temporaneo
                                      setDecimalInputs({ ...decimalInputs, 'costo_copia_colore_fuori_limite': undefined });
                                    }}
                                    className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                                    placeholder="0,10 (virgola o punto)"
                                  />
                                </div>
                              </>
                            )}
                            {newAsset.tipo_configurazione_colore === 'non_incluse' && (
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                                  Costo Copia (€) *
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={decimalInputs['costo_copia_colore_non_incluse'] !== undefined 
                                    ? decimalInputs['costo_copia_colore_non_incluse']
                                    : (newAsset.costo_copia_colore_non_incluse !== null && newAsset.costo_copia_colore_non_incluse !== undefined 
                                        ? newAsset.costo_copia_colore_non_incluse.toString().replace('.', ',') 
                                        : '')}
                                  onChange={(e) => {
                                    let inputVal = e.target.value;
                                    // Rimuovi caratteri non validi (solo numeri, virgola o punto)
                                    inputVal = inputVal.replace(/[^0-9,\.]/g, '');
                                    // Permetti qualsiasi sequenza valida durante la digitazione
                                    if (inputVal === '' || /^[0-9]*([,\.][0-9]*)?$/.test(inputVal)) {
                                      // Converti punto in virgola per visualizzazione italiana
                                      inputVal = inputVal.replace(/\./g, ',');
                                      // Se c'è più di una virgola, mantieni solo la prima
                                      const parts = inputVal.split(',');
                                      if (parts.length > 2) {
                                        inputVal = parts[0] + ',' + parts.slice(1).join('');
                                      }
                                      // Salva il valore visualizzato durante la digitazione
                                      setDecimalInputs({ ...decimalInputs, 'costo_copia_colore_non_incluse': inputVal });
                                      // Converti virgola in punto per il parsing numerico
                                      const valForParse = inputVal.replace(',', '.');
                                      // Permetti anche valori parziali durante la digitazione
                                      const num = valForParse === '' || valForParse === '.' || valForParse === ',' ? null : parseFloat(valForParse);
                                      setNewAsset({ ...newAsset, costo_copia_colore_non_incluse: isNaN(num) ? null : num });
                                    }
                                  }}
                                  onBlur={() => {
                                    // Quando perde il focus, pulisci lo stato temporaneo
                                    setDecimalInputs({ ...decimalInputs, 'costo_copia_colore_non_incluse': undefined });
                                  }}
                                  className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                                  placeholder="0,10"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <IOSInput
                        label="Descrizione *"
                        value={newAsset.descrizione}
                        onChange={(e) => setNewAsset({ ...newAsset, descrizione: e.target.value })}
                        placeholder="Es: PC Desktop, Tablet iPad"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <IOSInput
                          label="Codice Prodotto"
                          value={newAsset.codice_prodotto}
                          onChange={(e) => setNewAsset({ ...newAsset, codice_prodotto: e.target.value })}
                          placeholder="Codice prodotto"
                        />
                        <IOSInput
                          label="Seriale *"
                          value={newAsset.seriale}
                          onChange={(e) => setNewAsset({ ...newAsset, seriale: e.target.value })}
                          placeholder="Numero seriale"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <IOSInput
                          label="Data Installazione"
                          type="date"
                          value={newAsset.data_installazione || ''}
                          onChange={(e) => setNewAsset({ ...newAsset, data_installazione: e.target.value || null })}
                        />
                        <IOSInput
                          label="Scadenza Noleggio *"
                          type="date"
                          value={newAsset.data_scadenza_noleggio || ''}
                          onChange={(e) => setNewAsset({ ...newAsset, data_scadenza_noleggio: e.target.value || null })}
                        />
                      </div>
                      {watch('has_multisede') && sedi.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                            Sede di Ubicazione
                          </label>
                          <select
                            value={newAsset.sede_id || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewAsset({ ...newAsset, sede_id: val === '' || val === '0' ? null : parseInt(val) });
                            }}
                            className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-4 pr-4 text-sm focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                          >
                            <option value="">Sede Principale (Legale)</option>
                            {sedi.map((sede, idx) => (
                              <option key={sede.id || idx} value={sede.id || idx}>
                                {sede.nome_sede} - {sede.indirizzo_completo}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1 ml-1">
                            Seleziona la sede dove è ubicato il prodotto noleggio. Gli avvisi di scadenza verranno inviati anche alla sede selezionata.
                          </p>
                        </div>
                      )}
                      <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <label className="flex items-center gap-2 font-semibold text-sm text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newAsset.is_nuovo}
                            onChange={(e) => setNewAsset({ ...newAsset, is_nuovo: e.target.checked })}
                            className="w-4 h-4 rounded text-blue-600"
                          />
                          Prodotto Nuovo (deselezionare se ricondizionato)
                        </label>
                      </div>
                    </>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddAsset}
                      className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-semibold text-sm"
                    >
                      {editingAssetIndex !== null ? 'Salva Modifiche' : 'Aggiungi'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAssetForm}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold text-sm"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}

              {assetsNoleggio.length > 0 && (
                <div className="space-y-2">
                  {assetsNoleggio.map((asset, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-xl border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {asset.tipo_asset === 'Printing' 
                            ? `${asset.marca} ${asset.modello}` 
                            : asset.descrizione}
                        </div>
                        {asset.tipo_asset === 'Printing' && (
                          <div className="text-sm text-gray-600 mt-1">
                            {asset.is_colore ? 'Colore' : 'B/N'} • 
                            {asset.matricola && ` Matricola: ${asset.matricola}`}
                            {asset.data_scadenza_noleggio && ` • Scade: ${new Date(asset.data_scadenza_noleggio).toLocaleDateString('it-IT')}`}
                            {lettureCopieAssets[asset.id] && lettureCopieAssets[asset.id].length > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <div className="text-xs font-semibold text-gray-700 mb-1">Storico Letture Copie:</div>
                                {lettureCopieAssets[asset.id].slice(0, 3).map((lettura: any, idx: number) => (
                                  <div key={idx} className="text-xs text-gray-600">
                                    {new Date(lettura.data_lettura).toLocaleDateString('it-IT')}: B/N {lettura.contatore_bn || 0}
                                    {asset.is_colore && lettura.contatore_colore ? ` | Colore ${lettura.contatore_colore}` : ''}
                                  </div>
                                ))}
                                {lettureCopieAssets[asset.id].length > 3 && (
                                  <div className="text-xs text-gray-500 italic mt-1">
                                    +{lettureCopieAssets[asset.id].length - 3} altre letture...
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {asset.tipo_asset === 'IT' && (
                          <div className="text-sm text-gray-600 mt-1">
                            {asset.seriale && `Seriale: ${asset.seriale}`}
                            {asset.codice_prodotto && ` • Codice: ${asset.codice_prodotto}`}
                            {asset.data_scadenza_noleggio && ` • Scade: ${new Date(asset.data_scadenza_noleggio).toLocaleDateString('it-IT')}`}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditAsset(index)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Modifica macchina"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAsset(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Rimuovi macchina"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {assetsNoleggio.length === 0 && !showAssetForm && (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nessuna macchina aggiunta. Clicca su "Aggiungi Macchina" per inserirne una.
                </p>
              )}
            </IOSCard>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
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
                  {isEdit ? 'Aggiorna' : 'Crea Cliente'}
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

