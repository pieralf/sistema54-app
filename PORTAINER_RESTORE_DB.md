# Guida Importazione Backup Database in Portainer

Questa guida spiega come importare un backup del database PostgreSQL nel container `sistema54_db` gestito da Portainer.

## 📋 Prerequisiti

- Il container `sistema54_db` deve essere in esecuzione
- Avere accesso a Portainer
- Avere il file di backup (`.sql` o `.zip`)

## 🛠️ Script di Pulizia File Backup

Se ricevi errori di encoding (`invalid byte sequence for encoding UTF8: 0xff`), usa gli script di pulizia:

**Linux/Mac:**
```bash
chmod +x fix_backup_encoding.sh
./fix_backup_encoding.sh backup.sql backup_clean.sql
```

**Windows PowerShell:**
```powershell
.\fix_backup_encoding.ps1 -InputFile backup.sql -OutputFile backup_clean.sql
```

Poi importa il file pulito invece dell'originale.

## 🔧 Metodo 1: Console Portainer (CONSIGLIATO)

### Passo 1: Accedi al Container

1. Apri **Portainer** → **Containers**
2. Cerca e clicca sul container `sistema54_db`
3. Clicca sulla tab **Console**
4. Seleziona:
   - **Command**: `/bin/sh` (o `/bin/bash` se disponibile)
   - **User**: `root` (o lascia vuoto)
5. Clicca **Connect**

### Passo 2: Carica il File di Backup

**Opzione A: Se hai già il file sul server**

1. Carica il file di backup sul server dove gira Portainer
2. Copia il file nel container:
   ```bash
   # Dal terminale del server (non dalla console Portainer)
   docker cp /path/to/backup.sql sistema54_db:/tmp/backup.sql
   ```

**Opzione B: Carica tramite Portainer**

1. Nella console del container, crea un file temporaneo:
   ```bash
   touch /tmp/backup.sql
   ```
2. Clicca su **Upload file** nella console Portainer (se disponibile)
3. Seleziona il file di backup e caricalo in `/tmp/backup.sql`

**Opzione C: Incolla il contenuto direttamente**

1. Se il backup è piccolo, puoi incollarlo direttamente nella console
2. Crea un file e incolla il contenuto:
   ```bash
   cat > /tmp/backup.sql << 'EOF'
   [incolla qui il contenuto del backup SQL]
   EOF
   ```

### Passo 3: Importa il Backup

⚠️ **ATTENZIONE**: Questo processo sovrascriverà il database corrente!

Nella console del container, esegui:

```bash
# Verifica che il file esista
ls -lh /tmp/backup.sql

# Se il backup è compresso (.zip), decomprimi prima
# unzip /tmp/backup.zip -d /tmp/

# Importa il backup
psql -U admin -d sistema54_db < /tmp/backup.sql

# Oppure se il file è compresso con gzip
# gunzip -c /tmp/backup.sql.gz | psql -U admin -d sistema54_db
```

### Passo 4: Verifica l'Importazione

```bash
# Controlla le tabelle importate
psql -U admin -d sistema54_db -c "\dt"

# Conta i record in una tabella di esempio
psql -U admin -d sistema54_db -c "SELECT COUNT(*) FROM utenti;"
```

## 🔧 Metodo 2: Docker Exec da Terminale Server

Se hai accesso SSH al server dove gira Portainer:

### Passo 1: Verifica il Tipo di File

⚠️ **IMPORTANTE**: Se ricevi l'errore `invalid byte sequence for encoding "UTF8": 0xff`, il file è probabilmente compresso o corrotto.

```bash
# Verifica il tipo di file
file /path/to/backup.sql

# Se è un file ZIP, vedrai: "Zip archive data"
# Se è un file SQL valido, vedrai: "ASCII text" o "UTF-8 Unicode text"
```

### Passo 2: Decomprimi se Necessario

**Se il file è un `.zip`:**

```bash
# Decomprimi il file ZIP
unzip backup.zip -d /tmp/

# Verifica che il file SQL sia stato estratto
ls -lh /tmp/*.sql

# Se il file estratto è ancora compresso (.gz), decomprimilo
gunzip /tmp/backup.sql.gz
```

**Se il file è un `.gz`:**

```bash
# Decomprimi direttamente
gunzip backup.sql.gz

# Oppure decomprimi senza rimuovere l'originale
gunzip -c backup.sql.gz > backup_decompressed.sql
```

### Passo 3: Pulisci il File da Caratteri Non Validi (se necessario)

Se il file contiene ancora caratteri non validi (errore `0xff`):

