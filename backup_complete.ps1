# Script di Backup Completo Sistema54
# Esegue backup completo di codice e database

$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = ".\backups"
$codeBackupFile = "$backupDir\sistema54_code_backup_$timestamp.zip"
$dbBackupFile = "$backupDir\sistema54_db_backup_$timestamp.sql"
$completeBackupFile = "$backupDir\sistema54_complete_backup_$timestamp.zip"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BACKUP COMPLETO SISTEMA54" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Crea la cartella backups se non esiste
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    Write-Host "Cartella backups creata: $backupDir" -ForegroundColor Green
}

# ============================================
# 1. BACKUP DATABASE
# ============================================
Write-Host "[1/3] Backup Database..." -ForegroundColor Yellow

# Verifica che il container del database sia in esecuzione
$dbContainer = docker ps --filter "name=sistema54_db" --format "{{.Names}}"
if (-not $dbContainer) {
    Write-Host "ERRORE: Il container del database non è in esecuzione!" -ForegroundColor Red
    Write-Host "Avvia il database con: docker-compose up -d db" -ForegroundColor Yellow
    exit 1
}

# Esegue il backup usando pg_dump dal container
Write-Host "  Esecuzione pg_dump..." -ForegroundColor Gray
docker exec sistema54_db pg_dump -U admin -d sistema54_db > $dbBackupFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERRORE durante il backup del database!" -ForegroundColor Red
    exit 1
}

$dbSize = (Get-Item $dbBackupFile).Length / 1MB
Write-Host "  [OK] Database backup completato: $([math]::Round($dbSize, 2)) MB" -ForegroundColor Green
Write-Host ""

# ============================================
# 2. BACKUP CODICE
# ============================================
Write-Host "[2/3] Backup Codice..." -ForegroundColor Yellow

# Cartelle e file da escludere dal backup
$excludePatterns = @(
    "node_modules",
    "__pycache__",
    "*.pyc",
    ".git",
    ".gitignore",
    "data",
    "backups",
    "*.zip",
    "*.rar",
    "*.log",
    ".env",
    ".vscode",
    ".idea",
    "dist",
    "build",
    ".next",
    "coverage",
    ".pytest_cache",
    "*.swp",
    "*.swo",
    "*~"
)

# Crea un file temporaneo con la lista di esclusione per 7zip
$excludeFile = "$env:TEMP\backup_exclude_$timestamp.txt"
$excludePatterns | ForEach-Object { 
    if ($_ -match "\*") {
        # Pattern con wildcard
        $_ 
    } else {
        # Cartella/file specifico
        "$_\*"
    }
} | Out-File -FilePath $excludeFile -Encoding UTF8

# Verifica se 7zip è disponibile
$sevenZipPath = $null
if (Get-Command "7z" -ErrorAction SilentlyContinue) {
    $sevenZipPath = "7z"
} elseif (Test-Path "C:\Program Files\7-Zip\7z.exe") {
    $sevenZipPath = "C:\Program Files\7-Zip\7z.exe"
} elseif (Get-Command "Compress-Archive" -ErrorAction SilentlyContinue) {
    # Usa PowerShell nativo se 7zip non è disponibile
    Write-Host "  7zip non trovato, uso Compress-Archive (più lento)..." -ForegroundColor Yellow
    
    # Crea una cartella temporanea per il backup
    $tempBackupDir = "$env:TEMP\sistema54_backup_$timestamp"
    if (Test-Path $tempBackupDir) {
        Remove-Item -Path $tempBackupDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $tempBackupDir | Out-Null
    
    # Copia i file escludendo le cartelle non necessarie
    Write-Host "  Copia file..." -ForegroundColor Gray
    Get-ChildItem -Path . -Exclude $excludePatterns | ForEach-Object {
        if ($_.PSIsContainer) {
            # Escludi cartelle specifiche
            if ($_.Name -notin @("node_modules", "__pycache__", ".git", "data", "backups", "dist", "build", ".next", "coverage", ".pytest_cache")) {
                Copy-Item -Path $_.FullName -Destination "$tempBackupDir\$($_.Name)" -Recurse -Force
            }
        } else {
            Copy-Item -Path $_.FullName -Destination "$tempBackupDir\$($_.Name)" -Force
        }
    }
    
    # Crea lo zip
    Write-Host "  Compressione..." -ForegroundColor Gray
    Compress-Archive -Path "$tempBackupDir\*" -DestinationPath $codeBackupFile -Force
    
    # Rimuovi la cartella temporanea
    Remove-Item -Path $tempBackupDir -Recurse -Force
} else {
    Write-Host "ERRORE: Nessun strumento di compressione trovato!" -ForegroundColor Red
    Write-Host "Installa 7-Zip o usa PowerShell 5.0+" -ForegroundColor Yellow
        Remove-Item -Path $excludeFile -ErrorAction SilentlyContinue
    exit 1
}

# Se 7zip è disponibile, usalo (più efficiente)
if ($sevenZipPath) {
    Write-Host "  Compressione con 7zip..." -ForegroundColor Gray
    
    # Costruisci il comando 7zip
    $excludeArgs = Get-Content $excludeFile | ForEach-Object { "-xr!$_" }
    $allExcludeArgs = $excludeArgs -join " "
    
    # Esegui 7zip
    $sevenZipArgs = @(
        "a",
        "-tzip",
        "-mx5",
        $codeBackupFile,
        ".\*",
        $allExcludeArgs
    )
    
    & $sevenZipPath $sevenZipArgs | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRORE durante la compressione del codice!" -ForegroundColor Red
        Remove-Item -Path $excludeFile -ErrorAction SilentlyContinue
        exit 1
    }
}

