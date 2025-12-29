import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import axios from 'axios';
import { getApiUrl } from '../config/api';

interface User {
  id: number;
  email: string;
  nome_completo: string;
  ruolo: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  requires2FA: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      requires2FA: false,

      login: async (email: string, password: string, twoFactorCode?: string) => {
        try {
          // OAuth2PasswordRequestForm richiede application/x-www-form-urlencoded
          const params = new URLSearchParams();
          params.append('username', email); // OAuth2PasswordRequestForm usa 'username' per l'email
          params.append('password', password);
          // Se c'è un codice 2FA, aggiungilo come query parameter
          let url = `${getApiUrl()}/api/auth/login`;
          if (twoFactorCode) {
            url += `?two_factor_code=${encodeURIComponent(twoFactorCode)}`;
          }

          const response = await axios.post(url, params.toString(), {
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000
          });

          const { access_token, user, requires_2fa } = response.data;
          
          // Se richiede 2FA, non completare il login
          if (requires_2fa) {
            set({
              requires2FA: true,
              user: user
            });
            throw new Error('2FA_REQUIRED');
          }
          
          // Imposta header di default per tutte le richieste future
          axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

          set({
            token: access_token,
            user: user,
            isAuthenticated: true,
            requires2FA: false
          });
        } catch (error: any) {
          // Se è richiesto 2FA, non è un errore
          if (error.message === '2FA_REQUIRED') {
            throw error;
          }
          
          let errorMessage = 'Errore di connessione al server';
          if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
            errorMessage = `Impossibile connettersi al server. Verifica che il backend sia accessibile su ${getApiUrl()}`;
          } else if (error.response?.data?.detail) {
            errorMessage = error.response.data.detail;
          } else if (error.message) {
            errorMessage = error.message;
          }
          throw new Error(errorMessage);
        }
      },

      logout: () => {
        delete axios.defaults.headers.common['Authorization'];
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          requires2FA: false
        });
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        try {
          // Imposta header per questa richiesta
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const response = await axios.get(`${getApiUrl()}/api/auth/me`);
          
          set({
            user: response.data,
            isAuthenticated: true
          });
        } catch (error: any) {
          // Solo se è un errore 401/403 (non autorizzato), fai logout
          // Se è un errore di rete, mantieni la sessione (potrebbe essere temporaneo)
          if (error.response?.status === 401 || error.response?.status === 403) {
            // Token non valido, logout
            get().logout();
          } else if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
            // Errore di rete: mantieni la sessione ma non aggiornare isAuthenticated
            // L'utente rimane loggato finché il token non scade realmente
            console.warn('Errore di rete durante checkAuth, mantengo la sessione');
          } else {
            // Altri errori: mantieni la sessione
            console.warn('Errore durante checkAuth, mantengo la sessione:', error);
          }
        }
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
<<<<<<< HEAD
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        // Quando lo stato viene ripristinato, imposta isAuthenticated basandosi sul token
        if (state?.token) {
          state.isAuthenticated = true;
          // Imposta anche l'header axios
          axios.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
        }
      }
=======
      partialize: (state) => ({ token: state.token, user: state.user })
>>>>>>> 8a24854fd306e7698855d8f23c56e21682953e6d
    }
  )
);

<<<<<<< HEAD
// Migrazione da localStorage a sessionStorage (se necessario)
const oldLocalStorageToken = localStorage.getItem('auth-storage');
if (oldLocalStorageToken) {
=======
// Inizializza header se c'è un token salvato
const storedToken = sessionStorage.getItem('auth-storage');
if (storedToken) {
>>>>>>> 8a24854fd306e7698855d8f23c56e21682953e6d
  try {
    // Copia i dati da localStorage a sessionStorage
    sessionStorage.setItem('auth-storage', oldLocalStorageToken);
    // Rimuovi il vecchio localStorage
    localStorage.removeItem('auth-storage');
  } catch (e) {
    // Ignora errori di migrazione
  }
}

