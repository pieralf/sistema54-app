#!/bin/bash
# Script di Ripristino Database Sistema54
# Ripristina un backup del database PostgreSQL

if [ -z "$1" ]; then
    echo "ERRORE: Specifica il file di backup da ripristinare"
    echo "Uso: ./restore_database.sh <file_backup.sql>"
    exit 1
fi

BACKUP_FILE="$1"

# Verifica che il file di backup esista
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERRORE: File di backup non trovato: $BACKUP_FILE"
    exit 1
fi

# Verifica che il container del database sia in esecuzione
if ! docker ps --filter "name=sistema54-db" --format "{{.Names}}" | grep -q "sistema54-db"; then
    echo "ERRORE: Il container del database non è in esecuzione!"
    echo "Avvia il database con: docker-compose up -d db"
    exit 1
fi

echo "ATTENZIONE: Questo processo sovrascriverà il database corrente!"
read -p "Sei sicuro di voler continuare? (sì/no): " confirm
if [ "$confirm" != "sì" ] && [ "$confirm" != "si" ] && [ "$confirm" != "yes" ] && [ "$confirm" != "y" ]; then
    echo "Operazione annullata."
    exit 0
fi

echo ""
echo "Ripristino backup in corso..."
echo "File: $BACKUP_FILE"

# Ripristina il backup
docker exec -i sistema54-db psql -U admin -d sistema54_db < "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "Ripristino completato con successo!"
else
    echo ""
    echo "ERRORE durante il ripristino!"
    exit 1
fi