```bash
# Metodo 1: Usa iconv per rimuovere caratteri non validi (CONSIGLIATO)
iconv -f UTF-8 -t UTF-8 -c /tmp/backup.sql > /tmp/backup_clean.sql

# Metodo 2: Rimuovi BOM e caratteri non stampabili con sed
sed '1s/^\xEF\xBB\xBF//' /tmp/backup.sql | sed 's/[^\x00-\x7F]//g' > /tmp/backup_clean.sql

# Metodo 3: Usa dos2unix per convertire fine riga (se creato su Windows)
dos2unix /tmp/backup.sql
iconv -f UTF-8 -t UTF-8 -c /tmp/backup.sql > /tmp/backup_clean.sql

# Metodo 4: Rimuovi solo caratteri di controllo mantenendo UTF-8 valido
grep -v $'\xff' /tmp/backup.sql > /tmp/backup_clean.sql
iconv -f UTF-8 -t UTF-8 -c /tmp/backup_clean.sql > /tmp/backup_final.sql
mv /tmp/backup_final.sql /tmp/backup_clean.sql
```

**Verifica che il file pulito sia valido:**
```bash
# Controlla che sia testo valido
file /tmp/backup_clean.sql

# Controlla le prime righe
head -20 /tmp/backup_clean.sql

# Dovresti vedere qualcosa come:
# -- PostgreSQL database dump
# SET client_encoding = 'UTF8';
# ...
```

### Passo 4: Carica il File sul Server

```bash
# Usa SCP, SFTP o altro metodo per copiare il backup sul server
scp backup.sql user@server:/tmp/backup.sql

# Oppure se hai già il file sul server, assicurati che sia decompresso
```

### Passo 5: Copia nel Container

```bash
docker cp /tmp/backup.sql sistema54_db:/tmp/backup.sql

# Verifica che il file sia stato copiato correttamente
docker exec sistema54_db ls -lh /tmp/backup.sql
```

### Passo 6: Importa il Backup

```bash
# Metodo 1: Redirezione input (CONSIGLIATO per file grandi)
docker exec -i sistema54_db psql -U admin -d sistema54_db < /tmp/backup.sql

# Metodo 2: Eseguendo psql nel container (per file piccoli)
docker exec sistema54_db psql -U admin -d sistema54_db -f /tmp/backup.sql

# Metodo 3: Con encoding esplicito (se ci sono ancora problemi)
docker exec -i sistema54_db env PGCLIENTENCODING=UTF8 psql -U admin -d sistema54_db < /tmp/backup.sql
```

### Passo 7: Pulisci i File Temporanei

```bash
# Rimuovi dal container
docker exec sistema54_db rm /tmp/backup.sql

# Rimuovi dal server (opzionale)
rm /tmp/backup.sql
```

## 🔧 Metodo 3: Volume Mount Temporaneo

Se il backup è grande o preferisci un approccio più diretto:

### Passo 1: Modifica Temporaneamente docker-compose.portainer.yml

Aggiungi un volume mount temporaneo al servizio `db`:

```yaml
db:
  # ... altre configurazioni ...
  volumes:
    - sistema54_postgres_data:/var/lib/postgresql/data
    - /path/to/backups:/backups:ro  # Mount read-only della cartella backup
```

### Passo 2: Aggiorna lo Stack

1. In Portainer → **Stacks** → `sistema54` → **Editor**
2. Incolla la modifica
3. Clicca **Update the stack**

### Passo 3: Importa il Backup

Nella console del container:

```bash
psql -U admin -d sistema54_db < /backups/backup.sql
```

### Passo 4: Rimuovi il Volume Mount

Rimuovi la riga aggiunta e aggiorna di nuovo lo stack.

## 📝 Esempio Completo (Metodo 1 - Console Portainer)

```bash
# 1. Connettiti alla console del container sistema54_db

# 2. Crea directory temporanea
mkdir -p /tmp/restore

# 3. Se hai il file sul server, copialo (da terminale server, non console)
# docker cp /path/to/backup.sql sistema54_db:/tmp/restore/backup.sql

# 4. Oppure crea il file direttamente nella console
cat > /tmp/restore/backup.sql << 'EOF'
-- Contenuto del backup SQL qui
EOF

# 5. Verifica il file
ls -lh /tmp/restore/backup.sql

# 6. Importa (ATTENZIONE: sovrascrive il database corrente!)
psql -U admin -d sistema54_db < /tmp/restore/backup.sql

# 7. Verifica l'importazione
psql -U admin -d sistema54_db -c "SELECT COUNT(*) FROM utenti;"
psql -U admin -d sistema54_db -c "SELECT COUNT(*) FROM clienti;"

# 8. Pulisci
rm -rf /tmp/restore
```

## ⚠️ Note Importanti

