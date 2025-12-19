#!/bin/bash
# Script di Installazione SISTEMA54 - Linux/Mac
# Questo script installa e configura SISTEMA54 Digital su Linux/Mac

echo "========================================"
echo "  SISTEMA54 Digital - Installazione"
echo "========================================"
echo ""

# Verifica Docker e Docker Compose
echo "[1/6] Verifica prerequisiti..."
if ! command -v docker &> /dev/null; then
    echo "  ✗ Docker non trovato!"
    echo "  Installa Docker da: https://docs.docker.com/get-docker/"
    exit 1
fi
echo "  ✓ Docker trovato: $(docker --version)"

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "  ✗ Docker Compose non trovato!"
    exit 1
fi
echo "  ✓ Docker Compose trovato"

# Verifica che Docker sia in esecuzione
if ! docker ps &> /dev/null; then
    echo "  ✗ Docker non è in esecuzione!"
    echo "  Avvia Docker e riprova"
    exit 1
fi
echo "  ✓ Docker è in esecuzione"

# Crea directory necessarie
echo ""
echo "[2/6] Creazione directory..."
directories=(
    "data/postgres"
    "backend/uploads/logos"
)

for dir in "${directories[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo "  ✓ Creata directory: $dir"
    else
        echo "  ✓ Directory esistente: $dir"
    fi
done

# Verifica file necessari
echo ""
echo "[3/6] Verifica file di configurazione..."
required_files=(
    "docker-compose.yml"
    "backend/Dockerfile"
    "frontend/Dockerfile"
    "backend/requirements.txt"
    "frontend/package.json"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ Trovato: $file"
    else
        echo "  ✗ File mancante: $file"
        exit 1
    fi
done

# Build delle immagini Docker
echo ""
echo "[4/6] Build immagini Docker (questo può richiedere alcuni minuti)..."
echo "  Questo passaggio scarica le dipendenze e compila le immagini..."
if docker compose build; then
    echo "  ✓ Build completato"
else
    echo "  ✗ Errore durante il build!"
    exit 1
fi

# Avvio dei container
echo ""
echo "[5/6] Avvio dei container..."
if docker compose up -d; then
    echo "  ✓ Container avviati"
else
    echo "  ✗ Errore durante l'avvio!"
    exit 1
fi

# Attesa che i servizi siano pronti
echo ""
echo "[6/6] Attesa inizializzazione servizi..."
sleep 10

# Verifica che i container siano in esecuzione
containers=("sistema54_db" "sistema54_backend" "sistema54_frontend")
for container in "${containers[@]}"; do
    if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
        echo "  ✓ $container è in esecuzione"
    else
        echo "  ✗ $container non è in esecuzione!"
    fi
done

# Verifica connessione al database
echo ""
echo "Verifica connessione database..."
sleep 5
if docker exec sistema54_db pg_isready -U admin &> /dev/null; then
    echo "  ✓ Database pronto"
else
    echo "  ⚠ Database non ancora pronto, attendere qualche secondo"
fi

# Informazioni finali
echo ""
echo "========================================"
echo "  Installazione completata!"
echo "========================================"
echo ""
echo "Accesso all'applicazione:"
echo "  Frontend: http://localhost:3000"
echo "  Backend API: http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "Database:"
echo "  Host: localhost:5432"
echo "  Database: sistema54_db"
echo "  User: admin"
echo "  Password: sistema54secure"
echo ""
echo "Comandi utili:"
echo "  Visualizza log: docker compose logs -f"
echo "  Ferma servizi: docker compose down"
echo "  Riavvia servizi: docker compose restart"
echo ""
echo "IMPORTANTE: Crea il primo utente amministratore con:"
echo "  docker exec -it sistema54_backend python create_admin.py"
echo ""
