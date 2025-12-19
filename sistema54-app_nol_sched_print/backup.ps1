# Script di backup completo per Sistema54 (PowerShell)
# Crea un backup del database PostgreSQL e dei file di upload

$ErrorActionPreference = "Stop"

# Directory di backup
$BACKUP_DIR = ".\backups"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_NAME = "sistema54_backup_$TIMESTAMP"
$BACKUP_PATH = Join-Path $BACKUP_DIR $BACKUP_NAME

Write-Host "=== Backup Sistema54 ===" -ForegroundColor Green
Write-Host "Data/Ora: $(Get-Date)"
Write-Host ""

# Crea directory backup se non esiste
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}
New-Item -ItemType Directory -Path $BACKUP_PATH | Out-Null

# 1. Backup Database PostgreSQL
Write-Host "[1/4] Backup database PostgreSQL..." -ForegroundColor Yellow
try {
    docker-compose exec -T db pg_dump -U admin sistema54_db | Out-File -FilePath (Join-Path $BACKUP_PATH "database.sql") -Encoding utf8
    Write-Host "✓ Database esportato con successo" -ForegroundColor Green
} catch {
    Write-Host "✗ Errore durante l'esportazione del database: $_" -ForegroundColor Red
    exit 1
}

# 2. Backup file di upload (logo, etc.)
Write-Host "[2/4] Backup file di upload..." -ForegroundColor Yellow
$UPLOADS_DIR = ".\backend\uploads"
if (Test-Path $UPLOADS_DIR) {
    Copy-Item -Path $UPLOADS_DIR -Destination (Join-Path $BACKUP_PATH "uploads") -Recurse -Force
    Write-Host "✓ File di upload copiati" -ForegroundColor Green
} else {
    Write-Host "⚠ Directory uploads non trovata" -ForegroundColor Yellow
}

# 3. Backup configurazioni Docker
Write-Host "[3/4] Backup configurazioni..." -ForegroundColor Yellow
$configs = @(
    @{Source = ".\docker-compose.yml"; Dest = "docker-compose.yml"},
    @{Source = ".\.env"; Dest = ".env"},
    @{Source = ".\backend\.env"; Dest = "backend.env"},
    @{Source = ".\frontend\.env"; Dest = "frontend.env"}
)

foreach ($config in $configs) {
    if (Test-Path $config.Source) {
        Copy-Item -Path $config.Source -Destination (Join-Path $BACKUP_PATH $config.Dest) -Force
    } else {
        Write-Host "⚠ $($config.Source) non trovato" -ForegroundColor Yellow
    }
}
Write-Host "✓ Configurazioni copiate" -ForegroundColor Green

# 4. Crea archivio compresso
Write-Host "[4/4] Creazione archivio compresso..." -ForegroundColor Yellow
try {
    $archivePath = Join-Path $BACKUP_DIR "$BACKUP_NAME.zip"
    Compress-Archive -Path $BACKUP_PATH\* -DestinationPath $archivePath -Force
    Write-Host "✓ Archivio creato: $BACKUP_NAME.zip" -ForegroundColor Green
    
    # Rimuovi directory non compressa
    Remove-Item -Path $BACKUP_PATH -Recurse -Force
    Write-Host "✓ Directory temporanea rimossa" -ForegroundColor Green
} catch {
    Write-Host "✗ Errore durante la creazione dell'archivio: $_" -ForegroundColor Red
    exit 1
}

# Calcola dimensione backup
$BACKUP_SIZE = (Get-Item (Join-Path $BACKUP_DIR "$BACKUP_NAME.zip")).Length / 1MB
$BACKUP_SIZE_FORMATTED = "{0:N2} MB" -f $BACKUP_SIZE

Write-Host ""
Write-Host "=== Backup completato con successo! ===" -ForegroundColor Green
Write-Host "File: $BACKUP_DIR\$BACKUP_NAME.zip"
Write-Host "Dimensione: $BACKUP_SIZE_FORMATTED"
Write-Host ""
Write-Host 'Per ripristinare il backup:' -ForegroundColor Cyan
Write-Host '  1. Estrai l archivio ZIP'
Write-Host '  2. Ripristina il database dal file database.sql'
Write-Host '  3. Copia i file upload nella directory backend/uploads'
Write-Host ""