1. **Backup Preventivo**: Prima di importare, fai sempre un backup del database corrente:
   ```bash
   docker exec sistema54_db pg_dump -U admin -d sistema54_db > backup_prima_del_restore_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Formato Backup**: Il backup deve essere in formato SQL plain text (`.sql`). Se è compresso (`.zip`, `.gz`), decomprimilo prima.

3. **Credenziali Database**:
   - Username: `admin`
   - Password: `sistema54secure`
   - Database: `sistema54_db`

4. **Tempo di Importazione**: I backup grandi possono richiedere diversi minuti. Non interrompere il processo.

5. **Verifica Post-Importazione**: Dopo l'importazione, verifica sempre che i dati siano stati importati correttamente controllando alcune tabelle chiave.

## 🐛 Risoluzione Problemi

### ⚠️ Errore: "invalid byte sequence for encoding UTF8: 0xff"

Questo errore indica che il file contiene caratteri non validi per UTF-8. **Soluzioni:**

**Soluzione 1: Il file è compresso (ZIP)**
```bash
# Verifica il tipo di file
file backup.sql

# Se è un ZIP, decomprimilo prima
unzip backup.zip
# Poi importa il file .sql estratto
```

**Soluzione 2: Il file ha caratteri non validi**
```bash
# Pulisci il file rimuovendo caratteri non-ASCII
iconv -f UTF-8 -t UTF-8 -c backup.sql > backup_clean.sql

# Oppure usa sed
sed 's/[^\x00-\x7F]//g' backup.sql > backup_clean.sql

# Poi importa il file pulito
docker exec -i sistema54_db psql -U admin -d sistema54_db < backup_clean.sql
```

**Soluzione 3: Usa pg_restore se è un backup custom**
```bash
# Se il backup è stato creato con pg_dump -Fc (custom format)
docker exec -i sistema54_db pg_restore -U admin -d sistema54_db < backup.dump
```

**Soluzione 4: Forza encoding UTF-8**
```bash
# Specifica esplicitamente l'encoding
docker exec -i sistema54_db env PGCLIENTENCODING=UTF8 psql -U admin -d sistema54_db < backup.sql
```

### Errore: "permission denied"

```bash
# Assicurati di essere root o di avere i permessi
whoami
# Se necessario, esegui come root
su root
```

### Errore: "No such file or directory"

```bash
# Verifica che il file esista
ls -lh /tmp/backup.sql

# Verifica i permessi
chmod 644 /tmp/backup.sql
```

### Errore: "database does not exist"

```bash
# Verifica che il database esista
psql -U admin -l

# Se necessario, crea il database
psql -U admin -c "CREATE DATABASE sistema54_db;"
```

### Errore: "connection refused"

```bash
# Verifica che PostgreSQL sia in esecuzione
ps aux | grep postgres

# Riavvia il container se necessario
# Da Portainer: Containers → sistema54_db → Restart
```

### Errore: "file is not a valid dump file"

```bash
# Verifica che il file sia un dump SQL valido
head -20 backup.sql

# Dovresti vedere qualcosa come:
# -- PostgreSQL database dump
# SET client_encoding = 'UTF8';
# ...

# Se vedi caratteri strani all'inizio, il file potrebbe essere compresso o corrotto
```

## 📚 Comandi Utili

```bash
# Lista tutti i database
psql -U admin -l

# Connettiti al database
psql -U admin -d sistema54_db

# Lista tutte le tabelle
\dt

# Esci da psql
\q

# Conta record in una tabella
SELECT COUNT(*) FROM nome_tabella;

# Verifica dimensione database
SELECT pg_size_pretty(pg_database_size('sistema54_db'));
```

## 🔄 Ripristino da Backup Compresso

Se il backup è in formato `.zip` o `.gz`:

### Per file ZIP

```bash
# 1. Decomprimi sul server (NON nel container)
unzip backup.zip -d /tmp/

# 2. Verifica il contenuto
ls -lh /tmp/*.sql

# 3. Copia nel container
docker cp /tmp/backup.sql sistema54_db:/tmp/backup.sql

# 4. Importa
docker exec -i sistema54_db psql -U admin -d sistema54_db < /tmp/backup.sql

# Oppure tutto in un comando (se il file è piccolo)
unzip -p backup.zip | docker exec -i sistema54_db psql -U admin -d sistema54_db
```

### Per file GZIP (.gz)

```bash
# Metodo 1: Decomprimi prima, poi importa
gunzip backup.sql.gz
docker cp backup.sql sistema54_db:/tmp/backup.sql
docker exec -i sistema54_db psql -U admin -d sistema54_db < /tmp/backup.sql

# Metodo 2: Decomprimi direttamente nel pipe (più efficiente)
gunzip -c backup.sql.gz | docker exec -i sistema54_db psql -U admin -d sistema54_db
```

### Per file con encoding problematico

```bash
# Pulisci e decomprimi in un passaggio
gunzip -c backup.sql.gz | iconv -f UTF-8 -t UTF-8 -c | docker exec -i sistema54_db psql -U admin -d sistema54_db
```

## ✅ Checklist Post-Importazione

- [ ] Verificato che il database sia stato importato
- [ ] Controllato il numero di record nelle tabelle principali
- [ ] Testato l'accesso dall'applicazione
- [ ] Verificato che le impostazioni azienda siano presenti
- [ ] Testato login con un utente esistente
- [ ] Rimosso file temporanei di backup dal container

