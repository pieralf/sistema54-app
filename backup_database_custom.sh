#!/bin/bash
# Script di Backup Database Sistema54 - Formato Custom (per pgAdmin Restore)
# Crea un backup in formato custom che funziona con pg_restore di pgAdmin
# Esegui questo script sul server dove gira Docker/Portainer

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/sistema54_db_backup_custom_$TIMESTAMP.backup"

# Crea la cartella backups se non esiste
mkdir -p "$BACKUP_DIR"

echo "========================================"
echo "Backup Database Sistema54 - Formato Custom"
echo "========================================"
echo ""
echo "Inizio backup database in formato CUSTOM (per pgAdmin)..."
echo "File di backup: $BACKUP_FILE"
echo ""

# Verifica che il container del database sia in esecuzione
DB_CONTAINER=$(docker ps --filter "name=sistema54_db" --format "{{.Names}}")
if [ -z "$DB_CONTAINER" ]; then
    echo "ERRORE: Il container del database non è in esecuzione!"
    echo ""
    echo "Containers disponibili:"
    docker ps --format "table {{.Names}}\t{{.Status}}"
    echo ""
    echo "Se il container ha un nome diverso, modifica lo script o esegui:"
    echo "  docker ps --filter \"name=CONTAINER_NAME\""
    exit 1
fi

echo "Container trovato: $DB_CONTAINER"
echo ""

echo "Creazione backup in formato CUSTOM (compatibile con pg_restore)..."

# Esegue il backup usando pg_dump in formato custom
docker exec "$DB_CONTAINER" pg_dump -U admin -d sistema54_db -Fc -f /tmp/backup_custom.backup

if [ $? -ne 0 ]; then
    echo "ERRORE durante la creazione del backup nel container!"
    exit 1
fi

# Copia il file dal container al server
echo "Copia del backup dal container..."
docker cp "$DB_CONTAINER:/tmp/backup_custom.backup" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo ""
    echo "========================================"
    echo "Backup completato con successo!"
    echo "========================================"
    echo "File: $BACKUP_FILE"
    echo "Dimensione: $FILE_SIZE"
    echo "Formato: CUSTOM (compatibile con pgAdmin Restore Tool)"
    echo ""
    echo "Per ripristinare questo backup:"
    echo "  1. Scarica il file dal server"
    echo "  2. Apri pgAdmin"
    echo "  3. Clicca destro su sistema54_db -> Restore..."
    echo "  4. Seleziona questo file: $BACKUP_FILE"
    echo ""
else
    echo "ERRORE durante la copia del backup!"
    exit 1
fi







