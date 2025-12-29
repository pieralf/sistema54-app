# Fix pgAdmin non disponibile in Portainer

## 🔍 Problema

Dopo aver aggiornato il `docker-compose.portainer.yml` con pgAdmin, il servizio non appare o non è accessibile.

## ✅ Soluzione Passo-Passo

### Metodo 1: Aggiorna lo Stack (CONSIGLIATO)

1. **Vai su Portainer** → **Stacks** → `sistema54`

2. **Clicca su Editor** (o **Update the stack**)

3. **Verifica che il file contenga pgAdmin:**
   - Cerca la sezione `pgadmin:` nel file
   - Dovrebbe essere dopo `frontend:` e prima di `volumes:`

4. **Se pgAdmin NON è presente nel file:**
   - Assicurati di aver fatto commit e push su Git (se usi repository)
   - Oppure copia manualmente la sezione pgAdmin dal file locale

5. **Clicca Update the stack**

6. **Attendi che Portainer ricarichi i servizi**

7. **Verifica i container:**
   - Vai su **Containers**
   - Dovresti vedere `sistema54_pgadmin` nella lista
   - Se è fermo, clicca **Start**

### Metodo 2: Ricrea lo Stack (se Metodo 1 non funziona)

⚠️ **ATTENZIONE**: Questo fermerà temporaneamente tutti i servizi!

1. **Fai un backup del database PRIMA** (importante!):
   ```bash
   docker exec sistema54_db pg_dump -U admin -d sistema54_db > backup_prima_ricreazione.sql
   ```

2. **In Portainer:**
   - **Stacks** → `sistema54` → **Editor**
   - Clicca **Remove Stack** (o **Delete**)
   - Conferma la rimozione

3. **Ricrea lo stack:**
   - **Stacks** → **Add Stack**
   - Nome: `sistema54`
   - Seleziona **Repository** (se usi Git) o **Web editor**
   - Carica il `docker-compose.portainer.yml` completo (con pgAdmin)
   - Clicca **Deploy the stack**

4. **Verifica che tutti i container siano avviati:**
   - **Containers** → dovresti vedere tutti i 4 container:
     - `sistema54_db`
     - `sistema54_backend`
     - `sistema54_frontend`
     - `sistema54_pgadmin`

### Metodo 3: Avvia Manualmente pgAdmin

Se il container esiste ma è fermo:

1. **Portainer** → **Containers** → `sistema54_pgadmin`

2. **Clicca Start**

3. **Verifica i log** se non si avvia:
   - Clicca sul container → **Logs**
   - Cerca errori

### Metodo 4: Verifica Porta 5050

Se la porta 5050 è già in uso:

1. **Portainer** → **Containers**
2. Cerca altri container che usano la porta 5050
3. Se necessario, cambia la porta nel docker-compose:
   ```yaml
   pgadmin:
     # ... altre configurazioni ...
     ports:
       - "5051:80"  # Cambia 5050 in 5051
   ```
4. Aggiorna lo stack

## 🔍 Verifica Post-Fix

Dopo aver applicato il fix:

1. **Verifica che il container sia in esecuzione:**
   - Portainer → **Containers** → `sistema54_pgadmin`
   - Stato dovrebbe essere **Running** (verde)

2. **Accedi a pgAdmin:**
   - URL: `http://IP_SERVER:5050`
   - Dovresti vedere la schermata di login

3. **Login:**
   - Email: `admin@sistema54.com`
   - Password: `sistema54admin`

4. **Verifica i log se non funziona:**
   - Portainer → **Containers** → `sistema54_pgadmin` → **Logs**
   - Cerca errori o messaggi di avvio

## 🐛 Errori Comuni

### Errore: "Port 5050 is already allocated"

**Soluzione:**
- Cambia la porta nel docker-compose da `5050:80` a `5051:80` (o altra porta libera)
- Aggiorna lo stack

### Errore: "Container not found"

**Soluzione:**
- Il servizio pgAdmin non è stato creato
- Usa il Metodo 2 (Ricrea lo Stack)

### Errore: "Cannot connect to pgAdmin"

**Soluzione:**
- Verifica che il container sia in esecuzione
- Controlla i log del container
- Verifica che la porta sia corretta e accessibile

## 📋 Checklist

- [ ] pgAdmin è presente nel docker-compose.portainer.yml
- [ ] Stack aggiornato in Portainer
- [ ] Container `sistema54_pgadmin` esiste e è in esecuzione
- [ ] Porta 5050 non è in uso da altri servizi
- [ ] Accesso a `http://IP_SERVER:5050` funziona
- [ ] Login con `admin@sistema54.com` / `sistema54admin` funziona

## 🆘 Se Nulla Funziona

1. **Controlla i log completi:**
   ```bash
   # Dal server (se hai accesso SSH)
   docker logs sistema54_pgadmin
   ```

2. **Verifica la configurazione docker-compose:**
   - Assicurati che la sezione `pgadmin:` sia corretta
   - Verifica che il volume `sistema54_pgadmin_data` sia definito

3. **Prova a rimuovere e ricreare solo pgAdmin:**
   - Ferma il container `sistema54_pgadmin`
   - Rimuovilo
   - Aggiorna lo stack per ricrearlo

4. **Contatta il supporto** con:
   - Screenshot dei log del container
   - Screenshot della configurazione dello stack
   - Descrizione dettagliata del problema

