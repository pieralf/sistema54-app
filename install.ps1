# Script di Installazione SISTEMA54 - Windows PowerShell
# Questo script installa e configura SISTEMA54 Digital su Windows

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SISTEMA54 Digital - Installazione" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verifica Docker e Docker Compose
Write-Host "[1/6] Verifica prerequisiti..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "  ✓ Docker trovato: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Docker non trovato!" -ForegroundColor Red
    Write-Host "  Installa Docker Desktop da: https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

try {
    $composeVersion = docker compose version
    Write-Host "  ✓ Docker Compose trovato: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Docker Compose non trovato!" -ForegroundColor Red
    exit 1
}

# Verifica che Docker sia in esecuzione
try {
    docker ps | Out-Null
    Write-Host "  ✓ Docker è in esecuzione" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Docker non è in esecuzione!" -ForegroundColor Red
    Write-Host "  Avvia Docker Desktop e riprova" -ForegroundColor Yellow
    exit 1
}

# Crea directory necessarie
Write-Host ""
Write-Host "[2/6] Creazione directory..." -ForegroundColor Yellow
$directories = @(
    "data/postgres",
    "backend/uploads/logos"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  ✓ Creata directory: $dir" -ForegroundColor Green
    } else {
        Write-Host "  ✓ Directory esistente: $dir" -ForegroundColor Gray
    }
}

# Verifica file necessari
Write-Host ""
Write-Host "[3/6] Verifica file di configurazione..." -ForegroundColor Yellow
$requiredFiles = @(
    "docker-compose.yml",
    "backend/Dockerfile",
    "frontend/Dockerfile",
    "backend/requirements.txt",
    "frontend/package.json"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  ✓ Trovato: $file" -ForegroundColor Green
    } else {
        Write-Host "  ✗ File mancante: $file" -ForegroundColor Red
        exit 1
    }
}

# Build delle immagini Docker
Write-Host ""
Write-Host "[4/6] Build immagini Docker (questo può richiedere alcuni minuti)..." -ForegroundColor Yellow
Write-Host "  Questo passaggio scarica le dipendenze e compila le immagini..." -ForegroundColor Gray
docker compose build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Errore durante il build!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Build completato" -ForegroundColor Green

# Avvio dei container
Write-Host ""
Write-Host "[5/6] Avvio dei container..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Errore durante l'avvio!" -ForegroundColor Red
    exit 1
}

# Attesa che i servizi siano pronti
Write-Host ""
Write-Host "[6/6] Attesa inizializzazione servizi..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Verifica che i container siano in esecuzione
$containers = @("sistema54_db", "sistema54_backend", "sistema54_frontend")
foreach ($container in $containers) {
    $status = docker ps --filter "name=$container" --format "{{.Status}}"
    if ($status) {
        Write-Host "  ✓ $container è in esecuzione" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $container non è in esecuzione!" -ForegroundColor Red
    }
}

# Verifica connessione al database
Write-Host ""
Write-Host "Verifica connessione database..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
try {
    docker exec sistema54_db pg_isready -U admin | Out-Null
    Write-Host "  ✓ Database pronto" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Database non ancora pronto, attendere qualche secondo" -ForegroundColor Yellow
}

# Informazioni finali
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Installazione completata!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Accesso all'applicazione:" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  Backend API: http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "Database:" -ForegroundColor Yellow
Write-Host "  Host: localhost:5432" -ForegroundColor White
Write-Host "  Database: sistema54_db" -ForegroundColor White
Write-Host "  User: admin" -ForegroundColor White
Write-Host "  Password: sistema54secure" -ForegroundColor White
Write-Host ""
Write-Host "Comandi utili:" -ForegroundColor Yellow
Write-Host "  Visualizza log: docker compose logs -f" -ForegroundColor White
Write-Host "  Ferma servizi: docker compose down" -ForegroundColor White
Write-Host "  Riavvia servizi: docker compose restart" -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANTE: Crea il primo utente amministratore con:" -ForegroundColor Yellow
Write-Host "  docker exec -it sistema54_backend python create_admin.py" -ForegroundColor White
Write-Host ""
