# Script di Backup Database Sistema54
# Esegue un backup completo del database PostgreSQL

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = ".\backups"
$backupFile = "$backupDir\sistema54_db_backup_$timestamp.sql"

# Crea la cartella backups se non esiste
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    Write-Host "Cartella backups creata: $backupDir" -ForegroundColor Green
}

Write-Host "Inizio backup database..." -ForegroundColor Yellow
Write-Host "File di backup: $backupFile" -ForegroundColor Cyan

# Verifica che il container del database sia in esecuzione
$dbContainer = docker ps --filter "name=sistema54_db" --format "{{.Names}}"
if (-not $dbContainer) {
    Write-Host "ERRORE: Il container del database non è in esecuzione!" -ForegroundColor Red
    Write-Host "Avvia il database con: docker-compose up -d db" -ForegroundColor Yellow
    exit 1
}

# Esegue il backup usando pg_dump dal container
docker exec sistema54_db pg_dump -U admin -d sistema54_db > $backupFile

if ($LASTEXITCODE -eq 0) {
    $fileSize = (Get-Item $backupFile).Length / 1MB
    Write-Host "`nBackup completato con successo!" -ForegroundColor Green
    Write-Host "File: $backupFile" -ForegroundColor Cyan
    Write-Host "Dimensione: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Cyan
    
    # Mantieni solo gli ultimi 10 backup
    $oldBackups = Get-ChildItem -Path $backupDir -Filter "sistema54_db_backup_*.sql" | 
                  Sort-Object LastWriteTime -Descending | 
                  Select-Object -Skip 10
    if ($oldBackups) {
        Write-Host "`nRimozione vecchi backup (mantenuti solo gli ultimi 10)..." -ForegroundColor Yellow
        $oldBackups | Remove-Item
        Write-Host "Vecchi backup rimossi." -ForegroundColor Green
    }
} else {
    Write-Host "`nERRORE durante il backup!" -ForegroundColor Red
    exit 1
}

Write-Host "`nPer ripristinare un backup:" -ForegroundColor Yellow
Write-Host "  docker exec -i sistema54_db psql -U admin -d sistema54_db < $backupFile" -ForegroundColor Cyan

