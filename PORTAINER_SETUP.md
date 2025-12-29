# Guida Setup Portainer per SISTEMA54

## ⚠️ IMPORTANTE: Come caricare il file in Portainer

Quando carichi il file `docker-compose.portainer.yml` in Portainer tramite web editor:

1. **Vai su Stacks** → **Add Stack**
2. **Nome Stack**: `sistema54`
3. **Metodo di caricamento**: Seleziona **Web editor**
4. **CRITICO**: Nel web editor di Portainer, ci sono DUE campi separati:
   - **Campo principale (grande)**: Questo è per il **docker-compose.yml** - incolla qui il contenuto di `docker-compose.portainer.yml`
   - **Campo Dockerfile**: Questo è SOLO per Dockerfile personalizzati - LASCIA VUOTO
5. **NON** incollare il contenuto nel campo "Dockerfile" o "Build"
6. Il file deve iniziare con `services:` (senza commenti prima)
7. Dopo aver incollato, verifica che il campo principale contenga il testo che inizia con `services:`

## 📋 Procedura Step-by-Step

### ⚠️ IMPORTANTE: Usa Repository Git (CONSIGLIATO)

Il web editor di Portainer NON funziona per questo progetto perché ha bisogno di accedere alle cartelle `backend/` e `frontend/` per i build. 

**USA SEMPRE IL METODO REPOSITORY GIT!**

### Opzione 1: Repository Git (CONSIGLIATO - USA QUESTO)

1. Assicurati che il progetto sia su un repository Git (GitHub, GitLab, etc.)
2. Apri Portainer → **Stacks** → **Add Stack**
3. Nome: `sistema54`
4. Seleziona **Repository**
5. Inserisci:
   - **Repository URL**: URL del tuo repository Git (es: `https://github.com/tuousername/sistema54-app.git`)
   - **Compose path**: `docker-compose.portainer.yml`
   - **Reference**: `main` o `master` (il tuo branch principale)
6. Clicca **Deploy the stack**

Portainer clonerà il repository e avrà accesso a tutti i file necessari per i build.

### Opzione 2: Upload File Completo (Alternativa)

Se non puoi usare Git, devi caricare TUTTO il progetto:

1. Crea un archivio ZIP di tutto il progetto (includi `backend/`, `frontend/`, `docker-compose.portainer.yml`)
2. Carica l'archivio sul server dove gira Portainer
3. Estrai l'archivio in una directory accessibile a Portainer
4. Apri Portainer → **Stacks** → **Add Stack**
5. Nome: `sistema54`
6. Seleziona **Upload**
7. Carica il file `docker-compose.portainer.yml` dalla directory estratta
8. **IMPORTANTE**: Assicurati che Portainer possa accedere alla directory dove hai estratto il progetto
9. Clicca **Deploy the stack**

### Opzione 3: Web Editor (NON CONSIGLIATO - Non funziona per i build)

1. Apri Portainer → **Stacks** → **Add Stack**
2. Nome: `sistema54`
3. Seleziona **Repository**
4. Inserisci l'URL del repository Git
5. Specifica il path: `docker-compose.portainer.yml`
6. Clicca **Deploy the stack**

## 🔧 Requisiti

- Il file `docker-compose.portainer.yml` deve essere nella **root del progetto**
- Le cartelle `backend/` e `frontend/` devono essere nella stessa directory del file docker-compose
- Portainer deve avere accesso alla directory del progetto per i build context

## 🐛 Risoluzione Problemi

### Errore: "unknown instruction: services:" o "unknown instruction: version:"

Questo errore significa che Portainer sta interpretando il file come Dockerfile invece che come docker-compose.yml.

**Soluzione:**
1. **VERIFICA IL CAMPO CORRETTO**: Nel web editor di Portainer ci sono DUE campi:
   - Campo grande principale = docker-compose.yml (USA QUESTO)
   - Campo piccolo "Dockerfile" = solo per Dockerfile personalizzati (LASCIA VUOTO)
