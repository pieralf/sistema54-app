# Configurazione Nginx Proxy Manager per rit.lan

## Tab Details
- **Domain Names:** `rit.lan`
- **Scheme:** `http`
- **Forward Hostname/IP:** `192.168.1.119`
- **Forward Port:** `3001`
- **Forward Scheme:** `http`
- **Cache Assets:** ❌ Disabilitato
- **Block Common Exploits:** ❌ Disabilitato (temporaneamente per debug)
- **Websockets Support:** ✅ Abilitato

## Tab Advanced - Custom Nginx Configuration

Copia e incolla questa configurazione nella tab "Advanced":

```nginx
# Frontend (React app)
location / {
    proxy_pass http://192.168.1.119:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;
    
    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

# Backend API
location /api/ {
    proxy_pass http://192.168.1.119:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;
    proxy_set_header Origin $scheme://$host;
    
    # Timeout per richieste lunghe
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
    proxy_send_timeout 300s;
    
    # Upload file grandi
    client_max_body_size 50M;
    proxy_buffering off;
}

# Uploads (file statici del backend)
location /uploads/ {
    proxy_pass http://192.168.1.119:8000/uploads/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Verifica della configurazione

Dopo aver salvato:

1. **Testa il frontend:**
   - Apri `http://rit.lan` nel browser
   - Dovresti vedere l'app React

2. **Testa il backend:**
   - Apri `http://rit.lan/api/docs` nel browser
   - Dovresti vedere la documentazione Swagger del backend

3. **Verifica i log:**
   - Vai su "Audit Logs" in Nginx Proxy Manager
   - Cerca le richieste a `rit.lan`
   - Controlla se ci sono errori 403 o altri errori

## Troubleshooting

### Se vedi ancora 403 Forbidden:

1. **Verifica che i servizi siano raggiungibili:**
   - Frontend: `http://192.168.1.119:3001`
   - Backend: `http://192.168.1.119:8000/docs`

2. **Controlla i log del backend in Portainer:**
   - Vai su Portainer → Containers → `sistema54_backend` → Logs
   - Cerca errori o messaggi di rifiuto

3. **Verifica che AdGuard Home risolva correttamente:**
   - Vai su AdGuard Home → DNS Rewrites
   - Verifica che `rit.lan` punti a `192.168.1.119` (IP del server Nginx Proxy Manager)

4. **Prova a disabilitare temporaneamente "Block Common Exploits":**
   - Nella tab Details del proxy host
   - Disabilita "Block Common Exploits"
   - Salva e riprova

