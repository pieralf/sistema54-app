# Script PowerShell per convertire un file SQL in formato custom (.backup) per pgAdmin
# Questo script deve essere eseguito sul server dove gira Docker/Portainer

param(
    [Parameter(Mandatory=$true)]
    [string]$SqlFile
)

if (-not (Test-Path $SqlFile)) {
    Write-Host "ERRORE: File SQL non trovato: $SqlFile" -ForegroundColor Red
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = $SqlFile -replace '\.sql$', "_custom_$timestamp.backup"
$containerName = "sistema54_db"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Conversione SQL -> Custom Backup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "File SQL: $SqlFile" -ForegroundColor Yellow
Write-Host "File backup: $backupFile" -ForegroundColor Yellow
Write-Host ""

# Verifica che Docker sia disponibile
try {
    docker --version | Out-Null
} catch {
    Write-Host "ERRORE: Docker non è disponibile!" -ForegroundColor Red
    exit 1
}

# Verifica che il container del database sia in esecuzione
$dbContainer = docker ps --filter "name=$containerName" --format "{{.Names}}"
if (-not $dbContainer) {
    Write-Host "ERRORE: Il container $containerName non è in esecuzione!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Containers disponibili:" -ForegroundColor Yellow
    docker ps --format "table {{.Names}}\t{{.Status}}"
    exit 1
}

Write-Host "Container database trovato: $dbContainer" -ForegroundColor Green
Write-Host ""

Write-Host "ATTENZIONE: Questo processo sovrascriverà i dati nel database corrente!" -ForegroundColor Red
$confirm = Read-Host "Vuoi continuare? (sì/no)"
if ($confirm -ne "sì" -and $confirm -ne "si" -and $confirm -ne "yes" -and $confirm -ne "y") {
    Write-Host "Operazione annullata." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Passo 1: Importazione file SQL nel database..." -ForegroundColor Yellow
Get-Content $SqlFile -Raw | docker exec -i $containerName psql -U admin -d sistema54_db

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRORE durante l'importazione del file SQL!" -ForegroundColor Red
    exit 1
}

Write-Host "Passo 2: Creazione backup in formato custom..." -ForegroundColor Yellow
docker exec $containerName pg_dump -U admin -d sistema54_db -Fc -f /tmp/backup_custom.backup

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRORE durante la creazione del backup custom!" -ForegroundColor Red
    exit 1
}

Write-Host "Passo 3: Copia del backup dal container..." -ForegroundColor Yellow
docker cp "${containerName}:/tmp/backup_custom.backup" $backupFile

if ($LASTEXITCODE -eq 0) {
    $fileSize = (Get-Item $backupFile).Length / 1MB
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Conversione completata con successo!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "File backup creato: $backupFile" -ForegroundColor Cyan
    Write-Host "Dimensione: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Ora puoi caricare questo file in pgAdmin:" -ForegroundColor Yellow
    Write-Host "  1. Apri pgAdmin" -ForegroundColor Cyan
    Write-Host "  2. Clicca destro su sistema54_db -> Restore..." -ForegroundColor Cyan
    Write-Host "  3. Seleziona: $backupFile" -ForegroundColor Cyan
} else {
    Write-Host "ERRORE durante la copia del backup!" -ForegroundColor Red
    exit 1
}


