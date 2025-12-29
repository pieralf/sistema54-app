# Come Trovare e Scaricare il File .backup

## Dove si Trova il File

Il file `.backup` viene creato **dentro il container del database** (`sistema54_db`) nella cartella `/tmp/backup_custom.backup`.

## Metodi per Scaricare il File (Senza Console Portainer)

### Metodo 1: Portainer File Browser (CONSIGLIATO)

1. **Portainer** → **Containers** → `sistema54_db`
2. Clicca sulla tab **Files** (non Console!)
3. Naviga a `/tmp/`
4. Dovresti vedere `backup_custom.backup`
5. Clicca con il tasto destro → **Download** o usa il pulsante download

### Metodo 2: Via SSH al Server (se hai accesso)

Se hai accesso SSH al server dove gira Portainer:

```bash
# 1. Verifica che il file esista nel container
docker exec sistema54_db ls -lh /tmp/backup_custom.backup

# 2. Se il file esiste, copialo dal container al server
docker cp sistema54_db:/tmp/backup_custom.backup ./backup_custom.backup

# 3. Verifica che sia stato copiato
ls -lh ./backup_custom.backup

# 4. Scarica il file dal server al tuo PC (via SCP/SFTP)
# Esempio con SCP:
scp user@server:/path/to/backup_custom.backup ./
```

### Metodo 3: Creare il Backup Direttamente sul Server

Se il file non esiste ancora, crealo direttamente sul server:

```bash
# 1. Crea il backup nel container
docker exec sistema54_db pg_dump -U admin -d sistema54_db -Fc -f /tmp/backup_custom.backup

# 2. Copia il file dal container al server
docker cp sistema54_db:/tmp/backup_custom.backup ./backup_custom_$(date +%Y%m%d_%H%M%S).backup

# 3. Verifica
ls -lh ./backup_custom_*.backup
```

### Metodo 4: Usare Portainer Exec (Alternativa alla Console)

1. **Portainer** → **Containers** → `sistema54_db`
2. Clicca su **Exec** (non Console!)
3. Esegui:
   ```bash
   ls -lh /tmp/backup_custom.backup
   ```
4. Se il file esiste, usa il File Browser per scaricarlo

## Verifica se il File Esiste

Prima di tutto, verifica se il file è stato creato:

**Via Portainer Exec:**
1. Portainer → Containers → `sistema54_db` → **Exec**
2. Esegui: `ls -lh /tmp/backup_custom.backup`

**Via SSH (se disponibile):**
```bash
docker exec sistema54_db ls -lh /tmp/backup_custom.backup
```

## Se il File Non Esiste

Se il file non esiste, crealo ora:

**Via Portainer Exec:**
1. Portainer → Containers → `sistema54_db` → **Exec**
2. Esegui:
   ```bash
   pg_dump -U admin -d sistema54_db -Fc -f /tmp/backup_custom.backup
   ls -lh /tmp/backup_custom.backup
   ```

**Via SSH:**
```bash
docker exec sistema54_db pg_dump -U admin -d sistema54_db -Fc -f /tmp/backup_custom.backup
docker exec sistema54_db ls -lh /tmp/backup_custom.backup
```

## Caricare il File in pgAdmin

Una volta scaricato il file `.backup` sul tuo PC:

1. **Apri pgAdmin**
2. **Clicca destro** su `sistema54_db` → **Restore...**
3. **Tab General**:
   - **Filename**: Clicca **...** e seleziona il file `.backup` scaricato
   - **Format**: Dovrebbe essere rilevato automaticamente come "Custom or tar"
4. **Tab Restore options**:
   - ✅ **Pre-data**, **Data**, **Post-data**: Tutti selezionati
   - ⚠️ **Clean before restore**: Spunta se vuoi eliminare i dati esistenti
5. **Clicca Restore**


