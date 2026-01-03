#!/bin/bash
# Script per pulire un file di backup SQL da caratteri non validi UTF-8
# Uso: ./fix_backup_encoding.sh input.sql output.sql

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "ERRORE: Specifica file di input e output"
    echo "Uso: ./fix_backup_encoding.sh input.sql output.sql"
    exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="$2"

if [ ! -f "$INPUT_FILE" ]; then
    echo "ERRORE: File di input non trovato: $INPUT_FILE"
    exit 1
fi

echo "Pulizia file di backup in corso..."
echo "Input: $INPUT_FILE"
echo "Output: $OUTPUT_FILE"

# Metodo 1: Rimuovi caratteri non validi UTF-8
if command -v iconv &> /dev/null; then
    echo "Metodo 1: Usando iconv..."
    iconv -f UTF-8 -t UTF-8 -c "$INPUT_FILE" > "$OUTPUT_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✓ File pulito con successo usando iconv"
    else
        echo "⚠ iconv fallito, provo metodo alternativo..."
        # Metodo alternativo
        sed '1s/^\xEF\xBB\xBF//' "$INPUT_FILE" | sed 's/[^\x00-\x7F]//g' > "$OUTPUT_FILE"
    fi
else
    echo "Metodo alternativo: Usando sed..."
    # Rimuovi BOM e caratteri non stampabili
    sed '1s/^\xEF\xBB\xBF//' "$INPUT_FILE" | sed 's/[^\x00-\x7F]//g' > "$OUTPUT_FILE"
fi

# Rimuovi eventuali caratteri 0xFF rimanenti
sed -i 's/\xff//g' "$OUTPUT_FILE" 2>/dev/null || sed -i '' 's/\xff//g' "$OUTPUT_FILE" 2>/dev/null

# Verifica che il file sia valido
if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo "✓ File pulito creato: $OUTPUT_FILE"
    echo "  Dimensione: $FILE_SIZE"
    echo ""
    echo "Verifica le prime righe:"
    head -5 "$OUTPUT_FILE"
    echo ""
    echo "Ora puoi importare il file pulito:"
    echo "  docker exec -i sistema54_db psql -U admin -d sistema54_db < $OUTPUT_FILE"
else
    echo "ERRORE: File di output non creato correttamente!"
    exit 1
fi










