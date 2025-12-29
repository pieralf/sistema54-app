FROM node:18-alpine

WORKDIR /app

# Copia i file di definizione delle dipendenze
COPY package.json package-lock.json* ./

# 1. Installa le dipendenze base
RUN npm install

# 2. FIX SPECIFICO: Installa esplicitamente react-signature-canvas
# Questo garantisce che la libreria ci sia anche se non è stata salvata nel package.json locale
RUN npm install react-signature-canvas

# Copia il resto del codice sorgente
COPY . .

# Espone la porta di Vite
EXPOSE 5173

# Avvio in modalità sviluppo host
CMD ["npm", "run", "dev", "--", "--host"]