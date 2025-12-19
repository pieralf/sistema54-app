import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import axios from 'axios';
import { API_URL } from '../config/api';

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
          let url = `${API_URL}/api/auth/login`;
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
            errorMessage = `Impossibile connettersi al server. Verifica che il backend sia accessibile su ${API_URL}`;
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
          const response = await axios.get(`${API_URL}/api/auth/me`);
          
          set({
            user: response.data,
            isAuthenticated: true
          });
        } catch (error) {
          // Token non valido, logout
          get().logout();
        }
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user })
    }
  )
);

// Inizializza header se c'è un token salvato
const storedToken = localStorage.getItem('auth-storage');
if (storedToken) {
  try {
    const parsed = JSON.parse(storedToken);
    if (parsed.state?.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${parsed.state.token}`;
    }
  } catch (e) {
    // Ignora errori di parsing
  }
}

