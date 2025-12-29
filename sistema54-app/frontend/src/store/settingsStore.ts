import { create } from 'zustand';
import axios from 'axios';
import { getApiUrl } from '../config/api';

interface Settings {
  nome_azienda: string;
  logo_url: string;
  colore_primario: string;
  [key: string]: any;
}

interface SettingsStore {
  settings: Settings | null;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  isLoading: false,

  loadSettings: async () => {
    // Se già caricato, non ricaricare
    if (get().settings) return;
    
    set({ isLoading: true });
    try {
      // Usa sempre l'endpoint pubblico per evitare problemi di autenticazione
      const res = await axios.get(`${getApiUrl()}/impostazioni/public`);
      const data = res.data || {};
      set({ 
        settings: {
          nome_azienda: data.nome_azienda || 'SISTEMA54',
          logo_url: data.logo_url || '',
          colore_primario: data.colore_primario || '#4F46E5',
          ...data
        },
        isLoading: false 
      });
      
      // Aggiorna favicon
      updateFavicon(data.logo_url);
      // Aggiorna titolo pagina
      if (data.nome_azienda) {
        document.title = data.nome_azienda;
      }
    } catch (err) {
      console.error('Errore caricamento impostazioni:', err);
      set({ 
        settings: {
          nome_azienda: 'SISTEMA54',
          logo_url: '',
          colore_primario: '#4F46E5'
        },
        isLoading: false 
      });
    }
  },

  updateSettings: (newSettings) => {
    const current = get().settings || {};
    const updated = { ...current, ...newSettings };
    set({ settings: updated });
    
    // Aggiorna favicon se cambia il logo
    if (newSettings.logo_url !== undefined) {
      updateFavicon(newSettings.logo_url);
    }
    // Aggiorna titolo se cambia il nome
    if (newSettings.nome_azienda) {
      document.title = newSettings.nome_azienda;
    }
  }
}));

// Funzione helper per aggiornare il favicon
function updateFavicon(logoUrl: string) {
  if (!logoUrl) {
    // Rimuovi favicon personalizzato se non c'è logo
    const existingFavicon = document.querySelector('link[rel="icon"]');
    if (existingFavicon) {
      existingFavicon.remove();
    }
    return;
  }

  // Crea o aggiorna il link del favicon
  let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.appendChild(favicon);
  }
  
  // Usa il logo come favicon
  favicon.href = `${getApiUrl()}${logoUrl}`;
  favicon.type = 'image/png'; // Assumiamo PNG, potrebbe essere migliorato
}


