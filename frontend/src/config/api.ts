// Rileva automaticamente l'URL del backend in base all'host corrente
// Se si accede da un altro PC, usa l'IP del server invece di localhost
export function getApiUrl(): string {
  // Rileva l'host corrente (funziona sia per localhost che per IP remoto)
  const hostname = window.location.hostname;
  const port = '8000'; // Porta backend
  
  // Se è definita una variabile d'ambiente VITE_API_URL
  if (import.meta.env.VITE_API_URL) {
    const viteUrl = import.meta.env.VITE_API_URL;
    
    // Se VITE_API_URL contiene localhost ma si sta accedendo da remoto, ignoralo
    if (viteUrl.includes('localhost') && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      // Si sta accedendo da remoto, usa l'hostname corrente invece di localhost
      const url = `http://${hostname}:${port}`;
      console.log('[getApiUrl] Accesso remoto rilevato, ignorando VITE_API_URL (localhost), usando:', url);
      return url;
    }
    
    // Altrimenti usa VITE_API_URL se non contiene localhost o si sta accedendo da localhost
    console.log('[getApiUrl] Usando VITE_API_URL:', viteUrl);
    return viteUrl;
  }
  
  // Se è localhost o 127.0.0.1, usa localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const url = `http://localhost:${port}`;
    console.log('[getApiUrl] Rilevato localhost, usando:', url);
    return url;
  }
  
  // Controlla se si sta accedendo tramite proxy DNS (hostname diverso da IP diretto)
  // Se l'hostname non è un IP diretto (contiene lettere o è un dominio), potrebbe essere un proxy
  const isIpAddress = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  const isProxyAccess = !isIpAddress && hostname !== 'localhost' && hostname !== '127.0.0.1';
  
  if (isProxyAccess) {
    // Se si accede tramite proxy DNS, usa percorso relativo che il proxy può inoltrare
    // Assumendo che il proxy sia configurato per inoltrare /api/* al backend
    const url = '/api';
    console.log('[getApiUrl] Accesso tramite proxy DNS rilevato, usando percorso relativo:', url);
    return url;
  }
  
  // Altrimenti usa l'IP/hostname corrente con protocollo HTTP
  // (il backend è sempre su HTTP, anche se il frontend potrebbe essere su HTTPS)
  const url = `http://${hostname}:${port}`;
  console.log('[getApiUrl] Rilevato hostname:', hostname, 'URL backend:', url);
  return url;
}

// Mantieni API_URL per retrocompatibilità (usa getApiUrl())
// NOTA: Non chiamare getApiUrl() qui perché window potrebbe non essere disponibile durante il build
// API_URL verrà valutato dinamicamente quando necessario
export const API_URL = 'http://localhost:8000'; // Valore di default, sarà sovrascritto dinamicamente