2. **Il file deve iniziare con `services:`** (senza commenti prima)
3. **NON** incollare nulla nel campo "Dockerfile" o "Build"
4. Se l'errore persiste, prova a:
   - Cancellare tutto dal campo Dockerfile (se c'è qualcosa)
   - Incollare SOLO nel campo principale (docker-compose)
   - Verificare che il testo inizi con `services:` e non con `FROM` o `#`

### Errore: "Cannot find Dockerfile"

**Soluzione:**
- Verifica che le cartelle `backend/` e `frontend/` esistano nella stessa directory del docker-compose.yml
- Verifica che i file `backend/Dockerfile` e `frontend/Dockerfile` esistano

### Errore: "unable to prepare context: path '/data/compose/10/backend' not found"

Questo errore significa che Portainer non trova le cartelle `backend/` e `frontend/` perché il web editor salva solo il docker-compose.yml in una directory temporanea.

**Soluzione:**
- **NON usare il web editor** per questo progetto
- **USA il metodo Repository Git** (Opzione 1) - è l'unico modo affidabile
- Se non puoi usare Git, usa il metodo Upload File Completo (Opzione 2) e assicurati che Portainer abbia accesso alla directory completa del progetto

### Errore: "port is already allocated" o "Bind for 0.0.0.0:3000 failed"

Questo errore significa che la porta 3000 (o un'altra porta) è già in uso.

**Soluzione:**
1. **Rimuovi lo stack precedente** (se esiste):
   - Vai su **Stacks** → trova lo stack `sistema54` (o il nome che hai usato)
   - Clicca su di esso → **Editor** → **Remove Stack**
   - Conferma la rimozione

2. **Oppure ferma i container esistenti:**
   - Vai su **Containers**
   - Cerca container con nome `sistema54_frontend`, `sistema54_backend`, `sistema54_db`
   - Fermali e rimuovili

3. **Oppure cambia la porta** nel `docker-compose.portainer.yml`:
   - Cambia `"3000:5173"` in `"3001:5173"` (o un'altra porta libera)
   - Ricommita su Git e riprova il deploy

### Errore: "Unable to deploy stack" (generico)

Questo errore può avere diverse cause. Segui questi passaggi:

1. **Verifica che il repository contenga tutti i file necessari:**
   - `docker-compose.portainer.yml` nella root
   - `backend/Dockerfile.portainer`
   - `frontend/Dockerfile.portainer`
   - `backend/requirements.txt`
   - `frontend/package.json`
   - Tutte le cartelle `backend/app/` e `frontend/src/`

2. **Verifica il path del compose file in Portainer:**
   - Deve essere esattamente: `docker-compose.portainer.yml`
   - Non `docker-compose.yml` o altri path

3. **Verifica il branch:**
   - Assicurati di specificare il branch corretto (di solito `main` o `master`)

4. **Controlla i log di Portainer:**
   - Vai su **Stacks** → clicca sul tuo stack → **Logs**
   - Cerca errori specifici durante il build

5. **Verifica che il repository sia pubblico o che Portainer abbia accesso:**
   - Se privato, configura le credenziali Git in Portainer

## 📝 Note Importanti

- Il file `docker-compose.portainer.yml` è ottimizzato per il deploy da repository Git
- **Volumi**: Usa volumi Docker per dati persistenti (PostgreSQL, uploads, node_modules)
- **Codice sorgente**: Il codice è incluso nell'immagine Docker durante il build (non usa bind mount)
- Per modifiche al codice: fai commit su Git e Portainer ricostruirà automaticamente
- I servizi hanno `restart: unless-stopped` per riavvio automatico
- Gli healthcheck sono configurati per monitorare lo stato dei servizi
- Le labels aiutano a identificare i servizi in Portainer

### Differenze con docker-compose.yml (Docker Desktop)

- `docker-compose.yml`: Usa bind mount per sviluppo locale (modifiche immediate)
- `docker-compose.portainer.yml`: Usa volumi Docker per produzione (codice nell'immagine)

## 🔄 Dopo il Deploy

Dopo aver deployato lo stack:

1. Verifica che tutti i container siano in esecuzione: **Containers** → dovresti vedere `sistema54_db`, `sistema54_backend`, `sistema54_frontend`, `sistema54_pgadmin`
2. Controlla i log se ci sono errori: **Containers** → clicca sul container → **Logs**
3. Accedi all'applicazione:
   - Frontend: `http://IP_SERVER:3001`
   - Backend API: `http://IP_SERVER:8000`
   - API Docs: `http://IP_SERVER:8000/docs`
   - pgAdmin: `http://IP_SERVER:5050` (email: `admin@sistema54.local`, password: `sistema54admin`)

**Nota**: Se pgAdmin non appare dopo l'aggiornamento dello stack, potrebbe essere necessario aggiornare lo stack o ricrearlo. Vedi [PGADMIN_SETUP.md](PGADMIN_SETUP.md) per troubleshooting.

**Nota**: La porta frontend è 3001 invece di 3000 per evitare conflitti con altri servizi (es. AdGuard Home).

## 📦 Gestione Database

### Interfaccia Web pgAdmin

SISTEMA54 include **pgAdmin**, un'interfaccia web completa per gestire il database PostgreSQL.

- **URL**: `http://IP_SERVER:5050`
- **Email**: `admin@sistema54.com`
- **Password**: `sistema54admin`

Consulta la guida completa: **[PGADMIN_SETUP.md](PGADMIN_SETUP.md)**

**Funzionalità principali:**
- ✅ Visualizzare tabelle e dati
- ✅ Eseguire query SQL
- ✅ Importare/Esportare backup
- ✅ Modificare dati direttamente
- ✅ Creare nuove tabelle e strutture

### Importare un Backup del Database

**Metodo 1: Via pgAdmin (CONSIGLIATO)**
1. Accedi a pgAdmin: `http://IP_SERVER:5050`
2. Clicca destro sul database → **Restore...**
3. Seleziona il file `.sql` e clicca **Restore**

**Metodo 2: Da Console**
Per importare un backup del database PostgreSQL nel container `sistema54_db`, consulta la guida completa:
- **[PORTAINER_RESTORE_DB.md](PORTAINER_RESTORE_DB.md)** - Guida dettagliata per l'importazione di backup

**Metodo rapido (da console Portainer):**
1. Portainer → **Containers** → `sistema54_db` → **Console**
2. Carica il file di backup nel container: `docker cp backup.sql sistema54_db:/tmp/backup.sql` (dal server)
3. Importa: `psql -U admin -d sistema54_db < /tmp/backup.sql`

### Creare un Backup del Database

**Metodo 1: Via pgAdmin**
1. Accedi a pgAdmin: `http://IP_SERVER:5050`
2. Clicca destro sul database → **Backup...**
3. Scegli il percorso e clicca **Backup**

**Metodo 2: Da Console**
```bash
# Da console Portainer o terminale server
docker exec sistema54_db pg_dump -U admin -d sistema54_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

## 🆘 Supporto

Se continui ad avere problemi:
1. Verifica i log dei container in Portainer
2. Controlla che tutti i file necessari siano presenti
3. Assicurati che Portainer abbia i permessi necessari per accedere alle directory
4. Consulta [PORTAINER_RESTORE_DB.md](PORTAINER_RESTORE_DB.md) per problemi con il database

