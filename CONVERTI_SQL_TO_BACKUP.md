# Come Convertire un File SQL in Formato Custom (.backup) per pgAdmin

Questo processo converte il tuo file SQL esistente in formato custom che può essere caricato direttamente in pgAdmin tramite Restore Tool.

## File da Convertire

- **File SQL**: `C:\Progetti\sistema54-app\backups\sistema54_db_backup_20251218_164153.sql`
- **Output**: File `.backup` compatibile con pgAdmin Restore Tool

## Metodo 1: Script PowerShell (Sul Server Remoto)

Se hai accesso SSH al server dove gira Portainer:

1. **Carica il file SQL sul server** (via SCP/SFTP):
   ```bash
   scp C:\Progetti\sistema54-app\backups\sistema54_db_backup_20251218_164153.sql user@server:/tmp/
   ```

2. **Carica lo script sul server**:
   ```bash
   scp converti_sql_to_backup.sh user@server:/tmp/
   ```

3. **Connettiti al server** via SSH:
   ```bash
   ssh user@server
   ```

4. **Esegui lo script**:
   ```bash
   chmod +x /tmp/converti_sql_to_backup.sh
   /tmp/converti_sql_to_backup.sh /tmp/sistema54_db_backup_20251218_164153.sql
   ```

5. **Scarica il file `.backup` creato**:
   ```bash
   scp user@server:/tmp/sistema54_db_backup_20251218_164153_custom_*.backup ./
   ```

## Metodo 2: Script PowerShell (Sul Server Windows)

Se il server è Windows e hai PowerShell:

1. **Carica il file SQL sul server**
2. **Carica lo script** `converti_sql_to_backup.ps1` sul server
3. **Esegui**:
   ```powershell
   .\converti_sql_to_backup.ps1 -SqlFile "C:\path\to\sistema54_db_backup_20251218_164153.sql"
   ```

## Metodo 3: Comandi Manuali (Via Portainer Exec)

Se hai accesso a Portainer Exec (non Console):

1. **Portainer** → **Containers** → `sistema54_db` → **Exec**

2. **Carica il file SQL nel container** (via Portainer Files o docker cp):
   - Portainer → Containers → `sistema54_db` → **Files**
   - Upload il file SQL in `/tmp/`

3. **Importa il file SQL**:
   ```bash
   psql -U admin -d sistema54_db < /tmp/sistema54_db_backup_20251218_164153.sql
   ```

4. **Crea il backup in formato custom**:
   ```bash
   pg_dump -U admin -d sistema54_db -Fc -f /tmp/backup_custom.backup
   ```

5. **Scarica il file**:
   - Portainer → Containers → `sistema54_db` → **Files** → `/tmp/backup_custom.backup` → Download

## Metodo 4: Comandi Manuali Diretti (Via SSH)

Se hai accesso SSH completo al server:

```bash
# 1. Carica il file SQL sul server (dal tuo PC)
scp C:\Progetti\sistema54-app\backups\sistema54_db_backup_20251218_164153.sql user@server:/tmp/

# 2. Connettiti al server
ssh user@server

# 3. Importa il file SQL nel database
cat /tmp/sistema54_db_backup_20251218_164153.sql | docker exec -i sistema54_db psql -U admin -d sistema54_db

# 4. Crea il backup in formato custom
docker exec sistema54_db pg_dump -U admin -d sistema54_db -Fc -f /tmp/backup_custom.backup

# 5. Copia il backup dal container al server
docker cp sistema54_db:/tmp/backup_custom.backup /tmp/sistema54_db_backup_custom.backup

# 6. Verifica il file
ls -lh /tmp/sistema54_db_backup_custom.backup

# 7. Scarica il file dal server al PC
scp user@server:/tmp/sistema54_db_backup_custom.backup ./
```

## Come Usare il File .backup in pgAdmin

Una volta scaricato il file `.backup`:

1. **Apri pgAdmin**
2. **Clicca destro** su `sistema54_db` → **Restore...**
3. **Tab General**:
   - **Filename**: Clicca **...** e seleziona il file `.backup`
   - **Format**: Dovrebbe essere rilevato automaticamente come "Custom or tar"
4. **Tab Restore options**:
   - ✅ **Pre-data** (include CREATE statements)
   - ✅ **Data** (include INSERT statements)
   - ✅ **Post-data** (include indexes, constraints)
   - ⚠️ **Clean before restore**: Spunta se vuoi eliminare i dati esistenti
5. **Clicca Restore**

## Note Importanti

⚠️ **ATTENZIONE**: 
- Il processo di conversione **sovrascriverà** i dati nel database corrente
- Assicurati di avere un backup del database attuale prima di procedere
- Il file `.backup` sarà più piccolo del file SQL originale (formato compresso)

## Risoluzione Problemi

**Se il container non è trovato:**
```bash
# Verifica i containers disponibili
docker ps --format "table {{.Names}}\t{{.Status}}"

# Se il container ha un nome diverso, modifica lo script o usa:
docker exec NOME_CONTAINER pg_dump ...
```

**Se l'importazione fallisce:**
- Verifica che il file SQL sia valido
- Controlla i log del container: `docker logs sistema54_db`
- Assicurati che il database sia vuoto o che tu voglia sovrascriverlo







