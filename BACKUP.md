# Sistema di Backup Sistema54

Questo documento descrive come creare e ripristinare backup del database e del codice.

## 📦 Backup del Database

### Windows (PowerShell)

Per creare un backup:
```powershell
.\backup_database.ps1
```

Per ripristinare un backup:
```powershell
.\restore_database.ps1 -BackupFile .\backups\sistema54_db_backup_YYYYMMDD_HHMMSS.sql
```

### Linux/Mac (Bash)

Per creare un backup:
```bash
chmod +x backup_database.sh
./backup_database.sh
```

Per ripristinare un backup:
```bash
chmod +x restore_database.sh
./restore_database.sh ./backups/sistema54_db_backup_YYYYMMDD_HHMMSS.sql
```

### Caratteristiche

- ✅ Backup automatico con timestamp
- ✅ Mantiene solo gli ultimi 10 backup (rimuove automaticamente i più vecchi)
- ✅ Verifica che il database sia in esecuzione prima di procedere
- ✅ Backup salvati nella cartella `./backups/`

## 📝 Backup del Codice con Git

### Inizializzazione Git (se non già fatto)

```bash
# Inizializza il repository Git
git init

# Aggiungi tutti i file
git add .

# Crea il primo commit
git commit -m "Initial commit - Sistema54 App"
```

### Creazione di un backup (commit)

```bash
# Aggiungi i file modificati
git add .

# Crea un commit con descrizione
git commit -m "Descrizione delle modifiche"

# Visualizza la cronologia dei commit
git log --oneline
```

### Ripristino da Git

```bash
# Visualizza tutti i commit
git log --oneline

# Ripristina a un commit specifico
git checkout <hash-del-commit>

# Oppure ripristina l'ultimo commit
git checkout HEAD

# Per tornare all'ultima versione dopo un checkout
git checkout main  # o master, a seconda del branch
```

### Creazione di un branch per backup

```bash
# Crea un branch di backup con timestamp
git checkout -b backup-$(date +%Y%m%d)

# Torna al branch principale
git checkout main
```

## 🔄 Backup Completo (Database + Codice)

### Procedura consigliata

1. **Backup del Database** (ogni giorno o prima di modifiche importanti):
   ```powershell
   .\backup_database.ps1
   ```

2. **Backup del Codice con Git** (ogni volta che fai modifiche):
   ```bash
   git add .
   git commit -m "Descrizione modifiche"
   ```

3. **Backup completo manuale** (settimanale o mensile):
   - Esegui backup del database
   - Crea un commit Git con tag:
     ```bash
     git tag -a v1.0.0 -m "Versione stabile - [data]"
     ```

## 📁 Struttura Backup

```
sistema54-app/
├── backups/                    # Cartella backup database
│   ├── sistema54_db_backup_20250115_143022.sql
│   ├── sistema54_db_backup_20250115_180045.sql
│   └── ...
├── backup_database.ps1        # Script backup Windows
├── backup_database.sh          # Script backup Linux/Mac
├── restore_database.ps1        # Script ripristino Windows
├── restore_database.sh         # Script ripristino Linux/Mac
└── BACKUP.md                   # Questa guida
```

## ⚠️ Note Importanti

1. **Database**: I backup del database contengono tutti i dati (clienti, interventi, prodotti, etc.)
2. **Codice**: Git salva solo il codice sorgente, non i dati del database
3. **Uploads**: I file caricati (logo, etc.) sono nella cartella `backend/uploads/` e dovrebbero essere inclusi nel backup Git
4. **Node_modules**: Non vengono inclusi nel backup Git (già esclusi da `.gitignore`)

## 🚀 Automatizzazione (Opzionale)

### Windows Task Scheduler

Puoi automatizzare il backup del database usando Task Scheduler:

1. Apri Task Scheduler
2. Crea una nuova attività
3. Imposta l'esecuzione dello script `backup_database.ps1` ogni giorno

### Cron Job (Linux/Mac)

Aggiungi al crontab per backup giornaliero alle 2:00 AM:

```bash
0 2 * * * cd /path/to/sistema54-app && ./backup_database.sh
```

## 📞 Supporto

In caso di problemi con i backup, verifica:
- Il container del database è in esecuzione: `docker ps`
- La cartella `backups/` esiste e ha i permessi corretti
- Git è installato e configurato correttamente

