#!/bin/bash

# Script di backup completo per Sistema54
# Crea un backup del database PostgreSQL e dei file di upload

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Directory di backup
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="sistema54_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

echo -e "${GREEN}=== Backup Sistema54 ===${NC}"
echo "Data/Ora: $(date)"
echo ""

# Crea directory backup se non esiste
mkdir -p "${BACKUP_PATH}"

# 1. Backup Database PostgreSQL
echo -e "${YELLOW}[1/4] Backup database PostgreSQL...${NC}"
docker-compose exec -T db pg_dump -U admin sistema54_db > "${BACKUP_PATH}/database.sql"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database esportato con successo${NC}"
else
    echo -e "${RED}✗ Errore durante l'esportazione del database${NC}"
    exit 1
fi

# 2. Backup file di upload (logo, etc.)
echo -e "${YELLOW}[2/4] Backup file di upload...${NC}"
if [ -d "./backend/uploads" ]; then
    cp -r "./backend/uploads" "${BACKUP_PATH}/uploads"
    echo -e "${GREEN}✓ File di upload copiati${NC}"
else
    echo -e "${YELLOW}⚠ Directory uploads non trovata${NC}"
fi

# 3. Backup configurazioni Docker
echo -e "${YELLOW}[3/4] Backup configurazioni...${NC}"
cp "docker-compose.yml" "${BACKUP_PATH}/docker-compose.yml" 2>/dev/null || echo -e "${YELLOW}⚠ docker-compose.yml non trovato${NC}"
cp ".env" "${BACKUP_PATH}/.env" 2>/dev/null || echo -e "${YELLOW}⚠ .env non trovato${NC}"
cp "backend/.env" "${BACKUP_PATH}/backend.env" 2>/dev/null || echo -e "${YELLOW}⚠ backend/.env non trovato${NC}"
cp "frontend/.env" "${BACKUP_PATH}/frontend.env" 2>/dev/null || echo -e "${YELLOW}⚠ frontend/.env non trovato${NC}"
echo -e "${GREEN}✓ Configurazioni copiate${NC}"

# 4. Crea archivio compresso
echo -e "${YELLOW}[4/4] Creazione archivio compresso...${NC}"
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Archivio creato: ${BACKUP_NAME}.tar.gz${NC}"
    # Rimuovi directory non compressa
    rm -rf "${BACKUP_NAME}"
    echo -e "${GREEN}✓ Directory temporanea rimossa${NC}"
else
    echo -e "${RED}✗ Errore durante la creazione dell'archivio${NC}"
    exit 1
fi

cd - > /dev/null

# Calcola dimensione backup
BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)

echo ""
echo -e "${GREEN}=== Backup completato con successo! ===${NC}"
echo "File: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "Dimensione: ${BACKUP_SIZE}"
echo ""
echo "Per ripristinare il backup:"
echo "  1. Estrai l'archivio: tar -xzf ${BACKUP_NAME}.tar.gz"
echo "  2. Ripristina il database: docker-compose exec -T db psql -U admin sistema54_db < database.sql"
echo "  3. Copia i file upload: cp -r uploads/* backend/uploads/"
echo ""



