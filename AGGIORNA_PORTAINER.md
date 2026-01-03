# Come Aggiornare i Container su Portainer dopo Modifiche al Codice

Questa guida spiega come aggiornare i container su Portainer ogni volta che modifichi il codice.

## Metodi Disponibili

### Metodo 1: Ricostruire lo Stack da Portainer UI (CONSIGLIATO)

Questo è il metodo più semplice e sicuro:

1. **Portainer** → **Stacks** → Seleziona il tuo stack (es. `sistema54`)
2. **Editor**: Clicca sul pulsante **Editor** (icona matita)
3. **Aggiorna il codice**:
   - Se usi **Repository Git**: Fai `git push` delle tue modifiche, poi clicca **Pull and redeploy** in Portainer
   - Se usi **Web editor**: Incolla il nuovo `docker-compose.portainer.yml` aggiornato
4. **Ricostruisci le immagini**:
   - Clicca su **Editor** → **Recreate** o **Rebuild**
   - Oppure usa il pulsante **Rebuild** nella pagina dello stack
5. **Riavvia i servizi**:
   - Portainer ricostruirà automaticamente i container con le nuove modifiche

**Nota**: Se usi Git, Portainer può essere configurato per fare auto-rebuild (vedi Metodo 3).

### Metodo 2: Via SSH al Server (Se hai accesso)

Se hai accesso SSH al server dove gira Portainer:

```bash
# 1. Connettiti al server
ssh user@server

# 2. Vai nella cartella del progetto (se clonato sul server)
cd /path/to/sistema54-app

# 3. Aggiorna il codice da Git (se usi Git)
git pull origin main

# 4. Ricostruisci e riavvia i container
docker-compose -f docker-compose.portainer.yml up -d --build

# Oppure solo per servizi specifici:
docker-compose -f docker-compose.portainer.yml up -d --build backend frontend
```

### Metodo 3: Auto-Rebuild con Git Webhook (AVANZATO)

Configura Portainer per ricostruire automaticamente quando fai push su Git:

1. **Portainer** → **Stacks** → Il tuo stack → **Editor**
2. Abilita **Auto-update**:
   - ✅ **Pull and redeploy when stack's image is updated**
   - ✅ **Redeploy when webhook is called**
3. **Configura il webhook**:
   - Copia l'URL del webhook fornito da Portainer
   - Configura il webhook nel tuo repository Git (GitHub/GitLab/Bitbucket)
   - Ogni `git push` triggererà automaticamente il rebuild

### Metodo 4: Ricostruire Singoli Container

Se vuoi aggiornare solo un servizio specifico:

1. **Portainer** → **Containers** → Seleziona il container (es. `sistema54_backend`)
2. **Recreate**: Clicca **Recreate** → ✅ **Recreate this container**
3. **Oppure via SSH**:
   ```bash
   docker-compose -f docker-compose.portainer.yml up -d --build --no-deps backend
   ```

## Workflow Consigliato

### Per Modifiche al Codice

1. **Sviluppo locale**:
   ```bash
   # Fai le modifiche sul tuo PC
   # Testa con Docker Desktop
   docker-compose up -d --build
   ```

2. **Commit e Push**:
   ```bash
   git add .
   git commit -m "Descrizione modifiche"
   git push origin main
   ```

3. **Aggiorna Portainer**:
   - **Portainer** → **Stacks** → Il tuo stack → **Pull and redeploy**
   - Oppure usa il webhook se configurato

### Per Modifiche al docker-compose.portainer.yml

1. **Modifica il file** `docker-compose.portainer.yml` localmente
2. **Portainer** → **Stacks** → Il tuo stack → **Editor**
3. **Incolla** il nuovo contenuto
4. **Clicca** **Update the stack**

## Verifica Aggiornamento

Dopo l'aggiornamento, verifica che tutto funzioni:

1. **Controlla i log**:
   - Portainer → **Containers** → Seleziona container → **Logs**
   - Verifica che non ci siano errori

2. **Testa l'applicazione**:
   - Frontend: `http://IP_SERVER:3001`
   - Backend API: `http://IP_SERVER:8000/docs`
   - pgAdmin: `http://IP_SERVER:5050`

3. **Verifica le versioni**:
   ```bash
   # Via SSH sul server
   docker exec sistema54_backend python --version
   docker exec sistema54_frontend node --version
   ```

## Risoluzione Problemi

### Container non si aggiorna

1. **Forza la ricostruzione**:
   ```bash
   docker-compose -f docker-compose.portainer.yml build --no-cache backend
   docker-compose -f docker-compose.portainer.yml up -d backend
   ```

2. **Rimuovi e ricrea**:
   - Portainer → **Containers** → Seleziona → **Remove**
   - Poi ricrea dallo stack

### Modifiche non si vedono

1. **Verifica che il codice sia stato pushato** su Git
2. **Verifica che Portainer abbia fatto pull** del nuovo codice
3. **Controlla i log** per errori di build
4. **Pulisci la cache Docker** (se necessario):
   ```bash
   docker system prune -a
   ```

### Build fallisce

1. **Controlla i log di build** in Portainer
2. **Verifica che i Dockerfile siano corretti**
3. **Verifica che le dipendenze siano aggiornate**:
   - Backend: `backend/requirements.txt`
   - Frontend: `frontend/package.json`

## Best Practices

1. **Testa sempre localmente** prima di aggiornare Portainer
2. **Fai backup del database** prima di aggiornamenti importanti
3. **Usa Git** per tracciare tutte le modifiche
4. **Configura webhook** per auto-rebuild (se possibile)
5. **Monitora i log** dopo ogni aggiornamento
6. **Mantieni aggiornati** i file `docker-compose.portainer.yml` e i Dockerfile

## Comandi Rapidi

```bash
# Ricostruisci tutto
docker-compose -f docker-compose.portainer.yml up -d --build

# Ricostruisci solo backend
docker-compose -f docker-compose.portainer.yml up -d --build --no-deps backend

# Ricostruisci solo frontend
docker-compose -f docker-compose.portainer.yml up -d --build --no-deps frontend

# Riavvia senza ricostruire
docker-compose -f docker-compose.portainer.yml restart

# Vedi i log
docker-compose -f docker-compose.portainer.yml logs -f backend
```

## Note Importanti

⚠️ **ATTENZIONE**:
- Il database (`sistema54_db`) **NON deve essere ricostruito** a meno che non ci siano modifiche al setup PostgreSQL
- I volumi Docker **preservano i dati** durante i rebuild
- Le modifiche al codice vengono incluse solo dopo il rebuild delle immagini
- Il frontend potrebbe richiedere un hard refresh (Ctrl+F5) per vedere le modifiche







