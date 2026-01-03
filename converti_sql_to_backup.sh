#!/bin/bash
# Script per convertire un file SQL in formato custom (.backup) per pgAdmin
# Questo script deve essere eseguito sul server dove gira Docker/Portainer

if [ -z "$1" ]; then
    echo "ERRORE: Specifica il file SQL da convertire"
    echo "Uso: ./converti_sql_to_backup.sh <file.sql>"
    exit 1
fi

SQL_FILE="$1"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${SQL_FILE%.sql}_custom_${TIMESTAMP}.backup"
TEMP_CONTAINER="sistema54_temp_convert_$$"

# Verifica che il file SQL esista
if [ ! -f "$SQL_FILE" ]; then
    echo "ERRORE: File SQL non trovato: $SQL_FILE"
    exit 1
fi

echo "========================================"
echo "Conversione SQL -> Custom Backup"
echo "========================================"
echo ""
echo "File SQL: $SQL_FILE"
echo "File backup: $BACKUP_FILE"
echo ""

# Verifica che Docker sia disponibile
if ! command -v docker &> /dev/null; then
    echo "ERRORE: Docker non è disponibile!"
    exit 1
fi

# Verifica che il container del database principale sia in esecuzione
DB_CONTAINER=$(docker ps --filter "name=sistema54_db" --format "{{.Names}}")
if [ -z "$DB_CONTAINER" ]; then
    echo "ERRORE: Il container sistema54_db non è in esecuzione!"
    echo ""
    echo "Containers disponibili:"
    docker ps --format "table {{.Names}}\t{{.Status}}"
    exit 1
fi

echo "Container database trovato: $DB_CONTAINER"
echo ""

# Metodo 1: Importa nel database esistente e crea backup custom
echo "Metodo 1: Importazione nel database esistente..."
echo "ATTENZIONE: Questo sovrascriverà i dati nel database corrente!"
read -p "Vuoi continuare? (sì/no): " confirm
if [ "$confirm" != "sì" ] && [ "$confirm" != "si" ] && [ "$confirm" != "yes" ] && [ "$confirm" != "y" ]; then
    echo "Operazione annullata."
    exit 0
fi

echo ""
echo "Passo 1: Importazione file SQL nel database..."
cat "$SQL_FILE" | docker exec -i "$DB_CONTAINER" psql -U admin -d sistema54_db

if [ $? -ne 0 ]; then
    echo "ERRORE durante l'importazione del file SQL!"
    exit 1
fi

echo "Passo 2: Creazione backup in formato custom..."
docker exec "$DB_CONTAINER" pg_dump -U admin -d sistema54_db -Fc -f /tmp/backup_custom.backup

if [ $? -ne 0 ]; then
    echo "ERRORE durante la creazione del backup custom!"
    exit 1
fi

echo "Passo 3: Copia del backup dal container..."
docker cp "$DB_CONTAINER:/tmp/backup_custom.backup" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo ""
    echo "========================================"
    echo "Conversione completata con successo!"
    echo "========================================"
    echo "File backup creato: $BACKUP_FILE"
    echo "Dimensione: $FILE_SIZE"
    echo ""
    echo "Ora puoi caricare questo file in pgAdmin:"
    echo "  1. Apri pgAdmin"
    echo "  2. Clicca destro su sistema54_db -> Restore..."
    echo "  3. Seleziona: $BACKUP_FILE"
else
    echo "ERRORE durante la copia del backup!"
    exit 1
fi







