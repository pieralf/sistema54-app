# Configurazione Nginx Proxy per SISTEMA54 tramite Portainer

Questa guida spiega come configurare nginx per inoltrare le richieste API al backend quando si accede tramite DNS LAN (AdGuard Home).

## Prerequisiti

- Portainer installato e funzionante
- Container nginx già configurato come reverse proxy
- AdGuard Home configurato per risolvere il dominio DNS locale
- Frontend e Backend già deployati su Portainer

## Metodo 1: Configurazione tramite Portainer Console (Consigliato)

### Passo 1: Identifica il container nginx

1. Accedi a Portainer
2. Vai su **Containers**
3. Cerca il container nginx (es. `nginx`, `nginx-proxy`, `nginx-proxy-manager`)
4. Annota il nome del container

### Passo 2: Accedi alla console del container nginx

1. Clicca sul container nginx
2. Vai su **Console** (o **Exec**)
3. Clicca su **Connect** per aprire una shell nel container

### Passo 3: Verifica la struttura della configurazione

Nel container nginx, esegui:

```bash
# Verifica dove sono i file di configurazione
ls -la /etc/nginx/

# Di solito sono in:
# - /etc/nginx/nginx.conf (configurazione principale)
# - /etc/nginx/conf.d/ (configurazioni dei siti)
# - /etc/nginx/sites-available/ (se presente)
# - /etc/nginx/sites-enabled/ (se presente)
```

### Passo 4: Crea/modifica la configurazione del sito

**Opzione A: Se usi `/etc/nginx/conf.d/` (più comune)**

```bash
# Crea/modifica il file di configurazione
nano /etc/nginx/conf.d/sistema54.conf
```

**Opzione B: Se usi `/etc/nginx/sites-available/` e `/etc/nginx/sites-enabled/`**

```bash
# Crea il file in sites-available
nano /etc/nginx/sites-available/sistema54.conf

# Crea il link simbolico in sites-enabled
ln -s /etc/nginx/sites-available/sistema54.conf /etc/nginx/sites-enabled/sistema54.conf
```

### Passo 5: Aggiungi la configurazione nginx

**Configurazione per `rit.lan` con container Docker nella stessa rete:**

```nginx
server {
    listen 80;
    server_name rit.lan;  # Dominio configurato in AdGuard Home
    
    # Log per debug
    access_log /var/log/nginx/rit_access.log;
    error_log /var/log/nginx/rit_error.log;
    
    # Frontend (React app) - usa il nome del container Docker
    location / {
        proxy_pass http://sistema54_frontend:5173;  # Nome container invece di IP
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # WebSocket support (necessario per hot reload in sviluppo)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Backend API - usa il nome del container Docker
    location /api/ {
        proxy_pass http://sistema54_backend:8000/;  # Nome container invece di IP
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Timeout per richieste lunghe (upload file, export PDF, etc.)
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
        
        # Buffer per upload file grandi
        client_max_body_size 50M;
        proxy_buffering off;
    }
    
    # Uploads (file statici del backend)
    location /uploads/ {
        proxy_pass http://sistema54_backend:8000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://sistema54_backend:8000/docs;
        proxy_set_header Host $host;
    }
}
```

**IMPORTANTE:** 
- ✅ Usa i nomi dei container (`sistema54_frontend`, `sistema54_backend`) perché sono nella stessa rete Docker
- ✅ Il dominio è `rit.lan` come configurato in AdGuard Home
- ✅ Assicurati che il container nginx sia nella rete `sistema54-network` (vedi Passo 5.1)

### Passo 5.1: Verifica che nginx sia nella stessa rete Docker

Se nginx non è ancora nella rete `sistema54-network`, aggiungilo:

1. In Portainer, vai sul container nginx
2. Clicca su **Duplicate/Edit**
3. Nella sezione **Networks**, aggiungi `sistema54-network`
4. Salva e ricrea il container

### Passo 6: Testa la configurazione

```bash
# Testa la sintassi nginx
nginx -t
```

