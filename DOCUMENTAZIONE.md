# SISTEMA54 Digital - Documentazione Completa

## Indice
1. [Panoramica](#panoramica)
2. [Architettura](#architettura)
3. [Funzionalità Principali](#funzionalità-principali)
4. [Installazione](#installazione)
5. [Configurazione](#configurazione)
6. [Backup e Ripristino](#backup-e-ripristino)
7. [Deploy su Portainer](#deploy-su-portainer)
8. [API Endpoints](#api-endpoints)
9. [Database](#database)
10. [Sicurezza](#sicurezza)
11. [Manutenzione](#manutenzione)

---

## Panoramica

**SISTEMA54 Digital** è un sistema CMMS (Computerized Maintenance Management System) completo per la gestione di:
- **R.I.T. (Rapporti di Intervento Tecnico)** con generazione PDF
- **Clienti** con gestione multi-sede
- **Magazzino** prodotti e ricambi
- **Contratti di assistenza** e **noleggio** (IT e Printing)
- **Letture copie** per prodotti Printing a noleggio
- **Utenti** con sistema di permessi granulari
- **Notifiche automatiche** per scadenze contratti e letture copie

### Tecnologie Utilizzate

- **Backend**: FastAPI (Python 3.11)
- **Frontend**: React 18 + TypeScript + Vite
- **Database**: PostgreSQL 15
- **Containerizzazione**: Docker & Docker Compose
- **PDF**: WeasyPrint + FPDF2 (fallback)
- **Email**: SMTP configurabile
- **Autenticazione**: JWT + 2FA (opzionale)

---

## Architettura

### Struttura Progetto

```
sistema54-app/
├── backend/                 # Backend FastAPI
│   ├── app/
│   │   ├── main.py         # API endpoints principali
│   │   ├── models.py       # Modelli SQLAlchemy
│   │   ├── schemas.py      # Schemi Pydantic
│   │   ├── auth.py         # Autenticazione JWT
│   │   ├── database.py     # Configurazione DB
│   │   ├── services/       # Servizi (PDF, Email, 2FA)
│   │   └── templates/      # Template HTML per PDF
│   ├── uploads/            # File caricati (logo, etc.)
│   ├── requirements.txt    # Dipendenze Python
│   └── Dockerfile          # Immagine Docker backend
│
├── frontend/                # Frontend React
│   ├── src/
│   │   ├── pages/          # Pagine principali
│   │   ├── components/     # Componenti riutilizzabili
│   │   ├── store/          # State management (Zustand)
│   │   └── config/         # Configurazione
│   ├── package.json        # Dipendenze Node.js
│   └── Dockerfile          # Immagine Docker frontend
│
├── data/                   # Volume Docker PostgreSQL
├── backups/                # Backup database e codice
├── docker-compose.yml      # Docker Compose sviluppo
├── docker-compose.portainer.yml  # Docker Compose Portainer
├── install.ps1            # Script installazione Windows
├── install.sh              # Script installazione Linux/Mac
├── backup_complete.ps1    # Script backup Windows
├── backup_complete.sh     # Script backup Linux/Mac
└── DOCUMENTAZIONE.md      # Questa documentazione
```

### Componenti Docker

1. **db** (PostgreSQL 15): Database principale
2. **backend** (FastAPI): API REST backend
3. **frontend** (React/Vite): Interfaccia utente

---

## Funzionalità Principali

### 1. Gestione R.I.T. (Rapporti di Intervento Tecnico)

#### Creazione e Modifica RIT
- **Selezione cliente** con ricerca intelligente
- **Gestione multi-sede**: selezione sede specifica per interventi
- **Categorie macro**: IT, Printing & Office, Altro
- **Dettagli intervento**:
  - Asset interessati (seriale, part number, marca/modello)
  - Difetto segnalato e soluzione applicata
  - Ricambi utilizzati dal magazzino
  - Ore lavorate e costi extra
- **Firme digitali**: tecnico e cliente con canvas HTML5
- **Generazione PDF** automatica con:
  - Logo aziendale personalizzabile
  - Dettagli intervento completi
  - Calcoli economici (IVA, totale)
  - Firme digitalizzate
  - Testo privacy footer configurabile

#### Gestione Contratti
- **Contratto assistenza IT**:
  - Scalatura automatica chiamate disponibili
  - Visualizzazione monte ore e chiamate rimanenti
  - Snapshot dei valori nel RIT per tracciabilità storica
- **Prodotti a noleggio**:
  - IT: selezione prodotto a noleggio con sconto 100% su ricambi
  - Printing: gestione letture copie con calcolo eccedenze
  - Azzeramento automatico costi chiamata e ore per contratti noleggio

### 2. Gestione Clienti

#### Anagrafica Completa
- **Dati anagrafici**: ragione sociale, P.IVA, CF, indirizzo
- **Autocompletamento indirizzo** con geocoding Nominatim (proxy backend)
- **Contatti**: telefono, email amministrazione, email tecnica
- **Note**: campo libero per informazioni aggiuntive

#### Gestione Multi-Sede
- **Abilitazione multi-sede**: checkbox per clienti con più sedi
- **Sede legale/centrale operativa**: opzione per trattare la sede legale come sede operativa
- **Gestione sedi**: nome, indirizzo completo, città, CAP, contatti
- **Prevenzione duplicati**: controllo automatico per evitare sedi duplicate

#### Contratti e Noleggio
- **Contratto assistenza IT**:
  - Limite chiamate mensili/annuali
  - Contatore chiamate utilizzate
  - Tariffa oraria e costo chiamata
  - Data inizio e fine contratto
- **Noleggio prodotti**:
  - **IT**: marca, modello, seriale, tipo configurazione, sede ubicazione
  - **Printing**: marca, modello, matricola, colore/B&N, copie incluse mensili, cadenza letture copie (mensile/bimestrale/trimestrale/semestrale), sede ubicazione
  - Data installazione e scadenza noleggio
  - Contatori iniziali (B/N e Colore per Printing)

#### Storico Letture Copie
- Visualizzazione storico letture copie per prodotti Printing
- Mostra ultime 3 letture con date e contatori

### 3. Gestione Magazzino

- **Anagrafica prodotti**:
  - Codice articolo, descrizione, categoria
  - Prezzo vendita, giacenza
  - Note tecniche
- **Ricerca intelligente** per codice o descrizione
- **Gestione giacenze** con aggiornamento automatico all'uso nei RIT
- **Integrazione con RIT**: selezione prodotti da magazzino durante creazione intervento

### 4. Gestione Letture Copie (Printing)

#### Prelievo Copie
- **Checkbox "Prelievo Numero Copie"** nel RIT Printing
- **Visualizzazione macchine** a noleggio del cliente (filtrate per sede selezionata)
- **Campi lettura**:
  - Contatore B/N (obbligatorio)
  - Contatore Colore (se macchina a colori)
- **Validazioni**:
  - Nuove letture >= precedenti
  - Rispetto cadenza minima configurata (mensile/bimestrale/trimestrale/semestrale)
  - Blocco letture premature con messaggio informativo
- **Calcolo automatico**:
  - Copie incluse per periodo (mensili × mesi cadenza)
  - Copie stampate (differenza con lettura precedente)
  - Copie fuori limite e costo extra
  - Dettaglio calcolo salvato nelle note della lettura

#### Storico e Tracciabilità
- Ogni lettura salvata con:
  - Data e ora
  - Contatori B/N e Colore
  - ID tecnico esecutore
  - ID intervento associato
  - Note con dettaglio calcolo

### 5. Gestione Utenti e Permessi

#### Ruoli
- **Superadmin**: accesso completo, gestione 2FA per altri superadmin
- **Admin**: gestione completa esclusa configurazione sistema
- **Operatore**: accesso limitato a funzionalità operative

#### Permessi Granulari
- **Clienti**: visualizza, crea, modifica, elimina
- **Interventi**: visualizza, crea, modifica, elimina, genera PDF
- **Magazzino**: visualizza, crea, modifica, elimina
- **Utenti**: visualizza, crea, modifica, elimina
- **Impostazioni**: visualizza, modifica

#### Autenticazione
- **Login** con email e password
- **2FA (Two-Factor Authentication)**:
  - Opzionale per superadmin
  - Generazione QR code con TOTP
  - Backup codes per recupero
  - Gestione tramite pagina impostazioni utente

### 6. Impostazioni Azienda

#### Dati Azienda
- Nome azienda, indirizzo completo, città, CAP
- P.IVA, CF, telefono, email istituzionale
- Logo aziendale (upload immagine)
- Colore primario per personalizzazione UI

#### SMTP e Email
- **Configurazione SMTP**:
  - Server SMTP, porta
  - Username e password (supporto Gmail App Password)
  - TLS/SSL configurabile
- **Email notifiche**: indirizzo per ricevere alert automatici
- **Email avvisi e promemoria**: indirizzo separato per notifiche contratti e letture copie

#### Privacy Footer
- Testo privacy personalizzabile per PDF RIT
- Visualizzato sotto le firme nel PDF

#### Tariffe
- Tariffe per categoria macro (IT, Printing & Office, Altro)
- Tariffa oraria e costo chiamata configurabili

### 7. Notifiche Automatiche

#### Scadenze Contratti
- **Scheduler settimanale** (ogni lunedì alle 9:00)
- **Controllo scadenze**:
  - Contratti noleggio (IT e Printing): 30 giorni prima
  - Contratti assistenza: 30 giorni prima
- **Email inviate a**:
  - Email azienda (email_avvisi_promemoria)
  - Email cliente principale
  - Email sedi (se configurate)
- **Contenuto email**:
  - Tipo contratto (noleggio/assistenza)
  - Cliente e sede interessata
  - Giorni alla scadenza
  - Dettagli asset/contratto

#### Scadenze Letture Copie
- **Scheduler giornaliero** (ogni giorno alle 9:00)
- **Controllo letture**:
  - Verifica ultima lettura per ogni prodotto Printing a noleggio
  - Calcolo prossima lettura dovuta in base a cadenza configurata
  - Alert 7 giorni prima della scadenza
- **Email inviate a**: email_avvisi_promemoria
- **Contenuto email**:
  - Cliente e macchine interessate
  - Ultima lettura effettuata
  - Prossima lettura dovuta
  - Invito a prendere appuntamento

### 8. Archivio e Ricerca

#### Archivio RIT
- **Lista completa** interventi con filtri
- **Ricerca intelligente** per:
  - Numero RIT
  - Cliente (ragione sociale)
  - Seriale asset
  - Part number
  - Marca/modello prodotto
  - Descrizione ricambio utilizzato
- **Visualizzazione dettagli**:
  - Numero relazione, data, cliente
  - Categoria macro, stato
  - Link per modifica e download PDF

#### Archivio Clienti
- Lista completa con ricerca per:
  - Ragione sociale
  - P.IVA
  - Codice fiscale

---

## Installazione

### Prerequisiti

- **Docker Desktop** (Windows/Mac) o **Docker Engine + Docker Compose** (Linux)
- **Privilegi amministratore** per eseguire gli script

### Installazione Windows

1. Esegui PowerShell come **Amministratore**
2. Naviga nella directory del progetto
3. Esegui:
   ```powershell
   .\install.ps1
   ```
4. Opzionale: specifica directory installazione personalizzata:
   ```powershell
   .\install.ps1 -InstallPath "D:\Sistema54"
   ```

### Installazione Linux/Mac

1. Esegui con privilegi root:
   ```bash
   sudo ./install.sh
   ```
2. Opzionale: specifica directory installazione:
   ```bash
   sudo INSTALL_PATH=/opt/sistema54 ./install.sh
   ```

### Verifica Installazione

Dopo l'installazione, verifica che i container siano in esecuzione:

```bash
docker compose ps
```

Dovresti vedere 3 container attivi:
- `sistema54_db`
- `sistema54_backend`
- `sistema54_frontend`

### Creazione Utente Admin

Dopo l'avvio dei container, crea il primo utente admin:

```bash
docker compose exec backend python create_admin.py
```

Segui le istruzioni per inserire email e password.

### Accesso Applicazione

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

---

## Configurazione

### Variabili d'Ambiente

Crea un file `.env` nella root del progetto (o modifica quello esistente):

```env
# Database
POSTGRES_USER=admin
POSTGRES_PASSWORD=sistema54secure
POSTGRES_DB=sistema54_db
POSTGRES_PORT=5432

# Backend
DATABASE_URL=postgresql://admin:sistema54secure@db:5432/sistema54_db

# Frontend
VITE_API_URL=http://localhost:8000

# Porte (per Portainer)
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

### Configurazione SMTP

1. Accedi all'applicazione come admin
2. Vai su **Impostazioni** (menu admin)
3. Compila i campi SMTP:
   - **Server SMTP**: es. `smtp.gmail.com`
   - **Porta**: es. `587` (TLS) o `465` (SSL)
   - **Username**: email Gmail
   - **Password**: App Password Gmail (non password normale)
   - **Usa TLS**: abilita per porta 587
4. **Email avvisi e promemoria**: indirizzo per ricevere notifiche automatiche
5. Salva le impostazioni

### Configurazione Privacy Footer

1. Vai su **Impostazioni**
2. Compila il campo **Testo Privacy Footer**
3. Il testo verrà visualizzato sotto le firme nel PDF RIT

---

## Backup e Ripristino

### Backup Completo

Gli script di backup creano **due file ZIP separati**:

1. **backup_database_YYYYMMDD_HHMMSS.zip**: contiene
   - `schema.sql`: struttura database
   - `data.sql`: solo dati
   - `full_backup.sql`: backup completo (schema + dati)

2. **backup_code_YYYYMMDD_HHMMSS.zip**: contiene tutto il codice sorgente esclusi:
   - `node_modules/`
   - `__pycache__/`
   - `data/` (volume Docker)
   - `backups/`
   - File temporanei e cache

#### Windows

```powershell
.\backup_complete.ps1
```

#### Linux/Mac

```bash
./backup_complete.sh
```

I file vengono salvati nella directory `./backups/`.

### Ripristino Database

1. Estrai il file `full_backup.sql` dall'archivio database
2. Importa nel database:
   ```bash
   docker compose exec -T db psql -U admin sistema54_db < full_backup.sql
   ```

### Ripristino Codice

1. Estrai l'archivio codice nella directory desiderata
2. Esegui l'installazione normalmente

---

## Deploy su Portainer

### Preparazione

1. Carica il progetto su un server con Portainer installato
2. Assicurati che Docker Compose sia disponibile

### Creazione Stack in Portainer

1. Accedi a Portainer
2. Vai su **Stacks** → **Add Stack**
3. Nome stack: `sistema54`
4. Seleziona **Web editor** o carica `docker-compose.portainer.yml`
5. Configura le variabili d'ambiente se necessario
6. Clicca **Deploy the stack**

### Configurazione Volumi

Portainer creerà automaticamente i volumi:
- `sistema54_postgres_data`: dati database persistenti
- `sistema54_backend_cache`: cache Python backend
- `sistema54_frontend_cache`: cache Vite frontend

### Accesso Applicazione

Dopo il deploy, accedi all'applicazione tramite:
- **Frontend**: `http://<server-ip>:3000`
- **Backend**: `http://<server-ip>:8000`

### Aggiornamento Stack

1. Modifica `docker-compose.portainer.yml` se necessario
2. In Portainer: **Stacks** → `sistema54` → **Editor**
3. Incolla il nuovo contenuto
4. Clicca **Update the stack**

---

## API Endpoints

### Autenticazione

- `POST /api/auth/login` - Login utente
- `POST /api/auth/register` - Registrazione nuovo utente
- `GET /api/auth/me` - Info utente corrente
- `POST /api/auth/verify-2fa` - Verifica codice 2FA
- `GET /api/auth/2fa/qr` - Genera QR code 2FA
- `POST /api/auth/2fa/enable` - Abilita 2FA
- `POST /api/auth/2fa/disable` - Disabilita 2FA

### Clienti

- `GET /clienti/` - Lista clienti (con ricerca `?q=term`)
- `GET /clienti/{id}` - Dettaglio cliente
- `POST /clienti/` - Crea cliente
- `PUT /clienti/{id}` - Aggiorna cliente
- `DELETE /clienti/{id}` - Elimina cliente
- `GET /clienti/{id}/sedi` - Lista sedi cliente

### Interventi (RIT)

- `GET /interventi/` - Lista interventi (con ricerca `?q=term`)
- `GET /interventi/{id}` - Dettaglio intervento
- `POST /interventi/` - Crea intervento
- `PUT /interventi/{id}` - Aggiorna intervento
- `DELETE /interventi/{id}` - Elimina intervento
- `GET /interventi/{id}/pdf` - Download PDF RIT

### Letture Copie

- `GET /letture-copie/asset/{asset_id}/ultima` - Ultima lettura asset
- `GET /letture-copie/asset/{asset_id}/all` - Tutte le letture asset
- `POST /letture-copie/` - Crea nuova lettura

### Magazzino

- `GET /magazzino/` - Lista prodotti (con ricerca `?q=term`)
- `GET /magazzino/{id}` - Dettaglio prodotto
- `POST /magazzino/` - Crea prodotto
- `PUT /magazzino/{id}` - Aggiorna prodotto
- `DELETE /magazzino/{id}` - Elimina prodotto

### Utenti

- `GET /api/users/` - Lista utenti
- `GET /api/users/{id}` - Dettaglio utente
- `POST /api/users/` - Crea utente
- `PUT /api/users/{id}` - Aggiorna utente
- `DELETE /api/users/{id}` - Elimina utente

### Impostazioni

- `GET /impostazioni/` - Impostazioni azienda (autenticato)
- `GET /impostazioni/public` - Impostazioni pubbliche (logo, nome, colore)
- `PUT /impostazioni/` - Aggiorna impostazioni

### Geocoding

- `GET /api/geocoding/search?q={query}` - Ricerca indirizzi (proxy Nominatim)

---

## Database

### Modelli Principali

#### Cliente
- Dati anagrafici completi
- Flag multi-sede e sede legale operativa
- Contratto assistenza (limite chiamate, tariffe)
- Relazione con `SedeCliente` e `AssetCliente`

#### SedeCliente
- Nome sede, indirizzo completo
- Contatti (telefono, email)
- Relazione con `Cliente`

#### AssetCliente
- Tipo asset (IT/Printing)
- Dati tecnici (marca, modello, seriale/matricola)
- Configurazione noleggio (copie incluse, cadenza letture)
- Sede ubicazione (`sede_id`)
- Relazione con `Cliente` e `LetturaCopie`

#### Intervento (RIT)
- Dettagli intervento completi
- Macro categoria, stato
- Firme digitali (base64)
- Snapshot contatori contratto assistenza
- Relazione con `Cliente`, `DettaglioAsset`, `RicambioUtilizzato`

#### LetturaCopie
- Data lettura, contatori B/N e Colore
- Note con dettaglio calcolo
- Relazione con `AssetCliente` e `Intervento`

#### Magazzino
- Codice articolo, descrizione, categoria
- Prezzo vendita, giacenza

#### Utente
- Dati autenticazione (email, password hash)
- Ruolo e permessi granulari
- 2FA (secret, backup codes)

#### ImpostazioniAzienda
- Dati azienda completi
- Configurazione SMTP
- Tariffe per categoria
- Testo privacy footer

### Migrazioni

Il progetto include script di migrazione Python per aggiungere nuove colonne/tabelle:

- `migrate_2fa.py` - Autenticazione a due fattori
- `migrate_letture_copie.py` - Sistema letture copie
- `migrate_multisede.py` - Gestione multi-sede
- `migrate_cadenza_letture.py` - Parametro cadenza letture
- E altri...

Esegui le migrazioni manualmente se necessario:

```bash
docker compose exec backend python migrate_<nome>.py
```

---

## Sicurezza

### Autenticazione

- **JWT Tokens**: validità limitata, refresh automatico
- **Password Hashing**: bcrypt con salt
- **2FA Opzionale**: TOTP per superadmin

### Autorizzazione

- **Ruoli**: Superadmin, Admin, Operatore
- **Permessi granulari**: controllo fine per ogni operazione
- **Protezione route**: middleware per verificare permessi

### CORS

- Configurato per permettere richieste dal frontend
- In produzione, restringere `allow_origins` al dominio specifico

### Validazione Dati

- **Backend**: Pydantic schemas per validazione input
- **Frontend**: React Hook Form + Zod per validazione client-side

### Database

- **Credenziali**: configurabili tramite variabili d'ambiente
- **Connessioni**: pool di connessioni SQLAlchemy
- **Backup**: script automatici per backup regolari

---

## Manutenzione

### Logs

Visualizza logs dei container:

```bash
# Tutti i container
docker compose logs -f

# Singolo container
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

### Aggiornamento

1. **Backup completo** prima di aggiornare
2. **Pull ultime modifiche** codice
3. **Rebuild immagini**:
   ```bash
   docker compose build --no-cache
   ```
4. **Riavvia container**:
   ```bash
   docker compose down
   docker compose up -d
   ```

### Pulizia

Rimuovi container, immagini e volumi non utilizzati:

```bash
docker compose down -v  # ATTENZIONE: elimina anche i dati del database!
docker system prune -a  # Rimuove immagini non utilizzate
```

### Monitoraggio

- **Health checks**: configurati per tutti i servizi
- **Scheduler**: verifica esecuzione job automatici nei logs backend

---

## Supporto e Contatti

Per problemi o domande:
1. Consulta questa documentazione
2. Verifica i logs dei container
3. Controlla la configurazione SMTP e database
4. Verifica che tutti i container siano in esecuzione

---

**Versione Documentazione**: 1.0  
**Data Ultima Revisione**: Dicembre 2024  
**Sistema54 Digital** - CMMS Completo per Gestione Interventi Tecnici

