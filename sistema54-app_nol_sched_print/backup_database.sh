#!/bin/bash
# Script di Backup Database Sistema54
# Esegue un backup completo del database PostgreSQL

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/sistema54_db_backup_$TIMESTAMP.sql"

# Crea la cartella backups se non esiste
mkdir -p "$BACKUP_DIR"

echo "Inizio backup database..."
echo "File di backup: $BACKUP_FILE"

# Verifica che il container del database sia in esecuzione
if ! docker ps --filter "name=sistema54-db" --format "{{.Names}}" | grep -q "sistema54-db"; then
    echo "ERRORE: Il container del database non è in esecuzione!"
    echo "Avvia il database con: docker-compose up -d db"
    exit 1
fi

# Esegue il backup usando pg_dump dal container
docker exec sistema54-db pg_dump -U admin -d sistema54_db > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo ""
    echo "Backup completato con successo!"
    echo "File: $BACKUP_FILE"
    echo "Dimensione: $FILE_SIZE"
    
    # Mantieni solo gli ultimi 10 backup
    OLD_BACKUPS=$(ls -t "$BACKUP_DIR"/sistema54_db_backup_*.sql 2>/dev/null | tail -n +11)
    if [ -n "$OLD_BACKUPS" ]; then
        echo ""
        echo "Rimozione vecchi backup (mantenuti solo gli ultimi 10)..."
        echo "$OLD_BACKUPS" | xargs rm -f
        echo "Vecchi backup rimossi."
    fi
else
    echo ""
    echo "ERRORE durante il backup!"
    exit 1
fi

echo ""
echo "Per ripristinare un backup:"
echo "  docker exec -i sistema54-db psql -U admin -d sistema54_db < $BACKUP_FILE"