Se vedi `syntax is ok` e `test is successful`, procedi.

### Passo 7: Ricarica nginx

```bash
# Ricarica la configurazione senza interrompere il servizio
nginx -s reload

# Oppure se nginx è gestito da systemd
# systemctl reload nginx
```

## Metodo 2: Configurazione tramite Volume Mount (Alternativa)

Se preferisci modificare i file dal tuo PC invece che dalla console:

### Passo 1: Identifica il volume di configurazione nginx

1. In Portainer, vai su **Volumes**
2. Cerca i volumi associati al container nginx
3. Annota il nome del volume (es. `nginx_conf`, `nginx_config`)

### Passo 2: Modifica il docker-compose di nginx

Se hai accesso al docker-compose del container nginx, aggiungi un volume mount:

```yaml
services:
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro  # Mount della configurazione
      - ./nginx/logs:/var/log/nginx  # Mount dei log (opzionale)
    ports:
      - "80:80"
      - "443:443"
```

### Passo 3: Crea il file di configurazione localmente

Crea `nginx/conf.d/sistema54.conf` sul tuo PC con la configurazione del Passo 5.

### Passo 4: Riavvia il container nginx

In Portainer:
1. Vai sul container nginx
2. Clicca su **Recreate** (o **Restart**)
3. Seleziona **Recreate the container** e clicca su **Recreate**

## Metodo 3: Usando Nginx Proxy Manager (se installato)

Se hai installato **Nginx Proxy Manager** come container separato:

### Passo 1: Accedi a Nginx Proxy Manager

1. Vai su `http://IP_SERVER:81` (porta di default)
2. Login con:
   - Email: `admin@example.com`
   - Password: `changeme` (cambiala al primo accesso)

### Passo 2: Crea Proxy Host per il Frontend

1. Vai su **Proxy Hosts** → **Add Proxy Host**
2. Compila:
   - **Domain Names**: `rit.lan`
   - **Scheme**: `http`
   - **Forward Hostname/IP**: `sistema54_frontend` (nome container Docker)
   - **Forward Port**: `5173` (porta interna del container)
   - **Forward Scheme**: `http`
3. Abilita:
   - ✅ **Websockets Support**
   - ✅ **Block Common Exploits**
   - ✅ **SSL** (se hai un certificato)
4. Clicca su **Save**

### Passo 3: Aggiungi Location per API

1. Clicca su **Edit** del proxy host appena creato
2. Vai su **Advanced** tab
3. Nel campo **Custom Nginx Configuration**, aggiungi:

```nginx
location /api/ {
    proxy_pass http://sistema54_backend:8000/;  # Nome container Docker
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
    client_max_body_size 50M;
}

location /uploads/ {
    proxy_pass http://sistema54_backend:8000/uploads/;  # Nome container Docker
    proxy_set_header Host $host;
}
```

4. Clicca su **Save**

## Configurazione AdGuard Home

Assicurati che AdGuard Home risolva correttamente il dominio:

1. Accedi a AdGuard Home (`http://IP_ADGUARD:3000` o porta configurata)
2. Vai su **Filters** → **DNS Rewrites**
3. Aggiungi una regola:
   - **Domain**: `rit.lan`
   - **IP**: `192.168.1.119` (IP del server nginx/Portainer)
4. Salva

**Nota**: Se nginx è un container Docker, usa l'IP del server host Docker, non l'IP interno del container.

## Verifica della Configurazione

### Test 1: Verifica risoluzione DNS

Dal tuo PC (non dal server):

```bash
# Windows PowerShell
nslookup rit.lan

# Linux/Mac
dig rit.lan
```

Dovresti vedere l'IP del server nginx/Portainer (es. `192.168.1.119`).

### Test 2: Verifica accesso frontend

1. Apri il browser
2. Vai su `http://rit.lan`
3. Dovresti vedere la pagina di login di SISTEMA54

### Test 3: Verifica API

