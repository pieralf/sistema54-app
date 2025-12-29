# Script PowerShell per pulire un file di backup SQL da caratteri non validi UTF-8
# Uso: .\fix_backup_encoding.ps1 -InputFile input.sql -OutputFile output.sql

param(
    [Parameter(Mandatory=$true)]
    [string]$InputFile,
    
    [Parameter(Mandatory=$true)]
    [string]$OutputFile
)

if (-not (Test-Path $InputFile)) {
    Write-Host "ERRORE: File di input non trovato: $InputFile" -ForegroundColor Red
    exit 1
}

Write-Host "Pulizia file di backup in corso..." -ForegroundColor Yellow
Write-Host "Input: $InputFile" -ForegroundColor Cyan
Write-Host "Output: $OutputFile" -ForegroundColor Cyan

try {
    # Leggi il file con encoding UTF-8 ignorando caratteri non validi
    $content = Get-Content -Path $InputFile -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    
    if (-not $content) {
        # Prova con encoding diverso
        $content = [System.IO.File]::ReadAllText($InputFile, [System.Text.Encoding]::UTF8)
    }
    
    # Rimuovi solo caratteri di controllo non validi (0xFF, 0x00, etc.)
    # Mantieni i caratteri UTF-8 validi (accenti, caratteri speciali)
    $content = $content -replace '\x00', ''
    $content = $content -replace '\xFF', ''
    # Rimuovi solo caratteri di controllo non stampabili (mantieni UTF-8 valido)
    $content = [regex]::Replace($content, '[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\xFF]', '')
    
    # Rimuovi BOM se presente
    if ($content.StartsWith([char]0xFEFF)) {
        $content = $content.Substring(1)
    }
    
    # Salva il file pulito
    [System.IO.File]::WriteAllText($OutputFile, $content, [System.Text.UTF8Encoding]::new($false))
    
    $fileSize = (Get-Item $OutputFile).Length / 1KB
    Write-Host ""
    Write-Host "File pulito creato con successo!" -ForegroundColor Green
    Write-Host "  File: $OutputFile" -ForegroundColor Cyan
    Write-Host "  Dimensione: $([math]::Round($fileSize, 2)) KB" -ForegroundColor Cyan
    
    Write-Host ""
    Write-Host "Prime righe del file pulito:" -ForegroundColor Yellow
    Get-Content $OutputFile -TotalCount 5 | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    
    Write-Host ""
    Write-Host "Ora puoi importare il file pulito:" -ForegroundColor Yellow
    Write-Host "  Get-Content $OutputFile | docker exec -i sistema54_db psql -U admin -d sistema54_db" -ForegroundColor Cyan
    
} catch {
    $errorMsg = $_.Exception.Message
    Write-Host ""
    Write-Host "ERRORE durante la pulizia: $errorMsg" -ForegroundColor Red
    exit 1
}
