# Guida pgAdmin - Gestione Web Database PostgreSQL

pgAdmin è un'interfaccia web completa per gestire il database PostgreSQL di SISTEMA54.

## 🚀 Accesso a pgAdmin

### URL di Accesso

- **URL**: `http://IP_SERVER:5050` (o `http://localhost:5050` se in locale)
- **Email**: `admin@sistema54.com`
- **Password**: `sistema54admin`

## 📋 Primo Accesso

### Passo 1: Login

1. Apri il browser e vai su `http://IP_SERVER:5050`
2. Inserisci le credenziali:
   - **Email**: `admin@sistema54.com`
   - **Password**: `sistema54admin`
3. Clicca **Login**

### Passo 2: Aggiungi Server PostgreSQL

Dopo il login, devi aggiungere il server PostgreSQL:

1. Clicca con il tasto destro su **Servers** nel pannello sinistro
2. Seleziona **Register** → **Server**

3. Nella tab **General**:
   - **Name**: `SISTEMA54 Database` (o qualsiasi nome)

4. Nella tab **Connection**:
   - **Host name/address**: `db` (⚠️ usa il nome del container Docker, NON l'IP!)
   - **Port**: `5432`
   - **Maintenance database**: `sistema54_db`
   - **Username**: `admin` (⚠️ solo "admin", NON "admin@sistema54.com"!)
   - **Password**: `sistema54secure`
   - ✅ **Save password** (spunta questa opzione)
   
   **⚠️ ATTENZIONE**: 
   - Le credenziali di pgAdmin (`admin@sistema54.com` / `sistema54admin`) sono solo per l'interfaccia web
   - Le credenziali PostgreSQL (`admin` / `sistema54secure`) sono per il database
   - **NON confondere le due!**

5. Clicca **Save**

## 🎯 Funzionalità Principali

### Visualizzare Tabelle e Dati

1. Espandi **Servers** → **SISTEMA54 Database** → **Databases** → **sistema54_db** → **Schemas** → **public** → **Tables**
2. Clicca su una tabella per visualizzarne i dati
3. Usa la tab **Data** per vedere i record

### Eseguire Query SQL

1. Clicca su **Tools** → **Query Tool** (o premi `Alt+Shift+Q`)
2. Scrivi la tua query SQL:
   ```sql
   SELECT * FROM utenti;
   SELECT COUNT(*) FROM clienti;
   ```
3. Clicca **Execute** (o premi `F5`)

### Importare Backup

⚠️ **IMPORTANTE**: Prima di importare un backup, assicurati di aver fatto un backup del database corrente!

#### Metodo 1: Restore tramite pgAdmin (per file `.sql` o `.backup`)

1. **Trova il file di backup**:
   - I backup sono nella cartella `./backups/` del progetto
   - Nome formato: `sistema54_db_backup_YYYYMMDD_HHMMSS.sql`
   - Esempio: `sistema54_db_backup_20250115_143022.sql`

2. **In pgAdmin**:
   - Clicca con il tasto destro sul database `sistema54_db` (non sul server!)
   - Seleziona **Restore...**

3. **Tab General**:
   - **Filename**: Clicca sul pulsante **...** e seleziona il file `.sql` di backup
     - Se il file è sul tuo PC, puoi selezionarlo direttamente
     - pgAdmin caricherà il file automaticamente

4. **Tab Restore options** (opzionale, ma consigliato):
   - ✅ **Pre-data** (include CREATE statements - crea tabelle, sequenze, etc.)
   - ✅ **Data** (include INSERT statements - inserisce i dati)
   - ✅ **Post-data** (include indexes, constraints - crea indici e vincoli)
   - ⚠️ **Clean before restore**: Spunta questa opzione se vuoi eliminare i dati esistenti prima di ripristinare

5. **Clicca Restore** e attendi il completamento

#### Metodo 2: Restore Tool di pgAdmin (SOLO per file formato CUSTOM/TAR)

⚠️ **IMPORTANTE**: 
- **Restore Tool** funziona SOLO con file in formato **CUSTOM** (`.backup`) o **TAR**
- **NON funziona** con file SQL in formato testo (`.sql`) che contengono `COPY ... FROM stdin;`
- Se hai un file `.sql`, usa il **Metodo 3** (docker exec) o crea un nuovo backup in formato custom

**Se hai un file `.backup` (formato custom):**

1. **Apri Restore Tool**: 
   - In pgAdmin, clicca con il tasto destro su `sistema54_db` (non sul server!)
   - Seleziona **Restore...**

2. **Configura il restore**:
   - **Filename**: Clicca sul pulsante **...** e seleziona il file `.backup` dalla cartella `backups/`
   - **Format**: Dovrebbe essere automaticamente rilevato come "Custom or tar"
   - **Role name**: Lascia vuoto o seleziona "admin"
   - **Pre-data**, **Data**, **Post-data**: Lascia tutto selezionato (default)

3. **Avvia il restore**:
   - Clicca **Restore** in basso
   - ⚠️ **ATTENZIONE**: Questo processo può richiedere alcuni minuti
   - Non chiudere la finestra durante l'esecuzione!

4. **Verifica il risultato**:
   - Controlla il pannello **Messages** in basso per eventuali errori
   - Se vedi "Process completed successfully", l'importazione è completata

**Per creare un backup in formato custom (compatibile con Restore Tool):**

**Opzione 1: Dal server remoto (via SSH o Portainer Console):**
```bash
# Se hai accesso SSH al server, esegui:
./backup_database_custom.sh

# Oppure se la console Portainer funziona:
# 1. Portainer -> Containers -> sistema54_db -> Console
# 2. Esegui i comandi manualmente (vedi sotto)
```

**Opzione 2: Comandi manuali (se gli script non funzionano):**

Se hai accesso alla console del container o al server:

```bash
# 1. Crea il backup nel container
docker exec sistema54_db pg_dump -U admin -d sistema54_db -Fc -f /tmp/backup_custom.backup

# 2. Copia il file dal container al server (se necessario)
docker cp sistema54_db:/tmp/backup_custom.backup /path/on/server/backup_custom.backup

# 3. Scarica il file dal server al tuo PC (via SCP/SFTP o Portainer file browser)
```

**Opzione 3: Dal PC Windows (se Docker Desktop è in esecuzione):**
```powershell
.\backup_database_custom.ps1
```

#### Metodo 3: Importazione diretta via Docker (CONSIGLIATO per file SQL)

⚠️ **IMPORTANTE**: Questo metodo funziona con file SQL in formato testo (`.sql`), che **NON possono** essere importati con pgAdmin Restore Tool.

**Se la console Portainer non funziona, usa questo script PowerShell:**

```powershell
# Importa direttamente il file SQL nel database
.\restore_database_portainer.ps1 -BackupFile ".\backups\backup_fixed.sql"
```

Lo script:
1. Verifica che il container `sistema54_db` sia in esecuzione
2. Importa il file SQL direttamente usando `psql` (non `pg_restore`)
3. Verifica che i dati siano stati importati correttamente

**Se il container ha un nome diverso:**
```powershell
.\restore_database_portainer.ps1 -BackupFile ".\backups\backup_fixed.sql" -ContainerName "NOME_CONTAINER"
```

**Metodo manuale (se hai accesso SSH al server):**

Se hai accesso SSH al server dove gira Portainer:

```bash
# Dal tuo PC, copia il file sul server
scp backups/backup_fixed.sql user@server:/tmp/backup.sql

# Dal server (via SSH), importa direttamente:
cat /tmp/backup.sql | docker exec -i sistema54_db psql -U admin -d sistema54_db
```

**Oppure copia nel container e importa:**

```bash
# Copia il file nel container del database
docker cp /tmp/backup.sql sistema54_db:/tmp/backup.sql

# Importa il backup usando psql direttamente
docker exec -i sistema54_db psql -U admin -d sistema54_db < /tmp/backup.sql
```

**Passo 4: Verifica l'importazione**

```powershell
# Controlla che i dati siano stati importati
docker exec sistema54_db psql -U admin -d sistema54_db -c "SELECT COUNT(*) FROM utenti;"
docker exec sistema54_db psql -U admin -d sistema54_db -c "SELECT COUNT(*) FROM clienti;"
```

#### Metodo 4: Caricare file nel container pgAdmin (alternativa)

Se vuoi comunque usare pgAdmin dopo aver copiato il file:

1. **Copia il file nel container pgAdmin**:
   ```powershell
   # Windows PowerShell
   docker cp .\backups\sistema54_db_backup_YYYYMMDD_HHMMSS.sql sistema54_pgadmin:/tmp/backup.sql
   ```

2. **In pgAdmin**, quando selezioni il file:
   - Usa il percorso: `/tmp/backup.sql`

#### Verifica dopo il restore

Dopo aver ripristinato il backup, verifica che tutto sia corretto:

```sql
-- Conta i record nelle tabelle principali
SELECT 'utenti' as tabella, COUNT(*) as record FROM utenti
UNION ALL
SELECT 'clienti', COUNT(*) FROM clienti
UNION ALL
SELECT 'interventi', COUNT(*) FROM interventi
UNION ALL
SELECT 'prodotti', COUNT(*) FROM prodotti;
```

#### Risoluzione problemi

**Errore: "File not found"**
- Verifica che il percorso del file sia corretto
- Se il file è sul PC, assicurati di averlo selezionato correttamente
- Usa il Metodo 3 per copiare il file nel container

**Errore: "Permission denied"**
- Verifica che il file non sia aperto in un altro programma
- Controlla i permessi del file

**Errore: "Invalid encoding"**
- Se vedi errori di encoding UTF-8, usa lo script `fix_backup_encoding.ps1` prima di importare

### Esportare Backup

1. Clicca con il tasto destro sul database `sistema54_db`
2. Seleziona **Backup...**
3. Nella tab **General**:
   - **Filename**: scegli dove salvare (es: `/tmp/backup.sql`)
   - **Format**: `Plain` (per file `.sql`)
4. Nella tab **Data/Objects**:
   - ✅ **Pre-data** (include CREATE statements)
   - ✅ **Data** (include INSERT statements)
   - ✅ **Post-data** (include indexes, constraints)
5. Clicca **Backup**

### Modificare Dati

1. Apri una tabella (doppio click)
2. Nella tab **Data**, modifica i valori direttamente nelle celle
3. Clicca **Save** per salvare le modifiche

### Creare Nuove Tabelle

1. Clicca con il tasto destro su **Tables** → **Create** → **Table...**
2. Inserisci:
   - **Name**: nome della tabella
   - **Columns**: aggiungi le colonne con tipo e vincoli
3. Clicca **Save**

### Eseguire Script SQL

1. Apri **Query Tool** (`Alt+Shift+Q`)
2. Incolla il tuo script SQL
3. Clicca **Execute** (`F5`)

## 🔧 Configurazione Avanzata

### Cambiare Password di Accesso

1. Clicca su **File** → **Preferences**
2. Vai su **Miscellaneous** → **User Language**
3. Per cambiare la password di pgAdmin:
   - Clicca sul tuo profilo (in alto a destra) → **Change Password**

### Modificare Credenziali Server

1. Clicca con il tasto destro sul server → **Properties**
2. Modifica le credenziali nella tab **Connection**
3. Clicca **Save**

## 📊 Query Utili per SISTEMA54

### Contare Record per Tabella

```sql
SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

### Visualizzare Tutte le Tabelle

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Verificare Dimensione Database

```sql
SELECT 
    pg_size_pretty(pg_database_size('sistema54_db')) as database_size;
```

### Verificare Dimensione Tabelle

```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Cercare in Tutte le Tabelle

```sql
-- Esempio: cercare "test" in tutte le colonne di testo
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND data_type IN ('text', 'varchar', 'character varying');
```

## 🐛 Risoluzione Problemi

### pgAdmin non è disponibile dopo l'aggiornamento dello stack

**Problema**: Dopo aver aggiornato il docker-compose in Portainer, pgAdmin non appare.

**Soluzione:**

1. **Verifica che il servizio sia nello stack:**
   - Portainer → **Stacks** → `sistema54` → **Editor**
   - Verifica che ci sia la sezione `pgadmin:` nel file

2. **Rimuovi e ricrea lo stack (se necessario):**
   - Portainer → **Stacks** → `sistema54` → **Editor**
   - Clicca **Update the stack**
   - Se pgAdmin non appare ancora, prova a:
     - **Rimuovi lo stack** (attenzione: questo fermerà tutti i container)
     - **Ricrea lo stack** con il nuovo docker-compose

3. **Avvia manualmente il container pgAdmin:**
   - Portainer → **Containers**
   - Cerca `sistema54_pgadmin`
   - Se non esiste, vai su **Stacks** → `sistema54` → **Editor** → **Update the stack**
   - Se esiste ma è fermo, clicca **Start**

4. **Verifica i log del container:**
   - Portainer → **Containers** → `sistema54_pgadmin` → **Logs**
   - Cerca errori di avvio

5. **Verifica che la porta 5050 non sia già in uso:**
   - Portainer → **Containers**
   - Controlla se qualche altro container usa la porta 5050
   - Se sì, cambia la porta nel docker-compose:
     ```yaml
     ports:
       - "5051:80"  # Cambia 5050 in 5051 o altra porta libera
     ```

### Errore: "Unable to connect to server" o "password authentication failed"

⚠️ **ERRORE COMUNE**: Stai usando le credenziali di pgAdmin invece di quelle del database PostgreSQL!

**Credenziali CORRETTE per PostgreSQL:**
- **Host**: `db` (nome del container Docker, NON l'IP!)
- **Port**: `5432`
- **Username**: `admin` (NON `admin@sistema54.com`!)
- **Password**: `sistema54secure`
- **Database**: `sistema54_db`

**Soluzione:**
1. Vai su **Servers** → clicca con il tasto destro sul server → **Properties**
2. Tab **Connection**:
   - **Host name/address**: `db` (usa il nome del container, non l'IP `172.20.0.2`)
   - **Port**: `5432`
   - **Maintenance database**: `sistema54_db`
   - **Username**: `admin` (solo questo, senza `@sistema54.com`)
   - **Password**: `sistema54secure`
   - ✅ **Save password**
3. Clicca **Save**

**Nota importante:**
- Le credenziali di **pgAdmin** (`admin@sistema54.com` / `sistema54admin`) servono solo per accedere all'interfaccia web
- Le credenziali di **PostgreSQL** (`admin` / `sistema54secure`) servono per connettersi al database
- Sono **due cose diverse**!

### Errore: "Password required"

**Soluzione:**
1. Vai nelle proprietà del server
2. Inserisci la password nella tab **Connection**
3. ✅ Spunta **Save password**

### pgAdmin non si avvia o ha errori

**Passo 1: Verifica i log del container**

In Portainer:
1. Vai su **Containers** → `sistema54_pgadmin` → **Logs**
2. Cerca errori comuni (vedi sotto)

**Errori comuni e soluzioni:**

#### Errore: "Permission denied" o "Cannot write to /var/lib/pgadmin"

**Soluzione:**
```yaml
# Aggiungi user mapping nel docker-compose
pgadmin:
  # ... altre configurazioni ...
  user: "5050:5050"  # Aggiungi questa riga
```

#### Errore: "Port 5050 is already allocated"

**Soluzione:**
1. Cambia la porta nel docker-compose:
   ```yaml
   ports:
     - "5051:80"  # Cambia 5050 in 5051
   ```
2. Aggiorna lo stack

#### Errore: "Failed to start pgAdmin"

**Soluzione:**
1. Rimuovi il volume e ricrea:
   - Portainer → **Volumes** → `sistema54_pgadmin_data` → **Remove**
   - Aggiorna lo stack per ricreare il volume

#### Errore: "Database connection failed" o "Cannot connect to PostgreSQL"

**Soluzione:**
- Questo è normale all'avvio, pgAdmin si connette solo quando aggiungi il server manualmente
- Verifica che il container `sistema54_db` sia in esecuzione

#### Errore: "Configuration file not found"

**Soluzione:**
1. Verifica che il volume sia montato correttamente
2. Riavvia il container: **Containers** → `sistema54_pgadmin` → **Restart`

#### Errore: "Timeout" o "Connection refused"

**Soluzione:**
1. Verifica che il container sia completamente avviato (attendi 30-60 secondi)
2. Controlla che la rete Docker sia corretta:
   - Entrambi i container (`sistema54_db` e `sistema54_pgadmin`) devono essere sulla stessa rete `sistema54-network`

**Se gli errori persistono:**
1. Ferma il container: **Containers** → `sistema54_pgadmin` → **Stop**
2. Rimuovi il container: **Containers** → `sistema54_pgadmin` → **Remove**
3. Rimuovi il volume (opzionale, perderai le configurazioni): **Volumes** → `sistema54_pgadmin_data` → **Remove**
4. Aggiorna lo stack: **Stacks** → `sistema54` → **Editor** → **Update the stack**

### Non vedo le tabelle

**Soluzione:**
1. Assicurati di aver espanso: **Servers** → **SISTEMA54 Database** → **Databases** → **sistema54_db** → **Schemas** → **public** → **Tables**
2. Clicca **Refresh** (F5) sul database

## 🔒 Sicurezza

⚠️ **IMPORTANTE**: 

- pgAdmin è accessibile su `http://IP_SERVER:5050` senza HTTPS
- Cambia la password di default in produzione
- Considera di limitare l'accesso alla porta 5050 con un firewall
- Non esporre pgAdmin su internet senza autenticazione aggiuntiva

### Cambiare Password pgAdmin

Modifica nel `docker-compose.portainer.yml`:
```yaml
environment:
  PGADMIN_DEFAULT_PASSWORD: tua_password_sicura
```

Poi riavvia il container.

## 📚 Risorse

- [Documentazione pgAdmin](https://www.pgadmin.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## ✅ Checklist Post-Setup

- [ ] Accesso a pgAdmin funzionante
- [ ] Server PostgreSQL aggiunto e connesso
- [ ] Visualizzazione tabelle funzionante
- [ ] Query Tool testato
- [ ] Backup/restore testato
- [ ] Password cambiata (se in produzione)

