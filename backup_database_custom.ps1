# Script di Backup Database Sistema54 - Formato Custom (per pgAdmin Restore)
# Crea un backup in formato custom che funziona con pg_restore di pgAdmin

param(
    [string]$BackupFile = ""
)

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = ".\backups"

if ([string]::IsNullOrEmpty($BackupFile)) {
    $BackupFile = "$backupDir\sistema54_db_backup_custom_$timestamp.backup"
}

# Crea la cartella backups se non esiste
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    Write-Host "Cartella backups creata: $backupDir" -ForegroundColor Green
}

Write-Host "Inizio backup database in formato CUSTOM (per pgAdmin)..." -ForegroundColor Yellow
Write-Host "File di backup: $BackupFile" -ForegroundColor Cyan

# Verifica che il container del database sia in esecuzione
$dbContainer = docker ps --filter "name=sistema54_db" --format "{{.Names}}"
if (-not $dbContainer) {
    Write-Host "ERRORE: Il container del database non è in esecuzione!" -ForegroundColor Red
    Write-Host "Avvia il database con: docker-compose up -d db" -ForegroundColor Yellow
    exit 1
}

Write-Host "`nCreazione backup in formato CUSTOM (compatibile con pg_restore)..." -ForegroundColor Yellow

# Esegue il backup usando pg_dump in formato custom
docker exec sistema54_db pg_dump -U admin -d sistema54_db -Fc -f /tmp/backup_custom.backup

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRORE durante la creazione del backup nel container!" -ForegroundColor Red
    exit 1
}

# Copia il file dal container al PC
Write-Host "Copia del backup dal container..." -ForegroundColor Yellow
docker cp sistema54_db:/tmp/backup_custom.backup $BackupFile

if ($LASTEXITCODE -eq 0) {
    $fileSize = (Get-Item $BackupFile).Length / 1MB
    Write-Host "`nBackup completato con successo!" -ForegroundColor Green
    Write-Host "File: $BackupFile" -ForegroundColor Cyan
    Write-Host "Dimensione: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Cyan
    Write-Host "`nFormato: CUSTOM (compatibile con pgAdmin Restore Tool)" -ForegroundColor Green
    Write-Host "`nPer ripristinare questo backup:" -ForegroundColor Yellow
    Write-Host "  1. Apri pgAdmin" -ForegroundColor Cyan
    Write-Host "  2. Clicca destro su sistema54_db -> Restore..." -ForegroundColor Cyan
    Write-Host "  3. Seleziona questo file: $BackupFile" -ForegroundColor Cyan
} else {
    Write-Host "`nERRORE durante la copia del backup!" -ForegroundColor Red
    exit 1
}