1. Apri la console del browser (F12)
2. Vai su **Network**
3. Esegui il login
4. Controlla che le richieste API vadano a:
   - ✅ `http://rit.lan/api/auth/login` (corretto)
   - ❌ `http://192.168.1.119:8000/auth/login` (errato, significa che il proxy non funziona)

### Test 4: Verifica log nginx

Nel container nginx:

```bash
# Log di accesso
tail -f /var/log/nginx/rit_access.log

# Log di errore
tail -f /var/log/nginx/rit_error.log
```

## Troubleshooting

### Errore 403 Forbidden

**Causa**: Il proxy non è configurato correttamente o il backend rifiuta la connessione.

**Soluzione**:
1. Verifica che il backend sia raggiungibile dal container nginx:
   ```bash
   # Dalla console del container nginx
   curl http://sistema54_backend:8000/docs
   ```
2. Verifica che nginx sia nella stessa rete Docker (`sistema54-network`)
3. Controlla i log nginx: `tail -f /var/log/nginx/rit_error.log`

### Errore 502 Bad Gateway

**Causa**: nginx non riesce a raggiungere il backend.

**Soluzione**:
1. Verifica che il backend sia in esecuzione: `docker ps | grep backend`
2. Verifica che nginx possa risolvere il nome del container:
   ```bash
   # Dalla console del container nginx
   ping sistema54_backend
   curl http://sistema54_backend:8000/docs
   ```
3. Verifica che nginx sia nella stessa rete Docker `sistema54-network`:
   ```bash
   # Dalla console del container nginx
   cat /etc/hosts  # Dovrebbe contenere riferimenti ai container Docker
   ```
4. Se nginx non è nella rete, aggiungilo tramite Portainer (vedi Passo 5.1)

### Le richieste API vanno ancora all'IP diretto

**Causa**: Il frontend non rileva correttamente il proxy DNS.

**Soluzione**:
1. Verifica che il dominio DNS sia configurato correttamente in AdGuard Home (`rit.lan` → IP server)
2. Verifica che stai accedendo tramite `http://rit.lan` e non tramite IP diretto
3. Controlla la console del browser per vedere quale URL viene usato da `getApiUrl()`
4. Dovresti vedere: `[getApiUrl] Accesso tramite proxy DNS rilevato, usando percorso relativo: /api`

### CORS Error

**Causa**: Il backend potrebbe non riconoscere l'origine del proxy.

**Soluzione**: Il backend è già configurato con `allow_origins=["*"]`, quindi non dovrebbe essere un problema. Se persiste, verifica che il backend riceva correttamente gli header `X-Forwarded-*`.

## Configurazione Pronta all'Uso per `rit.lan`

Questa è la configurazione completa e pronta per il tuo setup (`rit.lan` + container nella stessa rete):

```nginx
server {
    listen 80;
    server_name rit.lan;
    
    access_log /var/log/nginx/rit_access.log;
    error_log /var/log/nginx/rit_error.log;
    
    # Frontend
    location / {
        proxy_pass http://sistema54_frontend:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://sistema54_backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        proxy_send_timeout 300s;
        client_max_body_size 50M;
        proxy_buffering off;
    }
    
    # Uploads
    location /uploads/ {
        proxy_pass http://sistema54_backend:8000/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Vantaggi dell'usare nomi container Docker**:
- ✅ Non dipende dall'IP del server
- ✅ Funziona anche se gli IP cambiano
- ✅ Più robusto in ambienti Docker
- ✅ Risoluzione DNS automatica tramite Docker network

**Requisiti**:
- nginx deve essere nella stessa rete Docker (`sistema54-network`)
- Se nginx è gestito tramite docker-compose, aggiungi:
  ```yaml
  networks:
    - sistema54-network
  ```

## Riferimenti

- [Documentazione Nginx](https://nginx.org/en/docs/)
- [Nginx Proxy Manager](https://nginxproxymanager.com/)
- [AdGuard Home DNS Rewrites](https://github.com/AdguardTeam/AdGuardHome/wiki/DNS-rewrites)

