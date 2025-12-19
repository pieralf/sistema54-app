# Script di Ripristino Database Sistema54
# Ripristina un backup del database PostgreSQL

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

$backupDir = ".\backups"

# Verifica che il file di backup esista
if (-not (Test-Path $BackupFile)) {
    Write-Host "ERRORE: File di backup non trovato: $BackupFile" -ForegroundColor Red
    exit 1
}

# Verifica che il container del database sia in esecuzione
$dbContainer = docker ps --filter "name=sistema54-db" --format "{{.Names}}"
if (-not $dbContainer) {
    Write-Host "ERRORE: Il container del database non è in esecuzione!" -ForegroundColor Red
    Write-Host "Avvia il database con: docker-compose up -d db" -ForegroundColor Yellow
    exit 1
}

Write-Host "ATTENZIONE: Questo processo sovrascriverà il database corrente!" -ForegroundColor Red
$confirm = Read-Host "Sei sicuro di voler continuare? (sì/no)"
if ($confirm -ne "sì" -and $confirm -ne "si" -and $confirm -ne "yes" -and $confirm -ne "y") {
    Write-Host "Operazione annullata." -ForegroundColor Yellow
    exit 0
}

Write-Host "`nRipristino backup in corso..." -ForegroundColor Yellow
Write-Host "File: $BackupFile" -ForegroundColor Cyan

# Ripristina il backup
Get-Content $BackupFile | docker exec -i sistema54-db psql -U admin -d sistema54_db

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nRipristino completato con successo!" -ForegroundColor Green
} else {
    Write-Host "`nERRORE durante il ripristino!" -ForegroundColor Red
    exit 1
}

