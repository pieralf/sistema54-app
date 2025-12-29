# Script di Ripristino Database Sistema54 - Per Portainer/Docker remoto
# Importa un file SQL direttamente nel database usando docker exec

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    
    [string]$ContainerName = "sistema54_db"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ripristino Database Sistema54" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica che il file di backup esista
if (-not (Test-Path $BackupFile)) {
    Write-Host "ERRORE: File di backup non trovato: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "File di backup: $BackupFile" -ForegroundColor Yellow
$fileSize = (Get-Item $BackupFile).Length / 1MB
Write-Host "Dimensione: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Yellow
Write-Host ""

# Verifica che il container del database sia in esecuzione
Write-Host "Verifica container Docker..." -ForegroundColor Yellow
$dbContainer = docker ps --filter "name=$ContainerName" --format "{{.Names}}"
if (-not $dbContainer) {
    Write-Host "ERRORE: Il container '$ContainerName' non è in esecuzione!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Containers disponibili:" -ForegroundColor Yellow
    docker ps --format "table {{.Names}}\t{{.Status}}"
    Write-Host ""
    Write-Host "Se il container ha un nome diverso, specifica il nome con:" -ForegroundColor Yellow
    Write-Host "  .\restore_database_portainer.ps1 -BackupFile `"$BackupFile`" -ContainerName `"NOME_CONTAINER`"" -ForegroundColor Cyan
    exit 1
}

Write-Host "Container trovato: $dbContainer" -ForegroundColor Green
Write-Host ""

Write-Host "ATTENZIONE: Questo processo sovrascriverà il database corrente!" -ForegroundColor Red
$confirm = Read-Host "Sei sicuro di voler continuare? (sì/no)"
if ($confirm -ne "sì" -and $confirm -ne "si" -and $confirm -ne "yes" -and $confirm -ne "y") {
    Write-Host "Operazione annullata." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Ripristino backup in corso..." -ForegroundColor Yellow
Write-Host "Questo processo può richiedere alcuni minuti..." -ForegroundColor Yellow
Write-Host ""

# Importa il backup usando psql direttamente
# Usa Get-Content per leggere il file e passarlo a docker exec
$startTime = Get-Date

Get-Content $BackupFile -Raw | docker exec -i $ContainerName psql -U admin -d sistema54_db

$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Ripristino completato con successo!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Tempo impiegato: $([math]::Round($duration, 2)) secondi" -ForegroundColor Cyan
    Write-Host ""
    
    # Verifica che i dati siano stati importati
    Write-Host "Verifica importazione dati..." -ForegroundColor Yellow
    docker exec $ContainerName psql -U admin -d sistema54_db -c "SELECT 'utenti' as tabella, COUNT(*) as record FROM utenti UNION ALL SELECT 'clienti', COUNT(*) FROM clienti UNION ALL SELECT 'interventi', COUNT(*) FROM interventi;"
    
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "ERRORE durante il ripristino!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Controlla i messaggi di errore sopra per maggiori dettagli." -ForegroundColor Yellow
    exit 1
}