Remove-Item -Path $excludeFile -ErrorAction SilentlyContinue

$codeSize = (Get-Item $codeBackupFile).Length / 1MB
Write-Host "  [OK] Codice backup completato: $([math]::Round($codeSize, 2)) MB" -ForegroundColor Green
Write-Host ""

# ============================================
# 3. BACKUP COMPLETO (CODICE + DATABASE)
# ============================================
Write-Host "[3/3] Creazione backup completo..." -ForegroundColor Yellow

if ($sevenZipPath) {
    # Usa 7zip per creare il backup completo
    & $sevenZipPath a -tzip -mx5 $completeBackupFile $codeBackupFile $dbBackupFile | Out-Null
} else {
    # Usa Compress-Archive
    Compress-Archive -Path $codeBackupFile, $dbBackupFile -DestinationPath $completeBackupFile -Force
}

if ($LASTEXITCODE -ne 0 -and -not (Test-Path $completeBackupFile)) {
    Write-Host "ERRORE durante la creazione del backup completo!" -ForegroundColor Red
    exit 1
}

$completeSize = (Get-Item $completeBackupFile).Length / 1MB
Write-Host "  [OK] Backup completo creato: $([math]::Round($completeSize, 2)) MB" -ForegroundColor Green
Write-Host ""

# ============================================
# RIEPILOGO
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BACKUP COMPLETATO CON SUCCESSO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "File creati:" -ForegroundColor Yellow
Write-Host "  - Database:     $dbBackupFile" -ForegroundColor Cyan
Write-Host "  - Codice:        $codeBackupFile" -ForegroundColor Cyan
Write-Host "  - Completo:      $completeBackupFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "Dimensioni:" -ForegroundColor Yellow
Write-Host "  - Database:     $([math]::Round($dbSize, 2)) MB" -ForegroundColor Gray
Write-Host "  - Codice:       $([math]::Round($codeSize, 2)) MB" -ForegroundColor Gray
Write-Host "  - Completo:     $([math]::Round($completeSize, 2)) MB" -ForegroundColor Gray
Write-Host ""

# Mantieni solo gli ultimi 10 backup completi
$oldCompleteBackups = Get-ChildItem -Path $backupDir -Filter "sistema54_complete_backup_*.zip" | 
                      Sort-Object LastWriteTime -Descending | 
                      Select-Object -Skip 10
if ($oldCompleteBackups) {
    Write-Host "Rimozione vecchi backup completi (mantenuti solo gli ultimi 10)..." -ForegroundColor Yellow
    $oldCompleteBackups | Remove-Item
    Write-Host "Vecchi backup rimossi." -ForegroundColor Green
}

Write-Host ""
Write-Host "Per ripristinare:" -ForegroundColor Yellow
Write-Host "  1. Estrai il backup completo" -ForegroundColor Gray
Write-Host "  2. Ripristina il database: .\restore_database.ps1 -BackupFile $dbBackupFile" -ForegroundColor Gray
Write-Host "  3. Estrai il codice nella cartella del progetto" -ForegroundColor Gray
Write-Host ""

