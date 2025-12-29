# Usa Python 3.11 Slim per leggerezza e velocità
FROM python:3.11-slim

# Variabili d'ambiente per ottimizzare Python in Docker
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# Installazione dipendenze di sistema (CRUCIALE PER PDF/WEASYPRINT)
# Installiamo: build-essential (compilatori), librerie grafiche per il rendering PDF (cairo, pango, gdk)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    gdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copia e installa i requirements PRIMA del codice (sfrutta la cache di Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copia il resto del codice
COPY . .

# Espone la porta
EXPOSE 8000

# Comando di avvio
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]