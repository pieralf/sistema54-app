# Script di backup completo del codice sorgente Sistema54 (PowerShell)
# Crea un backup completo del codice sorgente escludendo node_modules, data, etc.

$ErrorActionPreference = "Stop"

# Directory di backup
$BACKUP_DIR = ".\backups"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_NAME = "sistema54_code_backup_$TIMESTAMP"
$BACKUP_PATH = Join-Path $BACKUP_DIR $BACKUP_NAME

Write-Host "=== Backup Codice Sorgente Sistema54 ===" -ForegroundColor Green
Write-Host "Data/Ora: $(Get-Date)"
Write-Host ""

# Crea directory backup se non esiste
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}
New-Item -ItemType Directory -Path $BACKUP_PATH | Out-Null

# Lista delle directory e file da includere nel backup
$itemsToBackup = @(
    "backend",
    "frontend",
    "docker-compose.yml",
    ".gitignore",
    "README.md"
)

# Lista delle directory da escludere
$excludeDirs = @(
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    "dist",
    "build",
    ".next",
    ".vscode",
    ".idea",
    "data",
    "backups",
    "*.pyc",
    "*.pyo",
    "*.log"
)

Write-Host "[1/3] Copia file sorgente..." -ForegroundColor Yellow

foreach ($item in $itemsToBackup) {
    if (Test-Path $item) {
        $destPath = Join-Path $BACKUP_PATH $item
        if (Test-Path $item -PathType Container) {
            # È una directory, copia ricorsivamente escludendo le directory non necessarie
            Write-Host "  Copiando $item..." -ForegroundColor Gray
            robocopy $item $destPath /E /XD node_modules __pycache__ .pytest_cache dist build .next .vscode .idea data backups /XF *.pyc *.pyo *.log /NFL /NDL /NJH /NJS /NP
        } else {
            # È un file
            Copy-Item -Path $item -Destination $destPath -Force
            Write-Host "  Copiato $item" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠ $item non trovato" -ForegroundColor Yellow
    }
}

Write-Host "✓ File sorgente copiati" -ForegroundColor Green

# 2. Backup configurazioni
Write-Host "[2/3] Backup configurazioni..." -ForegroundColor Yellow
$configs = @(
    @{Source = ".\docker-compose.yml"; Dest = "docker-compose.yml"},
    @{Source = ".\.gitignore"; Dest = ".gitignore"},
    @{Source = ".\README.md"; Dest = "README.md"; Optional = $true}
)

foreach ($config in $configs) {
    if (Test-Path $config.Source) {
        Copy-Item -Path $config.Source -Destination (Join-Path $BACKUP_PATH $config.Dest) -Force
    } elseif (-not $config.Optional) {
        Write-Host "  ⚠ $($config.Source) non trovato" -ForegroundColor Yellow
    }
}
Write-Host "✓ Configurazioni copiate" -ForegroundColor Green

# 3. Crea archivio compresso
Write-Host "[3/3] Creazione archivio compresso..." -ForegroundColor Yellow
try {
    $archivePath = Join-Path $BACKUP_DIR "$BACKUP_NAME.zip"
    
    # Rimuovi archivio esistente se presente
    if (Test-Path $archivePath) {
        Remove-Item -Path $archivePath -Force
    }
    
    # Crea l'archivio
    Compress-Archive -Path (Join-Path $BACKUP_PATH "*") -DestinationPath $archivePath -Force
    Write-Host "✓ Archivio creato: $BACKUP_NAME.zip" -ForegroundColor Green
    
    # Rimuovi directory non compressa
    Remove-Item -Path $BACKUP_PATH -Recurse -Force
    Write-Host "✓ Directory temporanea rimossa" -ForegroundColor Green
} catch {
    Write-Host "✗ Errore durante la creazione dell'archivio: $_" -ForegroundColor Red
    exit 1
}

# Calcola dimensione backup
$BACKUP_SIZE = (Get-Item $archivePath).Length / 1MB
$BACKUP_SIZE_FORMATTED = "{0:N2} MB" -f $BACKUP_SIZE

Write-Host ""
Write-Host "=== Backup codice sorgente completato! ===" -ForegroundColor Green
Write-Host "File: $archivePath"
Write-Host "Dimensione: $BACKUP_SIZE_FORMATTED"
Write-Host ""


