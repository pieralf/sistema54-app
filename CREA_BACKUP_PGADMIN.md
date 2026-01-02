# Come Creare un Backup in Formato Custom per pgAdmin

Questo backup può essere caricato direttamente in pgAdmin tramite l'upload nella cartella.

## Metodo 1: Via Portainer Console (se funziona)

1. **Portainer** → **Containers** → `sistema54_db` → **Console**
2. Esegui questi comandi:

```bash
# Crea il backup in formato custom nel container
pg_dump -U admin -d sistema54_db -Fc -f /tmp/backup_custom.backup

# Verifica che il file sia stato creato
ls -lh /tmp/backup_custom.backup
```

3. **Scarica il file dal container**:
   - Portainer → Containers → `sistema54_db` → **Files**
   - Naviga a `/tmp/`
   - Scarica `backup_custom.backup`

## Metodo 2: Via SSH al Server (se hai accesso)

1. **Connettiti al server** via SSH
2. **Esegui lo script** (se lo hai caricato sul server):

```bash
chmod +x backup_database_custom.sh
./backup_database_custom.sh
```

3. **Oppure esegui i comandi manualmente**:

```bash
# Crea il backup nel container
docker exec sistema54_db pg_dump -U admin -d sistema54_db -Fc -f /tmp/backup_custom.backup

# Copia il file dal container al server
docker cp sistema54_db:/tmp/backup_custom.backup ./backup_custom.backup

# Verifica il file
ls -lh ./backup_custom.backup
```

4. **Scarica il file** dal server al tuo PC (via SCP/SFTP)

## Metodo 3: Comandi Manuali Diretti

Se hai accesso al server Docker, esegui direttamente:

```bash
# 1. Crea il backup nel container
docker exec sistema54_db pg_dump -U admin -d sistema54_db -Fc -f /tmp/backup_custom.backup

# 2. Copia dal container al server (se necessario)
docker cp sistema54_db:/tmp/backup_custom.backup /path/on/server/backup_custom.backup

# 3. Scarica il file dal server al tuo PC
```

## Come Usare il Backup in pgAdmin

1. **Apri pgAdmin**
2. **Clicca destro** su `sistema54_db` → **Restore...**
3. **Tab General**:
   - **Filename**: Clicca **...** e seleziona il file `.backup`
   - **Format**: Dovrebbe essere rilevato automaticamente come "Custom or tar"
4. **Tab Restore options**:
   - ✅ **Pre-data**
   - ✅ **Data**
   - ✅ **Post-data**
   - ⚠️ **Clean before restore**: Spunta se vuoi eliminare i dati esistenti
5. **Clicca Restore**

## Verifica del Backup

Il file `.backup` è un formato binario compresso. Dovrebbe essere più piccolo del file SQL equivalente.

Per verificare il contenuto del backup:
```bash
# Elenca le tabelle nel backup
docker exec sistema54_db pg_restore -l /tmp/backup_custom.backup
```





