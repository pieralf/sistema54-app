from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, status, UploadFile, File, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_
from typing import List, Optional
from datetime import datetime, timedelta, time as dt_time
from fastapi.responses import Response, FileResponse
from . import models, schemas, database, auth
from .services import pdf_service, email_service, two_factor_service
from .utils import get_default_permessi
from .audit_logger import log_action, get_changes_dict
import os
import shutil
from pathlib import Path
import asyncio
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

# Helper per ottenere IP dalla richiesta
def get_client_ip(request: Request) -> str:
    """Ottiene l'IP del client dalla richiesta"""
    # Prova prima X-Forwarded-For (se dietro proxy)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Prende il primo IP nella lista (il client originale)
        return forwarded_for.split(",")[0].strip()
    # Altrimenti usa X-Real-IP o client.host
    return request.headers.get("X-Real-IP") or request.client.host if request.client else "unknown"

# Helper per convertire campi time in stringhe
def convert_intervento_time_fields(intervento: models.Intervento) -> dict:
    """Converte i campi time di un intervento in stringhe per la serializzazione"""
    data = {}
    for key, value in intervento.__dict__.items():
        if isinstance(value, dt_time):
            data[key] = value.strftime('%H:%M')
        else:
            data[key] = value
    return data

# Creazione Tabelle (In produzione useremo Alembic, per ora va bene così)
models.Base.metadata.create_all(bind=database.engine)

# Set globale per tracciare gli interventi per cui l'email è già stata programmata
# Questo evita di inviare email multiple quando vengono create più letture copie rapidamente
_interventi_email_programmate = set()

app = FastAPI(title="SISTEMA54 Digital API - CMMS")

# Configurazione CORS (Fondamentale per far parlare Frontend e Backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In produzione restringere al dominio specifico
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory per upload file
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
LOGO_DIR = UPLOAD_DIR / "logos"
LOGO_DIR.mkdir(exist_ok=True)

# Monta directory static per servire file uploadati
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# --- FUNZIONE PER CONTROLLARE SCADENZE CONTRATTI (NOLEGGIO E ASSISTENZA) ---
def check_scadenze_contratti():
    """Controlla le scadenze dei contratti (noleggio e assistenza) e invia notifiche settimanali da 30 giorni prima"""
    db = next(database.get_db())
    try:
        oggi = datetime.now().date()
        
        # Ottieni impostazioni azienda
        settings = db.query(models.ImpostazioniAzienda).first()
        if not settings:
            settings = models.ImpostazioniAzienda(
                nome_azienda="SISTEMA54",
                indirizzo_completo="Configurazione Richiesta",
                tariffe_categorie={}
            )
            db.add(settings)
            db.commit()
            db.refresh(settings)
        
        if not settings.email_notifiche_scadenze:
            print("Email notifiche scadenze non configurata nelle impostazioni")
            return
        
        # --- CONTROLLO SCADENZE NOLEGGI ---
        # Trova assets in scadenza tra 1 e 30 giorni
        assets_scadenza = db.query(models.AssetCliente).filter(
            models.AssetCliente.data_scadenza_noleggio.isnot(None),
            models.AssetCliente.data_scadenza_noleggio >= oggi,
            models.AssetCliente.data_scadenza_noleggio <= oggi + timedelta(days=30)
        ).all()
        
        # Raggruppa per cliente e calcola giorni alla scadenza
        assets_da_notificare = []
        for asset in assets_scadenza:
            if asset.data_scadenza_noleggio:
                giorni_alla_scadenza = (asset.data_scadenza_noleggio.date() - oggi).days
                # Invia email settimanalmente: ogni lunedì se siamo tra 1-30 giorni dalla scadenza
                # Invia sempre se siamo tra 1-30 giorni (lo scheduler gira ogni lunedì)
                if 1 <= giorni_alla_scadenza <= 30:
                    assets_da_notificare.append({
                        'asset': asset,
                        'giorni_alla_scadenza': giorni_alla_scadenza,
                        'tipo': 'noleggio'
                    })
        
        # --- CONTROLLO SCADENZE CONTRATTI ASSISTENZA ---
        clienti_con_contratto = db.query(models.Cliente).filter(
            models.Cliente.has_contratto_assistenza == True,
            models.Cliente.data_fine_contratto_assistenza.isnot(None),
            models.Cliente.data_fine_contratto_assistenza >= oggi,
            models.Cliente.data_fine_contratto_assistenza <= oggi + timedelta(days=30)
        ).all()
        
        contratti_da_notificare = []
        for cliente in clienti_con_contratto:
            if cliente.data_fine_contratto_assistenza:
                giorni_alla_scadenza = (cliente.data_fine_contratto_assistenza.date() - oggi).days
                # Invia email settimanalmente: ogni lunedì se siamo tra 1-30 giorni dalla scadenza
                # Invia sempre se siamo tra 1-30 giorni (lo scheduler gira ogni lunedì)
                if 1 <= giorni_alla_scadenza <= 30:
                    contratti_da_notificare.append({
                        'cliente': cliente,
                        'giorni_alla_scadenza': giorni_alla_scadenza,
                        'tipo': 'assistenza'
                    })
        
        # --- INVIO EMAIL PER NOLEGGI ---
        assets_per_cliente = {}
        for item in assets_da_notificare:
            asset = item['asset']
            cliente_id = asset.cliente_id
            if cliente_id not in assets_per_cliente:
                assets_per_cliente[cliente_id] = []
            assets_per_cliente[cliente_id].append(item)
        
        for cliente_id, items in assets_per_cliente.items():
            cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
            if not cliente:
                continue
            
            # Carica sedi del cliente
            sedi_cliente = db.query(models.SedeCliente).filter(
                models.SedeCliente.cliente_id == cliente_id
            ).all()
            
            # Email all'azienda
            assets_list = [item['asset'] for item in items]
            subject_azienda = f"Avviso Scadenza Contratti Noleggio - Cliente {cliente.ragione_sociale}"
            body_azienda_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                        <h1>Avviso Scadenza Contratti Noleggio</h1>
                    </div>
                    <div style="background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb;">
                        <p>Il cliente <strong>{cliente.ragione_sociale}</strong> ha {len(assets_list)} contratto/i di noleggio in scadenza:</p>
                        <ul>
                            {''.join([f'<li>{a.tipo_asset}: {a.marca or ""} {a.modello or a.descrizione or ""} - Scade: {a.data_scadenza_noleggio.strftime("%d/%m/%Y") if a.data_scadenza_noleggio else "N/A"} (Giorni rimanenti: {items[i]["giorni_alla_scadenza"]})</li>' for i, a in enumerate(assets_list)])}
                        </ul>
                    </div>
                </div>
            </body>
            </html>
            """
            email_service.send_email(
                settings.email_notifiche_scadenze,
                subject_azienda,
                body_azienda_html,
                db=db
            )
            
            # Email al cliente (email principale)
            if cliente.email_amministrazione:
                for item in items:
                    asset = item['asset']
                    # Carica info sede se disponibile
                    sede_info = None
                    if asset.sede_id:
                        sede = db.query(models.SedeCliente).filter(models.SedeCliente.id == asset.sede_id).first()
                        if sede:
                            sede_info = {
                                'nome_sede': sede.nome_sede,
                                'indirizzo_completo': sede.indirizzo_completo,
                                'email': sede.email
                            }
                    
                    asset_dict = {
                        'tipo_asset': asset.tipo_asset,
                        'marca': asset.marca,
                        'modello': asset.modello,
                        'descrizione': asset.descrizione,
                        'data_scadenza_noleggio': asset.data_scadenza_noleggio
                    }
                    subject, body_html = email_service.generate_scadenza_contratto_email(
                        cliente_nome=cliente.ragione_sociale,
                        tipo_contratto="noleggio",
                        giorni_alla_scadenza=item['giorni_alla_scadenza'],
                        azienda_nome=settings.nome_azienda or "Sistema 54",
                        azienda_telefono=settings.telefono or "",
                        azienda_email=settings.email or "",
                        asset_info=asset_dict,
                        sede_info=sede_info
                    )
                    email_service.send_email(
                        cliente.email_amministrazione,
                        subject,
                        body_html,
                        db=db
                    )
            
            # Email alle sedi interessate (se hanno email e l'asset è associato a quella sede)
            for item in items:
                asset = item['asset']
                if asset.sede_id:
                    sede = db.query(models.SedeCliente).filter(models.SedeCliente.id == asset.sede_id).first()
                    if sede and sede.email:
                        sede_info = {
                            'nome_sede': sede.nome_sede,
                            'indirizzo_completo': sede.indirizzo_completo,
                            'email': sede.email
                        }
                        asset_dict = {
                            'tipo_asset': asset.tipo_asset,
                            'marca': asset.marca,
                            'modello': asset.modello,
                            'descrizione': asset.descrizione,
                            'data_scadenza_noleggio': asset.data_scadenza_noleggio
                        }
                        subject, body_html = email_service.generate_scadenza_contratto_email(
                            cliente_nome=f"{cliente.ragione_sociale} - {sede.nome_sede}",
                            tipo_contratto="noleggio",
                            giorni_alla_scadenza=item['giorni_alla_scadenza'],
                            azienda_nome=settings.nome_azienda or "Sistema 54",
                            azienda_telefono=settings.telefono or "",
                            azienda_email=settings.email or "",
                            asset_info=asset_dict,
                            sede_info=sede_info
                        )
                        email_service.send_email(
                            sede.email,
                            subject,
                            body_html,
                            db=db
                        )
        
        # --- INVIO EMAIL PER CONTRATTI ASSISTENZA ---
        for item in contratti_da_notificare:
            cliente = item['cliente']
            
            # Carica sedi del cliente
            sedi_cliente = db.query(models.SedeCliente).filter(
                models.SedeCliente.cliente_id == cliente.id
            ).all()
            
            # Email all'azienda
            contratto_dict = {
                'data_fine_contratto_assistenza': cliente.data_fine_contratto_assistenza
            }
            subject_azienda = f"Avviso Scadenza Contratto Assistenza - Cliente {cliente.ragione_sociale}"
            giorni_rimanenti = item['giorni_alla_scadenza']
            data_scadenza = cliente.data_fine_contratto_assistenza.strftime('%d/%m/%Y') if cliente.data_fine_contratto_assistenza else 'N/A'
            body_azienda_html = f"""
            <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
                        <h1>Avviso Scadenza Contratto Assistenza</h1>
                    </div>
                    <div style="background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb;">
                        <p>Il cliente <strong>{cliente.ragione_sociale}</strong> ha un contratto di assistenza in scadenza:</p>
                        <ul>
                            <li>Data Scadenza: {data_scadenza}</li>
                            <li>Giorni Rimanenti: {giorni_rimanenti}</li>
                        </ul>
                    </div>
                </div>
            </body>
            </html>
            """
            email_service.send_email(
                settings.email_notifiche_scadenze,
                subject_azienda,
                body_azienda_html,
                db=db
            )
            
            # Email al cliente (email principale)
            if cliente.email_amministrazione:
                subject, body_html = email_service.generate_scadenza_contratto_email(
                    cliente_nome=cliente.ragione_sociale,
                    tipo_contratto="assistenza",
                    giorni_alla_scadenza=giorni_rimanenti,
                    azienda_nome=settings.nome_azienda or "Sistema 54",
                    azienda_telefono=settings.telefono or "",
                    azienda_email=settings.email or "",
                    contratto_info=contratto_dict
                )
                email_service.send_email(
                    cliente.email_amministrazione,
                    subject,
                    body_html,
                    db=db
                )
            
            # Email a tutte le sedi del cliente (se hanno email)
            for sede in sedi_cliente:
                if sede.email:
                    subject, body_html = email_service.generate_scadenza_contratto_email(
                        cliente_nome=f"{cliente.ragione_sociale} - {sede.nome_sede}",
                        tipo_contratto="assistenza",
                        giorni_alla_scadenza=giorni_rimanenti,
                        azienda_nome=settings.nome_azienda or "Sistema 54",
                        azienda_telefono=settings.telefono or "",
                        azienda_email=settings.email or "",
                        contratto_info=contratto_dict,
                        sede_info={
                            'nome_sede': sede.nome_sede,
                            'indirizzo_completo': sede.indirizzo_completo,
                            'email': sede.email
                        }
                    )
                    email_service.send_email(
                        sede.email,
                        subject,
                        body_html,
                        db=db
                    )
        
        totale_notifiche = len(assets_da_notificare) + len(contratti_da_notificare)
        if totale_notifiche > 0:
            print(f"Notifiche scadenze inviate: {len(assets_da_notificare)} noleggi, {len(contratti_da_notificare)} contratti assistenza")
        else:
            print("Nessuna scadenza contratto da notificare questa settimana")
        
    except Exception as e:
        print(f"Errore controllo scadenze contratti: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

# --- FUNZIONE HELPER PER CALCOLARE GIORNI DA CADENZA ---
def get_giorni_da_cadenza(cadenza: str) -> int:
    """Converte la cadenza letture copie in giorni"""
    cadenze = {
        "mensile": 30,
        "bimestrale": 60,
        "trimestrale": 90,
        "semestrale": 180
    }
    return cadenze.get(cadenza or "trimestrale", 90)  # Default trimestrale

def get_mesi_da_cadenza(cadenza: str) -> int:
    """Converte la cadenza letture copie in numero di mesi"""
    cadenze = {
        "mensile": 1,
        "bimestrale": 2,
        "trimestrale": 3,
        "semestrale": 6
    }
    return cadenze.get(cadenza or "trimestrale", 3)  # Default trimestrale

# --- FUNZIONE PER CONTROLLARE SCADENZE LETTURE COPIE ---
def check_scadenze_letture_copie():
    """Controlla le scadenze delle letture copie e invia alert 7 giorni prima della scadenza basata sulla cadenza configurata"""
    db = next(database.get_db())
    try:
        # Trova tutti gli asset Printing a noleggio
        assets_printing = db.query(models.AssetCliente).filter(
            models.AssetCliente.tipo_asset == "Printing"
        ).all()
        
        if not assets_printing:
            print("Nessun asset Printing trovato")
            return
        
        # Ottieni impostazioni azienda
        settings = db.query(models.ImpostazioniAzienda).first()
        if not settings or not settings.email_avvisi_promemoria:
            print("Email avvisi promemoria non configurata")
            return
        
        # Raggruppa per cliente
        clienti_da_notificare: dict = {}
        
        for asset in assets_printing:
            # Ottieni cadenza letture copie (default trimestrale)
            cadenza = asset.cadenza_letture_copie or "trimestrale"
            giorni_cadenza = get_giorni_da_cadenza(cadenza)
            
            # Ottieni ultima lettura
            ultima_lettura = db.query(models.LetturaCopie).filter(
                models.LetturaCopie.asset_id == asset.id
            ).order_by(desc(models.LetturaCopie.data_lettura)).first()
            
            if not ultima_lettura:
                # Se non c'è lettura, usa data installazione
                data_riferimento = asset.data_installazione or datetime.now()
            else:
                data_riferimento = ultima_lettura.data_lettura
            
            # Calcola quando scade la lettura in base alla cadenza configurata
            data_scadenza_lettura = data_riferimento + timedelta(days=giorni_cadenza)
            
            # Verifica se siamo tra 6 e 7 giorni prima della scadenza
            giorni_alla_scadenza = (data_scadenza_lettura - datetime.now()).days
            if 6 <= giorni_alla_scadenza <= 7:
                cliente_id = asset.cliente_id
                if cliente_id not in clienti_da_notificare:
                    cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
                    if cliente:
                        clienti_da_notificare[cliente_id] = {
                            'cliente': cliente,
                            'assets': []
                        }
                
                # Calcola prossima lettura dovuta
                prossima_lettura_dovuta = data_riferimento + timedelta(days=giorni_cadenza)
                
                clienti_da_notificare[cliente_id]['assets'].append({
                    'marca': asset.marca or '',
                    'modello': asset.modello or '',
                    'matricola': asset.matricola or '',
                    'data_ultima_lettura': ultima_lettura.data_lettura if ultima_lettura else data_riferimento,
                    'cadenza': cadenza,
                    'prossima_lettura_dovuta': prossima_lettura_dovuta
                })
        
        # Invia email per ogni cliente
        for cliente_id, dati in clienti_da_notificare.items():
            cliente = dati['cliente']
            assets = dati['assets']
            
            subject, body_html = email_service.generate_alert_letture_copie_email(
                cliente_nome=cliente.ragione_sociale,
                cliente_id=cliente_id,
                assets_info=assets,
                azienda_nome=settings.nome_azienda or "SISTEMA54"
            )
            
            email_service.send_email(
                to_email=settings.email_avvisi_promemoria,
                subject=subject,
                body_html=body_html,
                db=db
            )
            print(f"Alert letture copie inviato per cliente {cliente.ragione_sociale} (ID: {cliente_id})")
        
    except Exception as e:
        print(f"Errore controllo scadenze letture copie: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

# --- SCHEDULER PER NOTIFICHE SCADENZE ---
scheduler = BackgroundScheduler()
scheduler.add_job(
    check_scadenze_contratti,
    trigger=CronTrigger(day_of_week='mon', hour=9, minute=0),  # Ogni lunedì alle 9:00
    id='check_scadenze_contratti',
    name='Controllo scadenze contratti (noleggio e assistenza) - Settimanale',
    replace_existing=True
)
scheduler.add_job(
    check_scadenze_letture_copie,
    trigger=CronTrigger(hour=9, minute=0),  # Ogni giorno alle 9:00
    id='check_scadenze_letture_copie',
    name='Controllo scadenze letture copie',
    replace_existing=True
)
scheduler.start()
print("Scheduler notifiche scadenze avviato:")
print("  - Contratti (noleggio e assistenza): ogni lunedì alle 9:00")
print("  - Letture copie: ogni giorno alle 9:00")

# --- FUNZIONE MOCK EMAIL ---
def send_email_background(
    email_to: str, 
    pdf_content: bytes, 
    numero_rit: str, 
    azienda_nome: str, 
    data_intervento: datetime,
    azienda_indirizzo: str = "",
    azienda_telefono: str = "",
    azienda_email: str = "",
    db: Session = None
):
    """
    Invia email con PDF del RIT al destinatario specificato.
    Se db è fornito, usa il servizio email reale, altrimenti usa mock.
    """
    if not db:
        # Mock mode (per compatibilità)
        print(f"--- [EMAIL MOCK] ---")
        print(f"TO: {email_to}")
        print(f"OGGETTO: Rapporto Intervento Tecnico {azienda_nome} del {data_intervento.strftime('%d/%m/%Y')}")
        print("--------------------")
        return
    
    try:
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from email.mime.base import MIMEBase
        from email import encoders
        import base64
        
        # Ottieni configurazione SMTP
        smtp_config = email_service.get_smtp_config(db)
        if not smtp_config.get('username') or not smtp_config.get('password'):
            # Se SMTP non configurato, usa mock
            print(f"--- [EMAIL MOCK - SMTP non configurato] ---")
            print(f"TO: {email_to}")
            print(f"OGGETTO: Rapporto Intervento Tecnico {azienda_nome} del {data_intervento.strftime('%d/%m/%Y')}")
            print("--------------------")
            return
        
        # Formatta data intervento
        data_intervento_formattata = data_intervento.strftime('%d/%m/%Y')
        
        # Crea messaggio
        msg = MIMEMultipart()
        msg['From'] = smtp_config.get('from_email', smtp_config.get('username'))
        msg['To'] = email_to
        msg['Subject'] = f"Rapporto Intervento Tecnico {azienda_nome} del {data_intervento_formattata}"
        
        # Prepara dati azienda per il footer
        footer_azienda = azienda_nome
        if azienda_indirizzo:
            footer_azienda += f"\n{azienda_indirizzo}"
        if azienda_telefono:
            footer_azienda += f"\nTel: {azienda_telefono}"
        if azienda_email:
            footer_azienda += f"\nEmail: {azienda_email}"
        
        # Corpo email formale con GDPR
        body_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.8; color: #333; }}
                .container {{ max-width: 700px; margin: 0 auto; padding: 20px; }}
                .content {{ background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }}
                .footer {{ background-color: #f3f4f6; padding: 20px; font-size: 11px; color: #6b7280; border-top: 2px solid #e5e7eb; margin-top: 30px; }}
                p {{ margin-bottom: 15px; }}
                .signature {{ margin-top: 30px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="content">
                    <p>Gentile Cliente,</p>
                    
                    <p>con la presente Le trasmettiamo in allegato il Rapporto di Intervento Tecnico, relativo all'attività svolta presso la Sua sede e/o sul sistema di Sua competenza il giorno <strong>{data_intervento_formattata}</strong>, a seguito della chiusura del RIT aperto per intervento richiesto o intervento ordinario.</p>
                    
                    <p>Il documento riepiloga le operazioni effettuate, le eventuali verifiche eseguite e l'esito finale dell'intervento, e viene inviato per finalità di:</p>
                    
                    <ul>
                        <li>adempimento contrattuale e/o precontrattuale;</li>
                        <li>corretta gestione del rapporto commerciale e tecnico in essere;</li>
                        <li>tracciabilità e documentazione delle attività svolte.</li>
                    </ul>
                    
                    <p>Ai sensi del Regolamento (UE) 2016/679 (GDPR) e della normativa nazionale vigente in materia di protezione dei dati personali, il trattamento dei dati contenuti nel rapporto avviene esclusivamente per le finalità sopra indicate, nel rispetto dei principi di liceità, correttezza, trasparenza e minimizzazione dei dati.</p>
                    
                    <p>La base giuridica del trattamento è costituita dall'esecuzione di obblighi contrattuali e/o di misure precontrattuali (art. 6, par. 1, lett. b GDPR), nonché dall'adempimento di obblighi di legge e da legittimi interessi del Titolare del trattamento connessi alla gestione tecnica e amministrativa del servizio.</p>
                    
                    <p>Il documento allegato è destinato esclusivamente al destinatario indicato. Qualora lo abbia ricevuto per errore, La invitiamo a darcene tempestiva comunicazione e a procedere alla sua cancellazione, astenendosi da qualsiasi utilizzo o diffusione non autorizzata.</p>
                    
                    <p>Restiamo a disposizione per eventuali chiarimenti o ulteriori necessità.</p>
                    
                    <p class="signature">Cordiali saluti,<br>
                    <strong>{footer_azienda}</strong></p>
                </div>
                <div class="footer">
                    <p><strong>Nota:</strong> Questa è una comunicazione automatica. Si prega di non rispondere direttamente a questa email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        body_text = f"""Rapporto Intervento Tecnico

Gentile Cliente,

con la presente Le trasmettiamo in allegato il Rapporto di Intervento Tecnico, relativo all'attività svolta presso la Sua sede e/o sul sistema di Sua competenza il giorno {data_intervento_formattata}, a seguito della chiusura del RIT aperto per intervento richiesto o intervento ordinario.

Il documento riepiloga le operazioni effettuate, le eventuali verifiche eseguite e l'esito finale dell'intervento, e viene inviato per finalità di:

- adempimento contrattuale e/o precontrattuale;
- corretta gestione del rapporto commerciale e tecnico in essere;
- tracciabilità e documentazione delle attività svolte.

Ai sensi del Regolamento (UE) 2016/679 (GDPR) e della normativa nazionale vigente in materia di protezione dei dati personali, il trattamento dei dati contenuti nel rapporto avviene esclusivamente per le finalità sopra indicate, nel rispetto dei principi di liceità, correttezza, trasparenza e minimizzazione dei dati.

La base giuridica del trattamento è costituita dall'esecuzione di obblighi contrattuali e/o di misure precontrattuali (art. 6, par. 1, lett. b GDPR), nonché dall'adempimento di obblighi di legge e da legittimi interessi del Titolare del trattamento connessi alla gestione tecnica e amministrativa del servizio.

Il documento allegato è destinato esclusivamente al destinatario indicato. Qualora lo abbia ricevuto per errore, La invitiamo a darcene tempestiva comunicazione e a procedere alla sua cancellazione, astenendosi da qualsiasi utilizzo o diffusione non autorizzata.

Restiamo a disposizione per eventuali chiarimenti o ulteriori necessità.

Cordiali saluti,
{footer_azienda}

---
Nota: Questa è una comunicazione automatica. Si prega di non rispondere direttamente a questa email.
        """
        
        # Aggiungi corpo
        msg.attach(MIMEText(body_text, 'plain'))
        msg.attach(MIMEText(body_html, 'html'))
        
        # Aggiungi PDF come allegato
        part = MIMEBase('application', 'octet-stream')
        part.set_payload(pdf_content)
        encoders.encode_base64(part)
        part.add_header(
            'Content-Disposition',
            f'attachment; filename= "{numero_rit}.pdf"'
        )
        msg.attach(part)
        
        # Invia email
        import smtplib
        with smtplib.SMTP(smtp_config.get('host', 'smtp.gmail.com'), smtp_config.get('port', 587)) as server:
            if smtp_config.get('use_tls', True):
                server.starttls()
            server.login(smtp_config.get('username'), smtp_config.get('password'))
            server.send_message(msg)
        
        print(f"✅ Email inviata con successo a {email_to} per RIT {numero_rit}")
        
    except Exception as e:
        print(f"⚠️ Errore invio email a {email_to}: {str(e)}")
        import traceback
        traceback.print_exc()

def genera_numero_rit(db: Session) -> str:
    anno_corrente = datetime.now().year
    prefix = f"RIT-{anno_corrente}-"
    ultimo_rit = db.query(models.Intervento)\
        .filter(models.Intervento.numero_relazione.like(f"{prefix}%"))\
        .order_by(desc(models.Intervento.id))\
        .first()
    if not ultimo_rit:
        nuovo_progressivo = 1
    else:
        try:
            parts = ultimo_rit.numero_relazione.split('-')
            last_num = int(parts[-1])
            nuovo_progressivo = last_num + 1
        except:
            nuovo_progressivo = 1 
    return f"{prefix}{nuovo_progressivo:03d}"

def get_settings_or_default(db: Session):
    settings = db.query(models.ImpostazioniAzienda).first()
    if not settings:
        settings = models.ImpostazioniAzienda(
            nome_azienda="SISTEMA54",
            indirizzo_completo="Configurazione Richiesta",
            p_iva=None,
            tariffe_categorie={}
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

# --- INIZIALIZZAZIONE SUPERADMIN (Solo se non esiste) ---
def init_superadmin(db: Session):
    """Crea il primo superadmin se non esiste"""
    try:
        superadmin = db.query(models.Utente).filter(
            models.Utente.email == "admin@sistema54.it"
        ).first()
        
        if not superadmin:
            # Crea superadmin di default
            password = "admin123"
            password_hash = auth.get_password_hash(password)
            default_superadmin = models.Utente(
                email="admin@sistema54.it",
                password_hash=password_hash,
                nome_completo="Super Admin",
                ruolo=models.RuoloUtente.SUPERADMIN,
                is_active=True,
                permessi=get_default_permessi("superadmin")
            )
            db.add(default_superadmin)
            db.commit()
            db.refresh(default_superadmin)
            print("✅ SuperAdmin creato: admin@sistema54.it / admin123")
            return True
        else:
            print(f"ℹ️ SuperAdmin già esistente: {superadmin.email}")
            # Verifica che abbia una password hash
            if not superadmin.password_hash:
                password_hash = auth.get_password_hash("admin123")
                superadmin.password_hash = password_hash
                db.commit()
                print("✅ Password hash aggiornata per SuperAdmin")
            # Aggiorna permessi se non sono impostati
            if not superadmin.permessi or superadmin.permessi == {}:
                superadmin.permessi = get_default_permessi("superadmin")
                db.commit()
                print("✅ Permessi di default applicati al SuperAdmin")
            return False
    except Exception as e:
        print(f"⚠️ Errore creazione superadmin: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False

# Esegui all'avvio - con gestione errori
try:
    with database.SessionLocal() as db:
        init_superadmin(db)
except Exception as e:
    print(f"⚠️ Errore inizializzazione superadmin all'avvio: {e}")
    print("L'utente verrà creato al primo login se necessario.")

# --- API AUTENTICAZIONE ---

@app.post("/api/auth/login", response_model=schemas.Token, tags=["Autenticazione"])
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(database.get_db),
    two_factor_code: str = Query(None, description="Codice 2FA per superadmin")
):
    """Login con email e password, con supporto 2FA per superadmin
    
    Se two_factor_code è presente come query parameter, viene usato per verificare 2FA.
    """
    # Verifica se l'utente esiste, altrimenti prova a crearlo
    user_db = db.query(models.Utente).filter(models.Utente.email == form_data.username).first()
    if not user_db:
        # Se non esiste e sono le credenziali di default, crealo
        if form_data.username == "admin@sistema54.it":
            init_superadmin(db)
            user_db = db.query(models.Utente).filter(models.Utente.email == form_data.username).first()
    
    if not user_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o password non corretti",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o password non corretti",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Se è superadmin e ha 2FA abilitato, richiedi verifica
    if user.ruolo == models.RuoloUtente.SUPERADMIN and user.two_factor_enabled:
        if not two_factor_code:
            # Richiedi codice 2FA
            return {
                "access_token": "",
                "token_type": "bearer",
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "nome_completo": user.nome_completo,
                    "ruolo": user.ruolo.value
                },
                "requires_2fa": True
            }
        
        # Verifica codice 2FA
        is_valid = False
        updated_backup_codes = user.two_factor_backup_codes or []
        
        # Prova prima con TOTP
        if user.two_factor_secret:
            is_valid = two_factor_service.verify_totp(user.two_factor_secret, two_factor_code)
        
        # Se non valido, prova con backup codes
        if not is_valid and updated_backup_codes:
            is_valid, updated_backup_codes = two_factor_service.verify_backup_code(
                updated_backup_codes, two_factor_code
            )
            if is_valid:
                # Aggiorna backup codes nel database
                user.two_factor_backup_codes = updated_backup_codes
                db.commit()
        
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Codice 2FA non valido",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email, "ruolo": user.ruolo.value},
        expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "nome_completo": user.nome_completo,
            "ruolo": user.ruolo.value
        },
        "requires_2fa": False
    }

@app.post("/api/auth/register", response_model=schemas.UserResponse, tags=["Autenticazione"])
def register(user_data: schemas.UserCreate, db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.require_admin)):
    """Registra un nuovo utente (solo admin)"""
    # Verifica se email esiste già
    existing = db.query(models.Utente).filter(models.Utente.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email già registrata")
    
    # Determina il ruolo
    ruolo_enum = models.RuoloUtente[user_data.ruolo.upper()] if hasattr(models.RuoloUtente, user_data.ruolo.upper()) else models.RuoloUtente.OPERATORE
    
    # Crea nuovo utente con permessi di default
    db_user = models.Utente(
        email=user_data.email,
        password_hash=auth.get_password_hash(user_data.password),
        nome_completo=user_data.nome_completo,
        ruolo=ruolo_enum,
        is_active=True,
        permessi=get_default_permessi(ruolo_enum.value)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/api/auth/me", response_model=schemas.UserResponse, tags=["Autenticazione"])
def get_current_user_info(current_user: models.Utente = Depends(auth.get_current_active_user)):
    """Ottiene informazioni sull'utente corrente"""
    return current_user

# --- API 2FA (Solo SuperAdmin) ---

@app.post("/api/auth/2fa/setup", response_model=schemas.TwoFactorSetupResponse, tags=["Autenticazione"])
def setup_2fa(
    current_user: models.Utente = Depends(auth.require_superadmin),
    db: Session = Depends(database.get_db)
):
    """Genera secret e QR code per configurare 2FA (solo superadmin)"""
    if current_user.ruolo != models.RuoloUtente.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Solo i superadmin possono configurare 2FA")
    
    # Genera nuovo secret
    secret = two_factor_service.generate_secret()
    
    # Genera QR code
    qr_code = two_factor_service.generate_qr_code(secret, current_user.email)
    
    # Genera codici di backup
    backup_codes = two_factor_service.generate_backup_codes(10)
    
    # Salva secret e backup codes nel database (ma non abilita ancora 2FA)
    current_user.two_factor_secret = secret
    current_user.two_factor_backup_codes = backup_codes
    db.commit()
    
    return {
        "secret": secret,
        "qr_code": qr_code,
        "backup_codes": backup_codes
    }

@app.post("/api/auth/2fa/enable", tags=["Autenticazione"])
def enable_2fa(
    verify_request: schemas.TwoFactorVerifyRequest,
    current_user: models.Utente = Depends(auth.require_superadmin),
    db: Session = Depends(database.get_db)
):
    """Abilita 2FA dopo aver verificato il codice (solo superadmin)"""
    if current_user.ruolo != models.RuoloUtente.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Solo i superadmin possono abilitare 2FA")
    
    if not current_user.two_factor_secret:
        raise HTTPException(status_code=400, detail="Devi prima configurare 2FA")
    
    # Verifica il codice
    is_valid = two_factor_service.verify_totp(current_user.two_factor_secret, verify_request.code)
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Codice 2FA non valido")
    
    # Abilita 2FA
    current_user.two_factor_enabled = True
    db.commit()
    
    return {"message": "2FA abilitato con successo"}

@app.post("/api/auth/2fa/disable", tags=["Autenticazione"])
def disable_2fa(
    verify_request: schemas.TwoFactorVerifyRequest,
    current_user: models.Utente = Depends(auth.require_superadmin),
    db: Session = Depends(database.get_db)
):
    """Disabilita 2FA dopo aver verificato il codice (solo superadmin)"""
    if current_user.ruolo != models.RuoloUtente.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Solo i superadmin possono disabilitare 2FA")
    
    if not current_user.two_factor_enabled:
        raise HTTPException(status_code=400, detail="2FA non è abilitato")
    
    # Verifica il codice prima di disabilitare
    is_valid = False
    if current_user.two_factor_secret:
        is_valid = two_factor_service.verify_totp(current_user.two_factor_secret, verify_request.code)
    
    # Se non valido, prova con backup codes
    if not is_valid and current_user.two_factor_backup_codes:
        is_valid, _ = two_factor_service.verify_backup_code(
            current_user.two_factor_backup_codes, verify_request.code
        )
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Codice 2FA non valido")
    
    # Disabilita 2FA
    current_user.two_factor_enabled = False
    current_user.two_factor_secret = None
    current_user.two_factor_backup_codes = None
    db.commit()
    
    return {"message": "2FA disabilitato con successo"}

@app.post("/api/auth/2fa/regenerate-backup", tags=["Autenticazione"])
def regenerate_backup_codes(
    current_user: models.Utente = Depends(auth.require_superadmin),
    db: Session = Depends(database.get_db)
):
    """Rigenera codici di backup per 2FA (solo superadmin)"""
    if current_user.ruolo != models.RuoloUtente.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Solo i superadmin possono rigenerare backup codes")
    
    if not current_user.two_factor_enabled:
        raise HTTPException(status_code=400, detail="2FA non è abilitato")
    
    # Genera nuovi backup codes
    backup_codes = two_factor_service.generate_backup_codes(10)
    current_user.two_factor_backup_codes = backup_codes
    db.commit()
    
    return {"backup_codes": backup_codes}

@app.post("/api/auth/oauth", response_model=schemas.Token, tags=["Autenticazione"])
def oauth_login(oauth_data: schemas.OAuthLoginRequest, db: Session = Depends(database.get_db)):
    """Login con OAuth (Google, Microsoft) - Placeholder per implementazione futura"""
    # TODO: Implementare verifica token OAuth
    raise HTTPException(status_code=501, detail="OAuth non ancora implementato")

# --- API UTENTI (Solo Admin) ---

@app.get("/api/users/", response_model=List[schemas.UserResponse], tags=["Utenti"])
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.require_admin)):
    """Lista tutti gli utenti (solo admin)"""
    return db.query(models.Utente).offset(skip).limit(limit).all()

@app.put("/api/users/{user_id}", response_model=schemas.UserResponse, tags=["Utenti"])
def update_user(user_id: int, user_update: schemas.UserUpdate, request: Request, db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.require_admin)):
    """Aggiorna un utente (solo admin)"""
    db_user = db.query(models.Utente).filter(models.Utente.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    # SuperAdmin può modificare tutto, Admin solo utenti non-superadmin
    if current_user.ruolo != models.RuoloUtente.SUPERADMIN and db_user.ruolo == models.RuoloUtente.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Non puoi modificare un SuperAdmin")
    
    # Salva stato originale per audit log
    user_originale = models.Utente(
        email=db_user.email,
        nome_completo=db_user.nome_completo,
        ruolo=db_user.ruolo,
        is_active=db_user.is_active,
        permessi=db_user.permessi.copy() if db_user.permessi else {}
    )
    
    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data:
        update_data["password_hash"] = auth.get_password_hash(update_data.pop("password"))
    if "ruolo" in update_data:
        nuovo_ruolo = models.RuoloUtente[update_data["ruolo"].upper()]
        update_data["ruolo"] = nuovo_ruolo
        # Se il ruolo è cambiato e non ci sono permessi personalizzati, applica i permessi di default
        if nuovo_ruolo != db_user.ruolo and (not update_data.get("permessi") or update_data.get("permessi") == {}):
            update_data["permessi"] = get_default_permessi(nuovo_ruolo.value)
    
    # Se permessi non sono specificati e l'utente non ha permessi, applica i default in base al ruolo
    if "permessi" not in update_data and (not db_user.permessi or db_user.permessi == {}):
        update_data["permessi"] = get_default_permessi(db_user.ruolo.value)
    
    # Gestione 2FA per superadmin (solo se current_user è superadmin)
    if "two_factor_enabled" in update_data and db_user.ruolo == models.RuoloUtente.SUPERADMIN:
        if current_user.ruolo == models.RuoloUtente.SUPERADMIN:
            # Solo un superadmin può abilitare/disabilitare 2FA per altri superadmin
            db_user.two_factor_enabled = update_data.pop("two_factor_enabled")
            # Se si disabilita, rimuovi anche secret e backup codes
            if not db_user.two_factor_enabled:
                db_user.two_factor_secret = None
                db_user.two_factor_backup_codes = None
        else:
            # Admin non può modificare 2FA di superadmin
            update_data.pop("two_factor_enabled", None)
    
    for key, value in update_data.items():
        setattr(db_user, key, value)
    
    db.commit()
    db.refresh(db_user)
    
    # Log audit con modifiche
    fields_to_track = ['email', 'nome_completo', 'ruolo', 'is_active']
    changes = get_changes_dict(user_originale, db_user, fields_to_track)
    
    # Traccia anche modifiche ai permessi se presenti
    if 'permessi' in update_data and user_originale.permessi != db_user.permessi:
        if 'permessi' not in changes:
            changes['permessi'] = {}
        changes['permessi']['old'] = user_originale.permessi
        changes['permessi']['new'] = db_user.permessi
    
    log_action(
        db=db,
        user=current_user,
        action="UPDATE",
        entity_type="utente",
        entity_id=db_user.id,
        entity_name=db_user.nome_completo or db_user.email,
        changes=changes if changes else None,
        ip_address=get_client_ip(request)
    )
    
    return db_user

# --- API GEOCODING (Proxy per Nominatim) ---

@app.get("/api/geocoding/search", tags=["Geocoding"])
def search_addresses(
    q: str = Query(..., description="Query di ricerca indirizzo"),
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.get_current_active_user)
):
    """Proxy per Nominatim API per cercare indirizzi italiani (evita problemi CORS)"""
    import requests
    
    try:
        # Chiama Nominatim API
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": f"{q}, Italia",
            "format": "json",
            "addressdetails": "1",
            "limit": "5",
            "countrycodes": "it",
            "accept-language": "it"
        }
        
        # Aggiungi User-Agent come richiesto da Nominatim
        headers = {
            "User-Agent": "Sistema54-App/1.0"
        }
        
        response = requests.get(url, params=params, headers=headers, timeout=5)
        response.raise_for_status()
        
        return response.json()
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Errore nella ricerca indirizzi: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore interno: {str(e)}")

# --- API UPLOAD LOGO ---

@app.post("/api/upload/logo", tags=["Upload"])
def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_admin)
):
    """Upload logo azienda"""
    # Verifica estensione
    allowed_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'}
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Formato file non supportato. Usa PNG, JPG, GIF, SVG o WEBP")
    
    # Salva file
    filename = f"logo_{datetime.now().strftime('%Y%m%d_%H%M%S')}{file_ext}"
    file_path = LOGO_DIR / filename
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Aggiorna impostazioni
        settings = get_settings_or_default(db)
        # Rimuovi vecchio logo se esiste
        if settings.logo_url and settings.logo_url.startswith("/uploads/logos/"):
            old_path = UPLOAD_DIR / settings.logo_url.replace("/uploads/", "")
            if old_path.exists():
                old_path.unlink()
        
        logo_url = f"/uploads/logos/{filename}"
        settings.logo_url = logo_url
        db.commit()
        
        return {"logo_url": logo_url, "message": "Logo caricato con successo"}
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Errore durante l'upload: {str(e)}")

# --- API CLIENTI (CORRETTA) ---

@app.post("/clienti/", response_model=schemas.ClienteResponse, tags=["Clienti"])
def create_cliente(cliente: schemas.ClienteCreate, request: Request, db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.get_current_active_user)):
    # 1. Controllo Duplicati (Solo se PIVA o CF sono forniti E non vuoti)
    p_iva_valida = cliente.p_iva and cliente.p_iva.strip()
    cf_valido = cliente.codice_fiscale and cliente.codice_fiscale.strip()
    
    if p_iva_valida or cf_valido:
        filters = []
        if p_iva_valida:
            # Confronta solo con record che hanno P.IVA non vuota/null e corrispondente
            filters.append(
                and_(
                    models.Cliente.p_iva.isnot(None),
                    models.Cliente.p_iva != "",
                    models.Cliente.p_iva == cliente.p_iva.strip()
                )
            )
        if cf_valido:
            # Confronta solo con record che hanno CF non vuoto/null e corrispondente
            filters.append(
                and_(
                    models.Cliente.codice_fiscale.isnot(None),
                    models.Cliente.codice_fiscale != "",
                    models.Cliente.codice_fiscale == cliente.codice_fiscale.strip()
                )
            )
        
        if filters:
            existing = db.query(models.Cliente).filter(or_(*filters)).first()
            if existing:
                detail_msg = f"Cliente già esistente: '{existing.ragione_sociale}' (ID: {existing.id}). Modifica il cliente esistente invece di crearne uno nuovo."
                raise HTTPException(status_code=400, detail=detail_msg)

    try:
        # 2. Creazione Cliente
        cliente_data = cliente.model_dump(exclude={"assets_noleggio", "sedi"})
        db_cliente = models.Cliente(**cliente_data)
        db.add(db_cliente)
        db.flush() # Ottiene l'ID senza committare definitivamente

        # 3. Aggiunta Sedi (se multisede è abilitato)
        # Se sede_legale_operativa è abilitata, crea automaticamente la sede legale
        if cliente.sede_legale_operativa:
            # Verifica se esiste già una sede legale per questo cliente
            sede_legale_esistente = db.query(models.SedeCliente).filter(
                models.SedeCliente.cliente_id == db_cliente.id,
                models.SedeCliente.nome_sede == "Sede Legale/Centrale"
            ).first()
            
            if not sede_legale_esistente:
                # Crea la sede legale come sede operativa
                indirizzo_completo = f"{db_cliente.indirizzo}, {db_cliente.citta or ''} {db_cliente.cap or ''}".strip()
                db_sede_legale = models.SedeCliente(
                    cliente_id=db_cliente.id,
                    nome_sede="Sede Legale/Centrale",
                    indirizzo_completo=indirizzo_completo,
                    citta=db_cliente.citta,
                    cap=db_cliente.cap,
                    telefono=None,
                    email=db_cliente.email_amministrazione
                )
                db.add(db_sede_legale)
        
        # Aggiungi altre sedi se multisede è abilitato
        if cliente.has_multisede and cliente.sedi:
            for sede in cliente.sedi:
                # Evita di creare duplicati se la sede legale è già stata creata
                if cliente.sede_legale_operativa and sede.nome_sede == "Sede Legale/Centrale":
                    continue
                db_sede = models.SedeCliente(**sede.model_dump(), cliente_id=db_cliente.id)
                db.add(db_sede)

        # 4. Aggiunta Assets (se presenti)
        if hasattr(cliente, 'assets_noleggio') and cliente.assets_noleggio:
            for asset in cliente.assets_noleggio:
                asset_dict = asset.model_dump()
                # Assicurati che sede_id sia null se 0 o non valido
                if asset_dict.get('sede_id') == 0 or asset_dict.get('sede_id') == '0':
                    asset_dict['sede_id'] = None
                db_asset = models.AssetCliente(**asset_dict, cliente_id=db_cliente.id)
                db.add(db_asset)
        
        db.commit() # Commit unico atomico
        db.refresh(db_cliente)
        
        # Log audit
        log_action(
            db=db,
            user=current_user,
            action="CREATE",
            entity_type="cliente",
            entity_id=db_cliente.id,
            entity_name=db_cliente.ragione_sociale,
            ip_address=get_client_ip(request)
        )
        
        return db_cliente

    except Exception as e:
        db.rollback() # Annulla tutto se c'è un errore
        print(f"Errore DB: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Errore interno durante il salvataggio: {str(e)}")

@app.get("/clienti/", response_model=List[schemas.ClienteResponse], tags=["Clienti"])
def search_clienti(q: str = "", db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.get_current_active_user)):
    query = db.query(models.Cliente)
    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                models.Cliente.ragione_sociale.ilike(search),
                models.Cliente.p_iva.ilike(search),
                models.Cliente.codice_fiscale.ilike(search)
            )
        )
    result = query.order_by(models.Cliente.ragione_sociale.asc()).limit(50).all()
    print(f"[DEBUG] Endpoint /clienti/ chiamato - query: '{q}', risultati: {len(result)}")
    return result

@app.get("/clienti/{cliente_id}", response_model=schemas.ClienteResponse, tags=["Clienti"])
def get_cliente(cliente_id: int, db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.get_current_active_user)):
    """Ottiene un cliente con le sue sedi e assets"""
    db_cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not db_cliente:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    # Forza il caricamento delle relazioni
    _ = db_cliente.sedi  # Carica sedi
    _ = db_cliente.assets_noleggio  # Carica assets noleggio
    return db_cliente

@app.get("/clienti/{cliente_id}/sedi", response_model=List[schemas.SedeClienteResponse], tags=["Clienti"])
def get_sedi_cliente(cliente_id: int, db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.get_current_active_user)):
    """Ottiene tutte le sedi di un cliente"""
    db_cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not db_cliente:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    return db_cliente.sedi

@app.put("/clienti/{cliente_id}", response_model=schemas.ClienteResponse, tags=["Clienti"])
def update_cliente(cliente_id: int, cliente: schemas.ClienteCreate, request: Request, db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.get_current_active_user)):
    """Aggiorna un cliente e le sue sedi"""
    db_cliente = db.query(models.Cliente).filter(models.Cliente.id == cliente_id).first()
    if not db_cliente:
        raise HTTPException(status_code=404, detail="Cliente non trovato")
    
    try:
        # Salva stato originale per audit log
        cliente_originale = models.Cliente(
            ragione_sociale=db_cliente.ragione_sociale,
            indirizzo=db_cliente.indirizzo,
            citta=db_cliente.citta,
            cap=db_cliente.cap,
            p_iva=db_cliente.p_iva,
            codice_fiscale=db_cliente.codice_fiscale,
            email_amministrazione=db_cliente.email_amministrazione,
            has_contratto_assistenza=db_cliente.has_contratto_assistenza,
            has_noleggio=db_cliente.has_noleggio,
            has_multisede=db_cliente.has_multisede
        )
        
        # Aggiorna dati cliente (escludendo sedi e assets)
        update_data = cliente.model_dump(exclude_unset=True, exclude={"assets_noleggio", "sedi"})
        # Assicurati che is_pa e codice_sdi siano sempre inclusi (anche se False o vuoto)
        # Usa model_dump() senza exclude_unset per ottenere tutti i campi, anche quelli con valori di default
        cliente_dict_full = cliente.model_dump(exclude={"assets_noleggio", "sedi"})
        # Includi sempre is_pa e codice_sdi se presenti nel payload completo
        if 'is_pa' in cliente_dict_full:
            update_data['is_pa'] = cliente_dict_full['is_pa']
        if 'codice_sdi' in cliente_dict_full:
            update_data['codice_sdi'] = cliente_dict_full['codice_sdi'] or ''
        for key, value in update_data.items():
            setattr(db_cliente, key, value)
        
        # PRIMA: Gestione assets (devono essere gestiti prima delle sedi per evitare violazioni FK)
        # IMPORTANTE: Non eliminare gli asset esistenti per preservare contatori iniziali e letture copie
        # Ottieni gli ID delle sedi che saranno referenziate dai nuovi assets
        sedi_referenziate_da_nuovi_assets = set()
        
        if hasattr(cliente, 'assets_noleggio') and cliente.assets_noleggio is not None and len(cliente.assets_noleggio) > 0:
            # Carica gli asset esistenti per questo cliente
            assets_esistenti = {a.id: a for a in db.query(models.AssetCliente).filter(models.AssetCliente.cliente_id == cliente_id).all()}
            
            # Ottieni gli ID degli asset che hanno letture copie associate (non possono essere eliminati)
            assets_con_letture_copie = set()
            for asset_id in assets_esistenti.keys():
                letture_count = db.query(models.LetturaCopie).filter(models.LetturaCopie.asset_id == asset_id).count()
                if letture_count > 0:
                    assets_con_letture_copie.add(asset_id)
            
            # Processa gli asset nuovi/aggiornati
            assets_processati_ids = set()
            for asset in cliente.assets_noleggio:
                asset_dict = asset.model_dump() if hasattr(asset, 'model_dump') else asset
                # Rimuovi eventuali campi non presenti nel modello
                asset_dict.pop('tipo_configurazione_bn', None)
                asset_dict.pop('tipo_configurazione_colore', None)
                # Assicurati che sede_id sia null se 0 o non valido
                if asset_dict.get('sede_id') == 0 or asset_dict.get('sede_id') == '0':
                    asset_dict['sede_id'] = None
                
                asset_id = asset_dict.get('id')
                sede_id = asset_dict.get('sede_id')
                if sede_id and sede_id != 0 and sede_id != '0':
                    sedi_referenziate_da_nuovi_assets.add(int(sede_id))
                
                if asset_id and asset_id in assets_esistenti:
                    # Aggiorna asset esistente - PRESERVA i contatori iniziali se non vengono modificati esplicitamente
                    db_asset = assets_esistenti[asset_id]
                    assets_processati_ids.add(asset_id)
                    
                    # Salva i contatori iniziali esistenti prima dell'aggiornamento
                    contatore_bn_originale = db_asset.contatore_iniziale_bn
                    contatore_colore_originale = db_asset.contatore_iniziale_colore
                    
                    # Aggiorna tutti i campi tranne i contatori iniziali (se non specificati esplicitamente)
                    for key, value in asset_dict.items():
                        if key != 'id' and hasattr(db_asset, key):
                            # Se il campo è un contatore iniziale e il valore è 0 o None, preserva il valore esistente
                            if key == 'contatore_iniziale_bn' and (value is None or value == 0):
                                # Preserva il valore esistente se non viene specificato esplicitamente
                                continue
                            elif key == 'contatore_iniziale_colore' and (value is None or value == 0):
                                # Preserva il valore esistente se non viene specificato esplicitamente
                                continue
                            else:
                                setattr(db_asset, key, value)
                    
                    # Se i contatori iniziali non sono stati specificati nel payload, preservali
                    if 'contatore_iniziale_bn' not in asset_dict or asset_dict.get('contatore_iniziale_bn') is None or asset_dict.get('contatore_iniziale_bn') == 0:
                        db_asset.contatore_iniziale_bn = contatore_bn_originale
                    if 'contatore_iniziale_colore' not in asset_dict or asset_dict.get('contatore_iniziale_colore') is None or asset_dict.get('contatore_iniziale_colore') == 0:
                        db_asset.contatore_iniziale_colore = contatore_colore_originale
                else:
                    # Crea nuovo asset (senza ID o con ID non esistente)
                    asset_dict.pop('id', None)  # Rimuovi ID se presente ma non valido
                    db_asset = models.AssetCliente(**asset_dict, cliente_id=db_cliente.id)
                    db.add(db_asset)
            
            # Elimina solo gli asset che non sono più nella lista E non hanno letture copie associate
            for asset_id, asset in assets_esistenti.items():
                if asset_id not in assets_processati_ids and asset_id not in assets_con_letture_copie:
                    # L'asset non è più nella lista e non ha letture copie, può essere eliminato
                    db.delete(asset)
        elif not hasattr(cliente, 'assets_noleggio') or not cliente.has_noleggio or (hasattr(cliente, 'assets_noleggio') and (cliente.assets_noleggio is None or len(cliente.assets_noleggio) == 0)):
            # Se noleggio è disabilitato o non ci sono assets, elimina solo quelli senza letture copie
            assets_esistenti = db.query(models.AssetCliente).filter(models.AssetCliente.cliente_id == cliente_id).all()
            for asset in assets_esistenti:
                letture_count = db.query(models.LetturaCopie).filter(models.LetturaCopie.asset_id == asset.id).count()
                if letture_count == 0:
                    # Nessuna lettura copie associata, può essere eliminato
                    db.delete(asset)
                else:
                    # Ha letture copie associate, NON eliminare (preserva i dati storici)
                    print(f"[UPDATE CLIENTE] Asset {asset.id} ({asset.marca} {asset.modello}) ha {letture_count} letture copie associate - NON eliminato")
        
        # POI: Gestione sedi (ora che gli assets sono stati gestiti)
        # Gestione sede legale operativa
        if cliente.sede_legale_operativa:
            # Verifica se esiste già una sede legale per questo cliente
            sede_legale_esistente = db.query(models.SedeCliente).filter(
                models.SedeCliente.cliente_id == cliente_id,
                models.SedeCliente.nome_sede == "Sede Legale/Centrale"
            ).first()
            
            if not sede_legale_esistente:
                # Crea la sede legale come sede operativa
                indirizzo_completo = f"{db_cliente.indirizzo}, {db_cliente.citta or ''} {db_cliente.cap or ''}".strip()
                db_sede_legale = models.SedeCliente(
                    cliente_id=db_cliente.id,
                    nome_sede="Sede Legale/Centrale",
                    indirizzo_completo=indirizzo_completo,
                    citta=db_cliente.citta,
                    cap=db_cliente.cap,
                    telefono=None,
                    email=db_cliente.email_amministrazione
                )
                db.add(db_sede_legale)
            else:
                # Aggiorna la sede legale esistente con i dati del cliente
                sede_legale_esistente.indirizzo_completo = f"{db_cliente.indirizzo}, {db_cliente.citta or ''} {db_cliente.cap or ''}".strip()
                sede_legale_esistente.citta = db_cliente.citta
                sede_legale_esistente.cap = db_cliente.cap
                sede_legale_esistente.email = db_cliente.email_amministrazione
        else:
            # Se sede_legale_operativa è disabilitata, elimina la sede legale se non è in uso
            sede_legale_esistente = db.query(models.SedeCliente).filter(
                models.SedeCliente.cliente_id == cliente_id,
                models.SedeCliente.nome_sede == "Sede Legale/Centrale"
            ).first()
            
            if sede_legale_esistente:
                # Verifica se la sede legale è in uso (da interventi o assets)
                sede_in_uso_interventi = db.query(models.Intervento.sede_id).filter(
                    models.Intervento.sede_id == sede_legale_esistente.id
                ).first()
                sede_in_uso_assets = db.query(models.AssetCliente.sede_id).filter(
                    models.AssetCliente.sede_id == sede_legale_esistente.id
                ).first()
                
                if not sede_in_uso_interventi and not sede_in_uso_assets:
                    # La sede legale non è in uso, può essere eliminata
                    db.delete(sede_legale_esistente)
        
        if cliente.has_multisede and cliente.sedi is not None:
            # Ottieni le sedi esistenti
            sedi_esistenti = {s.id: s for s in db.query(models.SedeCliente).filter(models.SedeCliente.cliente_id == cliente_id).all()}
            # Ottieni gli ID delle sedi referenziate da interventi (non possono essere eliminate)
            sedi_in_uso_result = db.query(models.Intervento.sede_id).filter(
                models.Intervento.sede_id.isnot(None)
            ).distinct().all()
            sedi_in_uso_interventi = {s[0] for s in sedi_in_uso_result if s[0] in sedi_esistenti}
            # Unisci le sedi in uso (da interventi e dai nuovi assets)
            sedi_in_uso = sedi_in_uso_interventi | sedi_referenziate_da_nuovi_assets
            
            # Processa le sedi nuove/aggiornate (escludendo la sede legale se è gestita automaticamente)
            sedi_processate_ids = set()
            for sede_data in cliente.sedi:
                sede_dict = sede_data.model_dump() if hasattr(sede_data, 'model_dump') else sede_data
                # Salta la sede legale se è gestita automaticamente
                if cliente.sede_legale_operativa and sede_dict.get('nome_sede') == "Sede Legale/Centrale":
                    continue
                    
                sede_id = sede_dict.get('id')
                
                if sede_id and sede_id in sedi_esistenti:
                    # Aggiorna sede esistente tramite ID
                    db_sede = sedi_esistenti[sede_id]
                    sedi_processate_ids.add(sede_id)
                    for key, value in sede_dict.items():
                        if key != 'id' and hasattr(db_sede, key):
                            setattr(db_sede, key, value)
                else:
                    # Nessun ID o ID non esistente: verifica se esiste già una sede con stesso nome e indirizzo
                    nome_sede = sede_dict.get('nome_sede')
                    indirizzo_completo = sede_dict.get('indirizzo_completo')
                    
                    # Cerca una sede esistente con stesso nome e indirizzo per questo cliente
                    sede_esistente_per_nome = None
                    if nome_sede and indirizzo_completo:
                        sede_esistente_per_nome = db.query(models.SedeCliente).filter(
                            models.SedeCliente.cliente_id == cliente_id,
                            models.SedeCliente.nome_sede == nome_sede,
                            models.SedeCliente.indirizzo_completo == indirizzo_completo
                        ).first()
                    
                    if sede_esistente_per_nome:
                        # Aggiorna la sede esistente invece di crearne una nuova
                        sedi_processate_ids.add(sede_esistente_per_nome.id)
                        for key, value in sede_dict.items():
                            if key != 'id' and hasattr(sede_esistente_per_nome, key):
                                setattr(sede_esistente_per_nome, key, value)
                    else:
                        # Crea nuova sede solo se non esiste già una con stesso nome e indirizzo
                        sede_dict.pop('id', None)  # Rimuovi ID se presente ma non valido
                        db_sede = models.SedeCliente(**sede_dict, cliente_id=db_cliente.id)
                        db.add(db_sede)
            
            # Elimina solo le sedi che non sono in uso e non sono più nella lista
            for sede_id, sede in sedi_esistenti.items():
                if sede_id not in sedi_in_uso and sede_id not in sedi_processate_ids:
                    db.delete(sede)
        elif not cliente.has_multisede:
            # Se multisede è disabilitato, elimina solo le sedi non referenziate
            sedi_in_uso_interventi_result = db.query(models.Intervento.sede_id).filter(
                models.Intervento.sede_id.isnot(None)
            ).distinct().all()
            sedi_in_uso_interventi = {s[0] for s in sedi_in_uso_interventi_result}
            # Unisci le sedi in uso (da interventi e dai nuovi assets)
            sedi_in_uso = sedi_in_uso_interventi | sedi_referenziate_da_nuovi_assets
            
            # Elimina solo le sedi non in uso
            if sedi_in_uso:
                db.query(models.SedeCliente).filter(
                    models.SedeCliente.cliente_id == cliente_id,
                    ~models.SedeCliente.id.in_(sedi_in_uso)
                ).delete(synchronize_session=False)
            else:
                # Nessuna sede in uso, elimina tutte
                db.query(models.SedeCliente).filter(
                    models.SedeCliente.cliente_id == cliente_id
                ).delete()
        
        db.commit()
        db.refresh(db_cliente)
        
        # Log audit con modifiche
        fields_to_track = ['ragione_sociale', 'indirizzo', 'citta', 'cap', 'p_iva', 'codice_fiscale', 
                          'email_amministrazione', 'has_contratto_assistenza', 'has_noleggio', 'has_multisede']
        changes = get_changes_dict(cliente_originale, db_cliente, fields_to_track)
        
        log_action(
            db=db,
            user=current_user,
            action="UPDATE",
            entity_type="cliente",
            entity_id=db_cliente.id,
            entity_name=db_cliente.ragione_sociale,
            changes=changes if changes else None,
            ip_address=get_client_ip(request)
        )
        
        return db_cliente
    except Exception as e:
        db.rollback()
        print(f"Errore aggiornamento cliente: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Errore interno durante l'aggiornamento: {str(e)}")

# --- API MAGAZZINO ---

@app.post("/magazzino/", response_model=schemas.ProdottoResponse, tags=["Magazzino"])
def create_prodotto(prodotto: schemas.ProdottoCreate, request: Request, db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.get_current_active_user)):
    existing = db.query(models.ProdottoMagazzino).filter(models.ProdottoMagazzino.codice_articolo == prodotto.codice_articolo).first()
    if existing:
        raise HTTPException(status_code=400, detail="Codice articolo già esistente.")

    db_prodotto = models.ProdottoMagazzino(**prodotto.model_dump())
    db.add(db_prodotto)
    db.commit()
    db.refresh(db_prodotto)
    
    # Log audit
    log_action(
        db=db,
        user=current_user,
        action="CREATE",
        entity_type="magazzino",
        entity_id=db_prodotto.id,
        entity_name=db_prodotto.codice_articolo or db_prodotto.descrizione,
        ip_address=get_client_ip(request)
    )
    
    return db_prodotto

@app.get("/magazzino/", response_model=List[schemas.ProdottoResponse], tags=["Magazzino"])
def read_magazzino(q: str = "", skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.get_current_active_user)):
    query = db.query(models.ProdottoMagazzino)
    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                models.ProdottoMagazzino.codice_articolo.ilike(search),
                models.ProdottoMagazzino.descrizione.ilike(search)
            )
        )
    return query.order_by(models.ProdottoMagazzino.descrizione.asc()).offset(skip).limit(limit).all()

@app.put("/magazzino/{prodotto_id}", response_model=schemas.ProdottoResponse, tags=["Magazzino"])
def update_prodotto(prodotto_id: int, prodotto: schemas.ProdottoUpdate, request: Request, db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.get_current_active_user)):
    db_prodotto = db.query(models.ProdottoMagazzino).filter(models.ProdottoMagazzino.id == prodotto_id).first()
    if not db_prodotto:
        raise HTTPException(status_code=404, detail="Prodotto non trovato")
    
    # Salva stato originale per audit log
    prodotto_originale = models.ProdottoMagazzino(
        codice_articolo=db_prodotto.codice_articolo,
        descrizione=db_prodotto.descrizione,
        prezzo_vendita=db_prodotto.prezzo_vendita,
        costo_acquisto=db_prodotto.costo_acquisto,
        giacenza=db_prodotto.giacenza,
        categoria=db_prodotto.categoria
    )
    
    update_data = prodotto.model_dump(exclude_unset=True)
    
    # Verifica che codice_articolo non sia duplicato (se viene aggiornato)
    if 'codice_articolo' in update_data and update_data['codice_articolo']:
        existing = db.query(models.ProdottoMagazzino).filter(
            models.ProdottoMagazzino.codice_articolo == update_data['codice_articolo'],
            models.ProdottoMagazzino.id != prodotto_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Codice articolo già esistente per un altro prodotto")
    
    for key, value in update_data.items():
        setattr(db_prodotto, key, value)
    
    db.commit()
    db.refresh(db_prodotto)
    
    # Log audit con modifiche
    fields_to_track = ['codice_articolo', 'descrizione', 'prezzo_vendita', 'costo_acquisto', 'giacenza', 'categoria']
    changes = get_changes_dict(prodotto_originale, db_prodotto, fields_to_track)
    
    log_action(
        db=db,
        user=current_user,
        action="UPDATE",
        entity_type="magazzino",
        entity_id=db_prodotto.id,
        entity_name=db_prodotto.codice_articolo or db_prodotto.descrizione,
        changes=changes if changes else None,
        ip_address=get_client_ip(request)
    )
    
    return db_prodotto

# --- API RIT ---

@app.post("/interventi/", response_model=schemas.InterventoResponse, tags=["R.I.T."])
def create_intervento(
    intervento: schemas.InterventoCreate, 
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.get_current_active_user)
):
    settings = get_settings_or_default(db)
    
    try:
        # 1. Calcolo Prezzi
        cat_key = intervento.macro_categoria.value 
        tariffe = settings.tariffe_categorie.get(cat_key, {"orario": 50.0, "chiamata": 30.0}) 
        std_orario = tariffe.get("orario", 50.0)
        std_chiamata = tariffe.get("chiamata", 30.0)

        costo_chiamata = 0.0
        tariffa_oraria = 0.0
        
        # 2. Generazione Numero
        numero_auto = genera_numero_rit(db)

        # 3. Verifica Cliente e Gestione Sede (se multisede)
        db_cliente = db.query(models.Cliente).filter(models.Cliente.id == intervento.cliente_id).first()
        if not db_cliente:
            raise HTTPException(status_code=404, detail="Cliente non trovato")
        
        # Verifica se ci sono prodotti a noleggio nei dettagli (PRIMA di gestire il contratto assistenza)
        has_noleggio_assets = False
        if db_cliente.has_noleggio and intervento.dettagli:
            # Carica gli assets a noleggio del cliente
            assets_noleggio = db.query(models.AssetCliente).filter(
                models.AssetCliente.cliente_id == db_cliente.id
            ).all()
            
            # Verifica se almeno uno dei dettagli corrisponde a un asset a noleggio
            for dettaglio in intervento.dettagli:
                for asset in assets_noleggio:
                    # Confronta marca/modello e seriale/matricola
                    dettaglio_marca_modello = (dettaglio.marca_modello or "").strip().lower()
                    asset_marca_modello = f"{asset.marca or ''} {asset.modello or ''}".strip().lower()
                    
                    if dettaglio_marca_modello and asset_marca_modello and dettaglio_marca_modello in asset_marca_modello:
                        # Verifica anche seriale/matricola se disponibile
                        if dettaglio.serial_number:
                            if (asset.tipo_asset == "IT" and asset.seriale and dettaglio.serial_number.strip().lower() == asset.seriale.strip().lower()) or \
                               (asset.tipo_asset == "Printing" and asset.matricola and dettaglio.serial_number.strip().lower() == asset.matricola.strip().lower()):
                                has_noleggio_assets = True
                                break
                        else:
                            # Se non c'è seriale, considera comunque se marca/modello corrispondono
                            has_noleggio_assets = True
                            break
                if has_noleggio_assets:
                    break
        
        # Gestione costo chiamata e contatore contratto assistenza
        # IMPORTANTE: Non scalare le chiamate se è un intervento Printing con prodotti a noleggio
        chiamate_utilizzate_precedenti = None
        chiamate_utilizzate_attuali = None
        chiamate_rimanenti = None
        
        # Scala le chiamate solo se:
        # 1. È un contratto assistenza E
        # 2. NON è un intervento Printing con prodotti a noleggio (il noleggio ha il suo contratto separato)
        # 3. Per RIT Printing: scala solo se NON ci sono prodotti a noleggio selezionati
        is_printing_with_noleggio = intervento.macro_categoria.value == "Printing & Office" and has_noleggio_assets
        is_printing_without_noleggio = intervento.macro_categoria.value == "Printing & Office" and not has_noleggio_assets
        
        # Scala le chiamate se:
        # - È un contratto assistenza E
        # - NON è Printing con prodotti a noleggio (se è Printing senza noleggio, scala normalmente)
        if intervento.is_contratto and db_cliente.has_contratto_assistenza and not is_printing_with_noleggio:
            # Cliente con contratto assistenza (IT/altro): verifica limite chiamate
            if db_cliente.limite_chiamate_contratto is not None:
                # Ha un limite di chiamate: incrementa il contatore (scala le chiamate incluse)
                chiamate_utilizzate_precedenti = db_cliente.chiamate_utilizzate_contratto or 0
                chiamate_utilizzate_attuali = chiamate_utilizzate_precedenti + 1
                chiamate_rimanenti = max(0, db_cliente.limite_chiamate_contratto - chiamate_utilizzate_attuali)
                
                # Aggiorna il contatore sul cliente
                db_cliente.chiamate_utilizzate_contratto = chiamate_utilizzate_attuali
                # Assicurati che la modifica sia tracciata dalla sessione
                db.add(db_cliente)
                
                print(f"[CONTRATTO ASSISTENZA] Cliente {db_cliente.id} - Chiamate utilizzate: {chiamate_utilizzate_precedenti} -> {chiamate_utilizzate_attuali} (limite: {db_cliente.limite_chiamate_contratto}, rimanenti: {chiamate_rimanenti})")
                
                # Se supera il limite, applica il costo fuori limite
                if chiamate_utilizzate_attuali > db_cliente.limite_chiamate_contratto:
                    costo_chiamata = db_cliente.costo_chiamata_fuori_limite or 0.0
                    print(f"[CONTRATTO ASSISTENZA] Limite superato! Applicato costo fuori limite: €{costo_chiamata}")
                else:
                    costo_chiamata = 0.0
                    print(f"[CONTRATTO ASSISTENZA] Chiamata inclusa nel contratto (gratuita)")
            else:
                # Nessun limite: chiamata gratuita
                costo_chiamata = 0.0
                print(f"[CONTRATTO ASSISTENZA] Cliente {db_cliente.id} - Nessun limite chiamate, chiamata gratuita")
            tariffa_oraria = 0.0
        elif is_printing_with_noleggio:
            # Intervento Printing con prodotti a noleggio: non scalare chiamate contratto assistenza
            costo_chiamata = 0.0
            tariffa_oraria = 0.0
            print(f"[NOLEGGIO PRINTING] Intervento Printing con prodotti a noleggio - Chiamate contratto assistenza NON scalate")
        else:
            # Cliente senza contratto: applica tariffe standard
            if intervento.flag_diritto_chiamata:
                costo_chiamata = std_chiamata
            tariffa_oraria = std_orario
        
        sede_indirizzo = None
        sede_nome = None
        if intervento.sede_id:
            sede = db.query(models.SedeCliente).filter(models.SedeCliente.id == intervento.sede_id).first()
            if sede:
                sede_indirizzo = sede.indirizzo_completo
                sede_nome = sede.nome_sede
                # Verifica che la sede appartenga al cliente corretto
                if sede.cliente_id != intervento.cliente_id:
                    raise HTTPException(status_code=400, detail="La sede selezionata non appartiene al cliente indicato")
        else:
            # Se non è selezionata una sede, usa l'indirizzo principale del cliente
            sede_indirizzo = db_cliente.indirizzo or intervento.cliente_indirizzo

        # Verifica se ci sono prodotti a noleggio nei dettagli
        has_noleggio_assets = False
        if db_cliente.has_noleggio and intervento.dettagli:
            # Carica gli assets a noleggio del cliente
            assets_noleggio = db.query(models.AssetCliente).filter(
                models.AssetCliente.cliente_id == db_cliente.id
            ).all()
            
            # Verifica se almeno uno dei dettagli corrisponde a un asset a noleggio
            for dettaglio in intervento.dettagli:
                for asset in assets_noleggio:
                    # Confronta marca/modello e seriale/matricola
                    dettaglio_marca_modello = (dettaglio.marca_modello or "").strip().lower()
                    asset_marca_modello = f"{asset.marca or ''} {asset.modello or ''}".strip().lower()
                    
                    if dettaglio_marca_modello and asset_marca_modello and dettaglio_marca_modello in asset_marca_modello:
                        # Verifica anche seriale/matricola se disponibile
                        if dettaglio.serial_number:
                            if (asset.tipo_asset == "IT" and asset.seriale and dettaglio.serial_number.strip().lower() == asset.seriale.strip().lower()) or \
                               (asset.tipo_asset == "Printing" and asset.matricola and dettaglio.serial_number.strip().lower() == asset.matricola.strip().lower()):
                                has_noleggio_assets = True
                                break
                        else:
                            # Se non c'è seriale, considera comunque se marca/modello corrispondono
                            has_noleggio_assets = True
                            break
                if has_noleggio_assets:
                    break
        
        # Se ci sono prodotti a noleggio, azzera tariffa oraria (ma mantieni il calcolo del monte ore per il PDF)
        if has_noleggio_assets:
            tariffa_oraria = 0.0
            costo_chiamata = 0.0
            print(f"[NOLEGGIO] Rilevati prodotti a noleggio - Tariffa oraria e costo chiamata azzerati")
        
        # 4. Creazione Testata
        intervento_data = intervento.model_dump(exclude={"dettagli", "ricambi"})
        # Assicuriamoci che cliente_indirizzo e cliente_piva siano sempre dalla sede legale/fiscale
        intervento_data.update({
            "numero_relazione": numero_auto,
            "anno_riferimento": datetime.now().year,
            "costo_chiamata_applicato": costo_chiamata,
            "tariffa_oraria_applicata": tariffa_oraria,
            "sede_indirizzo": sede_indirizzo,
            "sede_nome": sede_nome,
            "cliente_indirizzo": db_cliente.indirizzo or intervento.cliente_indirizzo,  # Sempre sede legale
            # P.IVA: usa quella del cliente dal DB, o quella passata nel payload, o None (per PA con solo CF)
            "cliente_piva": db_cliente.p_iva if db_cliente.p_iva else (getattr(intervento, 'cliente_piva', None) or None),
            # Snapshot dati contratto assistenza (salva sempre i valori attuali anche se non scalate)
            "chiamate_utilizzate_contratto": chiamate_utilizzate_attuali if chiamate_utilizzate_attuali is not None else (db_cliente.chiamate_utilizzate_contratto or 0) if db_cliente.has_contratto_assistenza else None,
            "chiamate_rimanenti_contratto": chiamate_rimanenti if chiamate_rimanenti is not None else (max(0, (db_cliente.limite_chiamate_contratto or 0) - (db_cliente.chiamate_utilizzate_contratto or 0)) if db_cliente.has_contratto_assistenza and db_cliente.limite_chiamate_contratto is not None else None),
            "limite_chiamate_contratto": db_cliente.limite_chiamate_contratto if db_cliente.has_contratto_assistenza else None,
            # Prelievo copie
            "is_prelievo_copie": intervento.is_prelievo_copie or False
        })
        db_intervento = models.Intervento(**intervento_data)
        db.add(db_intervento)
        db.flush() # Otteniamo ID

        # 5. Dettagli Asset
        for dettaglio in intervento.dettagli:
            db_dettaglio = models.DettaglioIntervento(**dettaglio.model_dump(), intervento_id=db_intervento.id)
            db.add(db_dettaglio)
            
        # 6. Ricambi e Scalo Magazzino
        for ricambio in intervento.ricambi:
            db_ricambio = models.MovimentoRicambio(
                descrizione=ricambio.descrizione,
                quantita=ricambio.quantita,
                prezzo_unitario=ricambio.prezzo_unitario,
                prezzo_applicato=ricambio.prezzo_unitario,
                intervento_id=db_intervento.id,
                prodotto_id=ricambio.prodotto_id 
            )
            db.add(db_ricambio)
            
            if ricambio.prodotto_id:
                prod_magazzino = db.query(models.ProdottoMagazzino).filter(models.ProdottoMagazzino.id == ricambio.prodotto_id).first()
                if prod_magazzino:
                    prod_magazzino.giacenza -= ricambio.quantita
        
        db.commit()
        db.refresh(db_intervento)
        
        # Log audit
        log_action(
            db=db,
            user=current_user,
            action="CREATE",
            entity_type="intervento",
            entity_id=db_intervento.id,
            entity_name=db_intervento.numero_relazione,
            ip_address=get_client_ip(request)
        )

        # 6. Invio Email (Gestito fuori dalla transazione DB)
        # IMPORTANTE: Per i prelievi copie, le letture copie vengono create DOPO la creazione dell'intervento
        # dal frontend. Quindi durante la creazione iniziale, le letture copie potrebbero non essere ancora disponibili.
        # L'email verrà inviata durante l'update quando le letture copie sono disponibili.
        # Tuttavia, se le letture copie vengono create immediatamente dopo la creazione dell'intervento,
        # verranno trovate e l'email verrà inviata.
        try:
            # Verifica se è un prelievo copie
            if db_intervento.is_prelievo_copie:
                # Per i prelievi copie, verifica se ci sono già letture copie associate
                # Le letture copie vengono create dal frontend DOPO la creazione dell'intervento,
                # quindi potrebbero non essere ancora disponibili durante la creazione iniziale
                letture_copie_count = db.query(models.LetturaCopie).filter(
                    models.LetturaCopie.intervento_id == db_intervento.id
                ).count()
                
                print(f"[CREATE EMAIL PDF] Prelievo copie rilevato - Letture copie trovate: {letture_copie_count}")
                
                if letture_copie_count == 0:
                    print(f"[CREATE EMAIL PDF] Prelievo copie senza letture copie - Email NON inviata durante creazione")
                    print(f"[CREATE EMAIL PDF] L'email verrà inviata durante l'update quando le letture copie saranno disponibili")
                    # Non inviare email durante la creazione per prelievi copie senza letture
                    pass
                else:
                    # Se ci sono già letture copie, procedi con l'invio
                    print(f"[CREATE EMAIL PDF] Prelievo copie con {letture_copie_count} letture copie - Generazione PDF per email")
                    
                    # Ricarica completamente l'intervento dalla sessione per assicurarsi che tutte le modifiche siano salvate
                    db_intervento_fresh = db.query(models.Intervento).filter(models.Intervento.id == db_intervento.id).first()
                    if not db_intervento_fresh:
                        print(f"[CREATE EMAIL PDF] ERRORE: Intervento {db_intervento.id} non trovato dopo il commit!")
                        raise Exception(f"Intervento {db_intervento.id} non trovato")
                    
                    # Forza il caricamento delle relazioni
                    _ = db_intervento_fresh.dettagli  # Carica dettagli
                    _ = db_intervento_fresh.ricambi_utilizzati  # Carica ricambi
                    
                    # Carica letture copie con informazioni asset
                    db_intervento_fresh.letture_copie = db.query(models.LetturaCopie).filter(
                        models.LetturaCopie.intervento_id == db_intervento_fresh.id
                    ).all()
                    
                    print(f"[CREATE EMAIL PDF] Letture copie caricate dal DB: {len(db_intervento_fresh.letture_copie)}")
                    
                    # Carica informazioni asset per ogni lettura copie
                    for lettura in db_intervento_fresh.letture_copie:
                        if lettura.asset_id:
                            asset = db.query(models.AssetCliente).filter(models.AssetCliente.id == lettura.asset_id).first()
                            if asset:
                                # Aggiungi informazioni asset alla lettura (come attributi temporanei)
                                lettura.asset_marca = asset.marca or ''
                                lettura.asset_modello = asset.modello or ''
                                lettura.asset_marca_modello = f"{asset.marca or ''} {asset.modello or ''}".strip() or 'N/A'
                                print(f"[CREATE EMAIL PDF] Asset caricato per lettura {lettura.id}: {lettura.asset_marca_modello}")
                    
                    # Ricarica anche le impostazioni azienda
                    settings_refreshed = get_settings_or_default(db)
                    
                    cliente = db.query(models.Cliente).filter(models.Cliente.id == db_intervento_fresh.cliente_id).first()
                    pdf_bytes = pdf_service.genera_pdf_intervento(db_intervento_fresh, settings_refreshed)
                    
                    # Invia email (codice esistente)
                    data_intervento_email = db_intervento_fresh.data_creazione
                    azienda_indirizzo = settings_refreshed.indirizzo_completo or ""
                    azienda_telefono = settings_refreshed.telefono or ""
                    azienda_email_contatto = settings_refreshed.email or ""
                    
                    if cliente and cliente.email_amministrazione:
                        background_tasks.add_task(
                            send_email_background,
                            cliente.email_amministrazione,
                            pdf_bytes,
                            db_intervento_fresh.numero_relazione,
                            settings_refreshed.nome_azienda,
                            data_intervento_email,
                            azienda_indirizzo,
                            azienda_telefono,
                            azienda_email_contatto,
                            db
                        )
                    
                    if db_intervento_fresh.sede_id:
                        sede = db.query(models.SedeCliente).filter(models.SedeCliente.id == db_intervento_fresh.sede_id).first()
                        if sede and sede.email:
                            background_tasks.add_task(
                                send_email_background,
                                sede.email,
                                pdf_bytes,
                                db_intervento_fresh.numero_relazione,
                                settings_refreshed.nome_azienda,
                                data_intervento_email,
                                azienda_indirizzo,
                                azienda_telefono,
                                azienda_email_contatto,
                                db
                            )
                    
                    email_azienda = settings_refreshed.email_notifiche_scadenze or settings_refreshed.email
                    if email_azienda:
                        background_tasks.add_task(
                            send_email_background,
                            email_azienda,
                            pdf_bytes,
                            db_intervento_fresh.numero_relazione,
                            settings_refreshed.nome_azienda,
                            data_intervento_email,
                            azienda_indirizzo,
                            azienda_telefono,
                            azienda_email_contatto,
                            db
                        )
                    
                    print(f"[CREATE EMAIL PDF] PDF generato e email programmate per RIT {db_intervento_fresh.numero_relazione}")
            else:
                # Per interventi normali (non prelievo copie), invia email normalmente
                # Ricarica l'intervento con tutte le relazioni per generare il PDF corretto
                db.refresh(db_intervento)
                # Forza il caricamento delle relazioni
                _ = db_intervento.dettagli  # Carica dettagli
                _ = db_intervento.ricambi_utilizzati  # Carica ricambi
                
                # Ricarica anche le impostazioni azienda per assicurarsi che siano aggiornate
                settings_refreshed = get_settings_or_default(db)
                
                cliente = db.query(models.Cliente).filter(models.Cliente.id == db_intervento.cliente_id).first()
                pdf_bytes = pdf_service.genera_pdf_intervento(db_intervento, settings_refreshed)
                
                # Data intervento (usa data_creazione se non c'è data_intervento specifica)
                data_intervento_email = db_intervento.data_creazione
                
                # Dati azienda per footer email
                azienda_indirizzo = settings_refreshed.indirizzo_completo or ""
                azienda_telefono = settings_refreshed.telefono or ""
                azienda_email_contatto = settings_refreshed.email or ""
                
                # Email al cliente (se ha email amministrazione)
                if cliente and cliente.email_amministrazione:
                    background_tasks.add_task(
                        send_email_background,
                        cliente.email_amministrazione,
                        pdf_bytes,
                        db_intervento.numero_relazione,
                        settings_refreshed.nome_azienda,
                        data_intervento_email,
                        azienda_indirizzo,
                        azienda_telefono,
                        azienda_email_contatto,
                        db
                    )
                
                # Email alla sede di intervento (se presente e ha email)
                if db_intervento.sede_id:
                    sede = db.query(models.SedeCliente).filter(models.SedeCliente.id == db_intervento.sede_id).first()
                    if sede and sede.email:
                        background_tasks.add_task(
                            send_email_background,
                            sede.email,
                            pdf_bytes,
                            db_intervento.numero_relazione,
                            settings_refreshed.nome_azienda,
                            data_intervento_email,
                            azienda_indirizzo,
                            azienda_telefono,
                            azienda_email_contatto,
                            db
                        )
                
                # Email all'azienda (se configurata)
                # Usa email_notifiche_scadenze se disponibile, altrimenti email principale
                email_azienda = settings_refreshed.email_notifiche_scadenze or settings_refreshed.email
                if email_azienda:
                    background_tasks.add_task(
                        send_email_background,
                        email_azienda,
                        pdf_bytes,
                        db_intervento.numero_relazione,
                        settings_refreshed.nome_azienda,
                        data_intervento_email,
                        azienda_indirizzo,
                        azienda_telefono,
                        azienda_email_contatto,
                        db
                    )
        except Exception as e:
            print(f"Warning: Errore generazione email: {e}")
            import traceback
            traceback.print_exc()

        # Converti campi time in stringhe prima di restituire
        # Usa model_validate per gestire automaticamente le relazioni
        intervento_dict = convert_intervento_time_fields(db_intervento)
        # Aggiungi le relazioni che Pydantic si aspetta
        intervento_dict['dettagli'] = [schemas.DettaglioAssetResponse.model_validate(d) for d in db_intervento.dettagli]
        intervento_dict['ricambi_utilizzati'] = [schemas.RicambioResponse.model_validate(r) for r in db_intervento.ricambi_utilizzati]
        return schemas.InterventoResponse.model_validate(intervento_dict)

    except Exception as e:
        db.rollback()
        print(f"Errore creazione intervento: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/interventi/", response_model=List[schemas.InterventoResponse], tags=["R.I.T."])
def read_interventi(
    skip: int = 0, 
    limit: int = 100, 
    q: str = "", 
    db: Session = Depends(database.get_db), 
    current_user: models.Utente = Depends(auth.get_current_active_user)
):
    """Ottiene la lista degli interventi con ricerca opzionale per cliente, seriale, part number o prodotto"""
    query = db.query(models.Intervento)
    
    # Se c'è un termine di ricerca, filtra gli interventi
    if q and q.strip():
        search_term = f"%{q.strip()}%"
        # Cerca per:
        # 1. Numero relazione
        # 2. Cliente (ragione sociale)
        # 3. Serial number nei dettagli
        # 4. Part number nei dettagli
        # 5. Descrizione prodotto nei ricambi
        from sqlalchemy import or_
        
        # Cerca nei campi principali dell'intervento
        query = query.filter(
            or_(
                models.Intervento.numero_relazione.ilike(search_term),
                models.Intervento.cliente_ragione_sociale.ilike(search_term)
            )
        )
        
        # Cerca anche nei dettagli (seriale, part number) e nei ricambi (descrizione)
        # Carica gli interventi che corrispondono e poi filtra quelli con dettagli/ricambi corrispondenti
        interventi_matching = query.all()
        matching_ids = set()
        
        for intervento in interventi_matching:
            # Verifica dettagli (seriale, part number)
            for dettaglio in intervento.dettagli:
                if (dettaglio.serial_number and search_term.lower().replace('%', '') in (dettaglio.serial_number or '').lower()) or \
                   (dettaglio.part_number and search_term.lower().replace('%', '') in (dettaglio.part_number or '').lower()) or \
                   (dettaglio.marca_modello and search_term.lower().replace('%', '') in (dettaglio.marca_modello or '').lower()):
                    matching_ids.add(intervento.id)
                    break
            
            # Verifica ricambi (descrizione prodotto)
            for ricambio in intervento.ricambi_utilizzati:
                if ricambio.descrizione and search_term.lower().replace('%', '') in ricambio.descrizione.lower():
                    matching_ids.add(intervento.id)
                    break
        
        # Se ci sono match nei dettagli/ricambi, aggiungi anche quelli
        if matching_ids:
            query = db.query(models.Intervento).filter(
                or_(
                    models.Intervento.numero_relazione.ilike(search_term),
                    models.Intervento.cliente_ragione_sociale.ilike(search_term),
                    models.Intervento.id.in_(matching_ids)
                )
            )
        else:
            # Se non ci sono match nei dettagli/ricambi, usa solo la query principale
            pass
    
    interventi = query.order_by(desc(models.Intervento.id)).offset(skip).limit(limit).all()
    result = []
    for i in interventi:
        intervento_dict = convert_intervento_time_fields(i)
        intervento_dict['dettagli'] = [schemas.DettaglioAssetResponse.model_validate(d) for d in i.dettagli]
        intervento_dict['ricambi_utilizzati'] = [schemas.RicambioResponse.model_validate(r) for r in i.ricambi_utilizzati]
        result.append(schemas.InterventoResponse.model_validate(intervento_dict))
    return result

@app.get("/interventi/{intervento_id}", response_model=schemas.InterventoResponse, tags=["R.I.T."])
def read_intervento(intervento_id: int, db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.get_current_active_user)):
    intervento = db.query(models.Intervento).filter(models.Intervento.id == intervento_id).first()
    if not intervento: raise HTTPException(status_code=404, detail="Not found")
    intervento_dict = convert_intervento_time_fields(intervento)
    intervento_dict['dettagli'] = [schemas.DettaglioAssetResponse.model_validate(d) for d in intervento.dettagli]
    intervento_dict['ricambi_utilizzati'] = [schemas.RicambioResponse.model_validate(r) for r in intervento.ricambi_utilizzati]
    return schemas.InterventoResponse.model_validate(intervento_dict)

@app.put("/interventi/{intervento_id}", response_model=schemas.InterventoResponse, tags=["R.I.T."])
def update_intervento(
    intervento_id: int,
    intervento_update: schemas.InterventoCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.get_current_active_user)
):
    """Aggiorna un intervento esistente, permettendo la rifirma"""
    db_intervento = db.query(models.Intervento).filter(models.Intervento.id == intervento_id).first()
    if not db_intervento:
        raise HTTPException(status_code=404, detail="Intervento non trovato")
    
    # Salva stato originale per audit log (prima delle modifiche)
    intervento_originale = models.Intervento(
        numero_relazione=db_intervento.numero_relazione,
        cliente_id=db_intervento.cliente_id,
        macro_categoria=db_intervento.macro_categoria,
        is_contratto=db_intervento.is_contratto,
        is_chiamata=db_intervento.is_chiamata,
        costo_chiamata_applicato=db_intervento.costo_chiamata_applicato,
        tariffa_oraria_applicata=db_intervento.tariffa_oraria_applicata
    )
    
    # Verifica cliente se cambiato
    if intervento_update.cliente_id != db_intervento.cliente_id:
        db_cliente = db.query(models.Cliente).filter(models.Cliente.id == intervento_update.cliente_id).first()
        if not db_cliente:
            raise HTTPException(status_code=404, detail="Cliente non trovato")
    else:
        db_cliente = db.query(models.Cliente).filter(models.Cliente.id == db_intervento.cliente_id).first()
    
    # Gestione sede
    sede_indirizzo = None
    sede_nome = None
    if intervento_update.sede_id:
        sede = db.query(models.SedeCliente).filter(models.SedeCliente.id == intervento_update.sede_id).first()
        if sede:
            sede_indirizzo = sede.indirizzo_completo
            sede_nome = sede.nome_sede
            if sede.cliente_id != intervento_update.cliente_id:
                raise HTTPException(status_code=400, detail="La sede selezionata non appartiene al cliente indicato")
    else:
        sede_indirizzo = db_cliente.indirizzo if db_cliente else None
    
    # Verifica se ci sono prodotti a noleggio nei dettagli
    has_noleggio_assets = False
    
    if db_cliente and db_cliente.has_noleggio and intervento_update.dettagli:
        # Carica gli assets a noleggio del cliente
        assets_noleggio = db.query(models.AssetCliente).filter(
            models.AssetCliente.cliente_id == db_cliente.id
        ).all()
        
        # Verifica se almeno uno dei dettagli corrisponde a un asset a noleggio
        for dettaglio in intervento_update.dettagli:
            for asset in assets_noleggio:
                # Confronta marca/modello e seriale/matricola
                dettaglio_marca_modello = (dettaglio.marca_modello or "").strip().lower()
                asset_marca_modello = f"{asset.marca or ''} {asset.modello or ''}".strip().lower()
                
                if dettaglio_marca_modello and asset_marca_modello and dettaglio_marca_modello in asset_marca_modello:
                    # Verifica anche seriale/matricola se disponibile
                    if dettaglio.serial_number:
                        if (asset.tipo_asset == "IT" and asset.seriale and dettaglio.serial_number.strip().lower() == asset.seriale.strip().lower()) or \
                           (asset.tipo_asset == "Printing" and asset.matricola and dettaglio.serial_number.strip().lower() == asset.matricola.strip().lower()):
                            has_noleggio_assets = True
                            break
                    else:
                        # Se non c'è seriale, considera comunque se marca/modello corrispondono
                        has_noleggio_assets = True
                        break
            if has_noleggio_assets:
                break
    
    # Aggiorna i campi principali (escludendo dettagli e ricambi che gestiamo separatamente)
    update_data = intervento_update.model_dump(exclude={"dettagli", "ricambi"})
    
    # Verifica se è un intervento Printing con prodotti a noleggio (non scalare chiamate contratto assistenza)
    is_printing_with_noleggio = intervento_update.macro_categoria.value == "Printing & Office" and has_noleggio_assets
    
    # Gestione chiamate contratto assistenza (solo per interventi IT/altro, NON per Printing con noleggio)
    chiamate_utilizzate_precedenti = None
    chiamate_utilizzate_attuali = None
    chiamate_rimanenti = None
    
    # Scala le chiamate solo se:
    # 1. È un contratto assistenza E
    # 2. NON è un intervento Printing con prodotti a noleggio E
    # 3. L'intervento originale non aveva già scalato le chiamate (per evitare doppio scalamento)
    if intervento_update.is_contratto and db_cliente and db_cliente.has_contratto_assistenza and not is_printing_with_noleggio:
        # Verifica se l'intervento originale aveva già scalato le chiamate
        if db_intervento.chiamate_utilizzate_contratto is not None:
            # L'intervento aveva già scalato le chiamate, non scalare di nuovo
            chiamate_utilizzate_attuali = db_intervento.chiamate_utilizzate_contratto
            chiamate_rimanenti = db_intervento.chiamate_rimanenti_contratto
            print(f"[UPDATE INTERVENTO] Chiamate già scalate in precedenza - Mantenute: {chiamate_utilizzate_attuali}")
        elif db_cliente.limite_chiamate_contratto is not None:
            # Prima volta che si scala per questo intervento
            chiamate_utilizzate_precedenti = db_cliente.chiamate_utilizzate_contratto or 0
            chiamate_utilizzate_attuali = chiamate_utilizzate_precedenti + 1
            chiamate_rimanenti = max(0, db_cliente.limite_chiamate_contratto - chiamate_utilizzate_attuali)
            
            # Aggiorna il contatore sul cliente
            db_cliente.chiamate_utilizzate_contratto = chiamate_utilizzate_attuali
            db.add(db_cliente)
            
            print(f"[CONTRATTO ASSISTENZA UPDATE] Cliente {db_cliente.id} - Chiamate utilizzate: {chiamate_utilizzate_precedenti} -> {chiamate_utilizzate_attuali}")
    
    # Se ci sono prodotti a noleggio, azzera tariffa oraria e costo chiamata
    tariffa_oraria_update = update_data.get("tariffa_oraria_applicata", db_intervento.tariffa_oraria_applicata) if not has_noleggio_assets else 0.0
    if has_noleggio_assets:
        tariffa_oraria_update = 0.0
        update_data["costo_chiamata_applicato"] = 0.0
        print(f"[NOLEGGIO UPDATE] Rilevati prodotti a noleggio - Tariffa oraria e costo chiamata azzerati")
    
    update_data.update({
        "sede_indirizzo": sede_indirizzo,
        "sede_nome": sede_nome,
        "cliente_indirizzo": db_cliente.indirizzo if db_cliente else intervento_update.cliente_indirizzo,
        "cliente_piva": db_cliente.p_iva if db_cliente else (getattr(intervento_update, 'cliente_piva', None) or None),
        "tariffa_oraria_applicata": tariffa_oraria_update,
        "chiamate_utilizzate_contratto": chiamate_utilizzate_attuali if chiamate_utilizzate_attuali is not None else db_intervento.chiamate_utilizzate_contratto,
        "chiamate_rimanenti_contratto": chiamate_rimanenti if chiamate_rimanenti is not None else db_intervento.chiamate_rimanenti_contratto,
        "limite_chiamate_contratto": db_cliente.limite_chiamate_contratto if db_cliente and db_cliente.has_contratto_assistenza else None
    })
    
    # Aggiorna i campi dell'intervento
    for key, value in update_data.items():
        if hasattr(db_intervento, key):
            setattr(db_intervento, key, value)
    
    # Gestione dettagli: elimina vecchi e aggiungi nuovi
    for dettaglio in db_intervento.dettagli:
        db.delete(dettaglio)
    
    for det in intervento_update.dettagli:
        db_dettaglio = models.DettaglioIntervento(
            intervento_id=db_intervento.id,
            categoria_it=det.categoria_it if hasattr(det, 'categoria_it') else None,
            marca_modello=det.marca_modello,
            serial_number=det.serial_number or None,
            part_number=det.part_number if hasattr(det, 'part_number') and det.part_number else None,
            descrizione_lavoro=det.descrizione_lavoro or "-",
            dati_tecnici=det.dati_tecnici if hasattr(det, 'dati_tecnici') else {}
        )
        db.add(db_dettaglio)
    
    # Gestione ricambi: elimina vecchi e aggiungi nuovi
    for ricambio in db_intervento.ricambi_utilizzati:
        db.delete(ricambio)
    
    for ric in intervento_update.ricambi:
        db_ricambio = models.MovimentoRicambio(
            intervento_id=db_intervento.id,
            descrizione=ric.descrizione,
            quantita=ric.quantita,
            prezzo_unitario=ric.prezzo_unitario,
            prodotto_id=ric.prodotto_id if hasattr(ric, 'prodotto_id') else None
        )
        db.add(db_ricambio)
    
    db.commit()
    db.refresh(db_intervento)
    
    # Log audit (traccia modifiche principali)
    # Nota: per interventi complessi, tracciamo solo i campi principali
    fields_to_track = ['numero_relazione', 'cliente_id', 'macro_categoria', 'is_contratto', 'is_chiamata', 
                       'costo_chiamata_applicato', 'tariffa_oraria_applicata']
    changes = get_changes_dict(intervento_originale, db_intervento, fields_to_track)
    
    log_action(
        db=db,
        user=current_user,
        action="UPDATE",
        entity_type="intervento",
        entity_id=db_intervento.id,
        entity_name=db_intervento.numero_relazione,
        changes=changes if changes else None,
        ip_address=get_client_ip(request)
    )
    
    # Genera e invia PDF per email se è un prelievo copie con letture copie associate
    # Questo è necessario perché le letture copie vengono aggiunte durante l'update
    # IMPORTANTE: Non inviare email durante la creazione iniziale se è un prelievo copie
    # perché le letture copie non sono ancora disponibili. Invia solo durante l'update.
    try:
        # Verifica se ci sono letture copie associate all'intervento
        letture_copie_count = db.query(models.LetturaCopie).filter(
            models.LetturaCopie.intervento_id == db_intervento.id
        ).count()
        
        print(f"[UPDATE EMAIL PDF] Verifica prelievo copie: is_prelievo_copie={db_intervento.is_prelievo_copie}, letture_copie_count={letture_copie_count}")
        
        # Se è un prelievo copie e ci sono letture copie associate, genera e invia il PDF
        if db_intervento.is_prelievo_copie and letture_copie_count > 0:
            print(f"[UPDATE EMAIL PDF] Rilevato prelievo copie con {letture_copie_count} letture copie - Generazione PDF per email")
            
            # IMPORTANTE: Ricarica l'intervento DOPO il commit per assicurarsi che tutte le modifiche siano salvate
            # Non usare db.refresh perché potrebbe non funzionare correttamente dopo il commit
            # Ricarica completamente l'intervento dalla sessione
            db_intervento_fresh = db.query(models.Intervento).filter(models.Intervento.id == db_intervento.id).first()
            if not db_intervento_fresh:
                print(f"[UPDATE EMAIL PDF] ERRORE: Intervento {db_intervento.id} non trovato dopo il commit!")
                raise Exception(f"Intervento {db_intervento.id} non trovato")
            
            # Forza il caricamento delle relazioni
            _ = db_intervento_fresh.dettagli  # Carica dettagli
            _ = db_intervento_fresh.ricambi_utilizzati  # Carica ricambi
            
            # Carica letture copie con informazioni asset
            db_intervento_fresh.letture_copie = db.query(models.LetturaCopie).filter(
                models.LetturaCopie.intervento_id == db_intervento_fresh.id
            ).all()
            
            print(f"[UPDATE EMAIL PDF] Letture copie caricate dal DB: {len(db_intervento_fresh.letture_copie)}")
            
            # Carica informazioni asset per ogni lettura copie
            for lettura in db_intervento_fresh.letture_copie:
                if lettura.asset_id:
                    asset = db.query(models.AssetCliente).filter(models.AssetCliente.id == lettura.asset_id).first()
                    if asset:
                        # Aggiungi informazioni asset alla lettura (come attributi temporanei)
                        lettura.asset_marca = asset.marca or ''
                        lettura.asset_modello = asset.modello or ''
                        lettura.asset_marca_modello = f"{asset.marca or ''} {asset.modello or ''}".strip() or 'N/A'
                        print(f"[UPDATE EMAIL PDF] Asset caricato per lettura {lettura.id}: {lettura.asset_marca_modello}")
                    else:
                        print(f"[UPDATE EMAIL PDF] ATTENZIONE: Asset {lettura.asset_id} non trovato per lettura {lettura.id}")
                else:
                    print(f"[UPDATE EMAIL PDF] ATTENZIONE: Lettura {lettura.id} senza asset_id")
            
            # Ricarica le impostazioni azienda
            settings_refreshed = get_settings_or_default(db)
            
            # Genera il PDF usando l'intervento ricaricato
            pdf_bytes = pdf_service.genera_pdf_intervento(db_intervento_fresh, settings_refreshed)
            
            # Data intervento
            data_intervento_email = db_intervento_fresh.data_creazione
            
            # Dati azienda per footer email
            azienda_indirizzo = settings_refreshed.indirizzo_completo or ""
            azienda_telefono = settings_refreshed.telefono or ""
            azienda_email_contatto = settings_refreshed.email or ""
            
            # Carica cliente
            cliente = db.query(models.Cliente).filter(models.Cliente.id == db_intervento_fresh.cliente_id).first()
            
            # Email al cliente (se ha email amministrazione)
            if cliente and cliente.email_amministrazione:
                background_tasks.add_task(
                    send_email_background,
                    cliente.email_amministrazione,
                    pdf_bytes,
                    db_intervento_fresh.numero_relazione,
                    settings_refreshed.nome_azienda,
                    data_intervento_email,
                    azienda_indirizzo,
                    azienda_telefono,
                    azienda_email_contatto,
                    db
                )
            
            # Email alla sede di intervento (se presente e ha email)
            if db_intervento_fresh.sede_id:
                sede = db.query(models.SedeCliente).filter(models.SedeCliente.id == db_intervento_fresh.sede_id).first()
                if sede and sede.email:
                    background_tasks.add_task(
                        send_email_background,
                        sede.email,
                        pdf_bytes,
                        db_intervento_fresh.numero_relazione,
                        settings_refreshed.nome_azienda,
                        data_intervento_email,
                        azienda_indirizzo,
                        azienda_telefono,
                        azienda_email_contatto,
                        db
                    )
            
            # Email all'azienda (se configurata)
            email_azienda = settings_refreshed.email_notifiche_scadenze or settings_refreshed.email
            if email_azienda:
                background_tasks.add_task(
                    send_email_background,
                    email_azienda,
                    pdf_bytes,
                    db_intervento_fresh.numero_relazione,
                    settings_refreshed.nome_azienda,
                    data_intervento_email,
                    azienda_indirizzo,
                    azienda_telefono,
                    azienda_email_contatto,
                    db
                )
            
            print(f"[UPDATE EMAIL PDF] PDF generato e email programmate per RIT {db_intervento_fresh.numero_relazione}")
    except Exception as e:
        print(f"[UPDATE EMAIL PDF] Warning: Errore generazione email durante update: {e}")
        import traceback
        traceback.print_exc()
    
    # Converti per la risposta
    intervento_dict = convert_intervento_time_fields(db_intervento)
    intervento_dict['dettagli'] = [schemas.DettaglioAssetResponse.model_validate(d) for d in db_intervento.dettagli]
    intervento_dict['ricambi_utilizzati'] = [schemas.RicambioResponse.model_validate(r) for r in db_intervento.ricambi_utilizzati]
    return schemas.InterventoResponse.model_validate(intervento_dict)

# In backend/app/main.py

@app.get("/interventi/{intervento_id}/pdf", tags=["R.I.T."])
def download_pdf_rit(intervento_id: int, db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.get_current_active_user)):
    rit = db.query(models.Intervento).filter(models.Intervento.id == intervento_id).first()
    if not rit: raise HTTPException(status_code=404, detail="Not found")
    
    # Carica le letture copie associate all'intervento con informazioni asset
    if rit.is_prelievo_copie:
        rit.letture_copie = db.query(models.LetturaCopie).filter(
            models.LetturaCopie.intervento_id == intervento_id
        ).all()
        
        # Carica informazioni asset per ogni lettura copie
        for lettura in rit.letture_copie:
            if lettura.asset_id:
                asset = db.query(models.AssetCliente).filter(models.AssetCliente.id == lettura.asset_id).first()
                if asset:
                    # Aggiungi informazioni asset alla lettura (come attributi temporanei)
                    lettura.asset_marca = asset.marca or ''
                    lettura.asset_modello = asset.modello or ''
                    lettura.asset_marca_modello = f"{asset.marca or ''} {asset.modello or ''}".strip() or 'N/A'
    
    azienda = get_settings_or_default(db)
    
    try:
        pdf_content = pdf_service.genera_pdf_intervento(rit, azienda)
        # Usa 'attachment' per forzare il download con il nome corretto
        # Usa filename* per supporto Unicode (RFC 5987)
        filename = rit.numero_relazione
        return Response(
            content=pdf_content, 
            media_type="application/pdf", 
            headers={
                "Content-Disposition": f'attachment; filename="{filename}.pdf"; filename*=UTF-8\'\'{filename}.pdf'
            } 
        )
    except Exception as e:
        print(f"Errore PDF: {e}") # Logga l'errore nella console Docker
        raise HTTPException(status_code=500, detail=f"Errore generazione PDF: {e}")
    
@app.get("/impostazioni/public", tags=["Configurazione"])
def read_impostazioni_public(db: Session = Depends(database.get_db)):
    """Endpoint pubblico per ottenere logo, nome azienda e colore primario (senza autenticazione)"""
    try:
        settings = get_settings_or_default(db)
        return {
            "logo_url": settings.logo_url if settings.logo_url else "",
            "nome_azienda": settings.nome_azienda if settings.nome_azienda else "SISTEMA54",
            "colore_primario": settings.colore_primario if settings.colore_primario else "#4F46E5"
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Errore caricamento impostazioni: {str(e)}")

@app.get("/impostazioni/", response_model=schemas.ImpostazioniAziendaResponse, tags=["Configurazione"])
def read_impostazioni(db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.get_current_active_user)):
    return get_settings_or_default(db)

@app.put("/impostazioni/", response_model=schemas.ImpostazioniAziendaResponse, tags=["Configurazione"])
def update_impostazioni(settings: schemas.ImpostazioniAziendaCreate, db: Session = Depends(database.get_db), current_user: models.Utente = Depends(auth.require_admin)):
    db_settings = db.query(models.ImpostazioniAzienda).first()
    if not db_settings:
        db_settings = models.ImpostazioniAzienda(**settings.model_dump())
        db.add(db_settings)
    else:
        for key, value in settings.model_dump().items():
            setattr(db_settings, key, value)
    db.commit()
    db.refresh(db_settings)
    return db_settings

# --- API LETTURE COPIE ---
@app.get("/letture-copie/asset/{asset_id}/all", response_model=List[schemas.LetturaCopieResponse], tags=["Letture Copie"])
def get_all_letture_asset(
    asset_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.get_current_active_user)
):
    """Ottiene tutte le letture copie per un asset, ordinate per data (più recenti prima)"""
    letture = db.query(models.LetturaCopie).filter(
        models.LetturaCopie.asset_id == asset_id
    ).order_by(models.LetturaCopie.data_lettura.desc()).all()
    return letture

@app.get("/letture-copie/asset/{asset_id}/ultima", response_model=schemas.LetturaCopieResponse, tags=["Letture Copie"])
def get_ultima_lettura(
    asset_id: int,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.get_current_active_user)
):
    """Ottiene l'ultima lettura copie per un asset"""
    ultima_lettura = db.query(models.LetturaCopie).filter(
        models.LetturaCopie.asset_id == asset_id
    ).order_by(desc(models.LetturaCopie.data_lettura)).first()
    
    if not ultima_lettura:
        # Se non c'è lettura, usa i contatori iniziali dell'asset
        asset = db.query(models.AssetCliente).filter(models.AssetCliente.id == asset_id).first()
        if not asset:
            raise HTTPException(status_code=404, detail="Asset non trovato")
        
        # Crea una lettura virtuale con i contatori iniziali
        from datetime import datetime
        return {
            "id": 0,
            "asset_id": asset_id,
            "intervento_id": None,
            "data_lettura": asset.data_installazione or datetime.now(),
            "contatore_bn": asset.contatore_iniziale_bn or 0,
            "contatore_colore": asset.contatore_iniziale_colore or 0,
            "tecnico_id": None,
            "note": None,
            "created_at": datetime.now()
        }
    
    return ultima_lettura

@app.post("/letture-copie/", response_model=schemas.LetturaCopieResponse, tags=["Letture Copie"])
def create_lettura_copie(
    lettura: schemas.LetturaCopieCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.get_current_active_user)
):
    """Crea una nuova lettura copie"""
    # Verifica che l'asset esista
    asset = db.query(models.AssetCliente).filter(models.AssetCliente.id == lettura.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset non trovato")
    
    # Verifica che sia un asset Printing
    if asset.tipo_asset != "Printing":
        raise HTTPException(status_code=400, detail="Le letture copie sono disponibili solo per asset Printing")
    
    # Usa sempre la data corrente per la lettura (non quella passata dal frontend)
    data_lettura_corrente = datetime.now()
    
    # Ottieni ultima lettura per validazione
    ultima_lettura = db.query(models.LetturaCopie).filter(
        models.LetturaCopie.asset_id == lettura.asset_id
    ).order_by(desc(models.LetturaCopie.data_lettura)).first()
    
    # Validazione: nuove copie devono essere >= precedenti
    if ultima_lettura:
        if lettura.contatore_bn < ultima_lettura.contatore_bn:
            raise HTTPException(
                status_code=400, 
                detail=f"Il contatore B/N ({lettura.contatore_bn}) non può essere inferiore all'ultima lettura ({ultima_lettura.contatore_bn})"
            )
        if lettura.contatore_colore and ultima_lettura.contatore_colore:
            if lettura.contatore_colore < ultima_lettura.contatore_colore:
                raise HTTPException(
                    status_code=400,
                    detail=f"Il contatore Colore ({lettura.contatore_colore}) non può essere inferiore all'ultima lettura ({ultima_lettura.contatore_colore})"
                )
        
        # Validazione: devono essere passati i giorni minimi in base alla cadenza configurata
        cadenza = asset.cadenza_letture_copie or "trimestrale"
        giorni_minimi = get_giorni_da_cadenza(cadenza)
        # Usa la data corrente per calcolare i giorni dall'ultima lettura
        giorni_da_ultima = (data_lettura_corrente - ultima_lettura.data_lettura).days
        
        if giorni_da_ultima < giorni_minimi:
            # Calcola la data minima per la prossima lettura
            data_minima_lettura = ultima_lettura.data_lettura + timedelta(days=giorni_minimi)
            raise HTTPException(
                status_code=400,
                detail=f"Non possono essere effettuate letture prima della cadenza configurata ({cadenza}, {giorni_minimi} giorni). Ultima lettura: {ultima_lettura.data_lettura.strftime('%d/%m/%Y')} ({giorni_da_ultima} giorni fa). Prossima lettura possibile: {data_minima_lettura.strftime('%d/%m/%Y')}"
            )
    else:
        # Prima lettura: usa contatori iniziali come riferimento
        if lettura.contatore_bn < (asset.contatore_iniziale_bn or 0):
            raise HTTPException(
                status_code=400,
                detail=f"Il contatore B/N ({lettura.contatore_bn}) non può essere inferiore al contatore iniziale ({asset.contatore_iniziale_bn or 0})"
            )
        if lettura.contatore_colore and asset.contatore_iniziale_colore:
            if lettura.contatore_colore < asset.contatore_iniziale_colore:
                raise HTTPException(
                    status_code=400,
                    detail=f"Il contatore Colore ({lettura.contatore_colore}) non può essere inferiore al contatore iniziale ({asset.contatore_iniziale_colore})"
                )
    
    # Ottieni cadenza per calcolo copie incluse
    cadenza = asset.cadenza_letture_copie or "trimestrale"
    
    # Calcola copie incluse in base alla cadenza per il calcolo economico
    # Le copie incluse mensili vengono moltiplicate per il numero di mesi della cadenza
    copie_incluse_bn_periodo = 0
    copie_incluse_colore_periodo = 0
    
    if asset.copie_incluse_bn is not None:
        mesi_cadenza = get_mesi_da_cadenza(cadenza)
        copie_incluse_bn_periodo = asset.copie_incluse_bn * mesi_cadenza
    
    if asset.copie_incluse_colore is not None:
        mesi_cadenza = get_mesi_da_cadenza(cadenza)
        copie_incluse_colore_periodo = asset.copie_incluse_colore * mesi_cadenza
    
    # Calcola copie effettive stampate nel periodo (differenza tra nuovo prelievo e ultimo prelievo)
    copie_stampate_bn = 0
    copie_stampate_colore = 0
    
    if ultima_lettura:
        # Calcolo corretto: nuovo prelievo - ultimo prelievo
        copie_stampate_bn = lettura.contatore_bn - ultima_lettura.contatore_bn
        if lettura.contatore_colore is not None and ultima_lettura.contatore_colore is not None:
            copie_stampate_colore = lettura.contatore_colore - ultima_lettura.contatore_colore
    else:
        # Prima lettura: usa contatori iniziali come riferimento
        copie_stampate_bn = lettura.contatore_bn - (asset.contatore_iniziale_bn or 0)
        if lettura.contatore_colore is not None and asset.contatore_iniziale_colore is not None:
            copie_stampate_colore = lettura.contatore_colore - asset.contatore_iniziale_colore
    
    # Calcola copie fuori limite (da addebitare)
    copie_fuori_limite_bn = max(0, copie_stampate_bn - copie_incluse_bn_periodo)
    copie_fuori_limite_colore = max(0, copie_stampate_colore - copie_incluse_colore_periodo)
    
    # Calcola costo totale (se necessario, può essere aggiunto al costo dell'intervento)
    costo_copie_bn = 0
    costo_copie_colore = 0
    
    if copie_fuori_limite_bn > 0 and asset.costo_copia_bn_fuori_limite:
        costo_copie_bn = copie_fuori_limite_bn * asset.costo_copia_bn_fuori_limite
    
    if copie_fuori_limite_colore > 0 and asset.costo_copia_colore_fuori_limite:
        costo_copie_colore = copie_fuori_limite_colore * asset.costo_copia_colore_fuori_limite
    
    # Salva informazioni di calcolo nelle note
    note_calcolo = f"Calcolo copie per cadenza '{cadenza}':\n"
    note_calcolo += f"  Data lettura: {data_lettura_corrente.strftime('%d/%m/%Y %H:%M')}\n"
    if ultima_lettura:
        note_calcolo += f"  Ultima lettura: {ultima_lettura.data_lettura.strftime('%d/%m/%Y')} (B/N: {ultima_lettura.contatore_bn}, Colore: {ultima_lettura.contatore_colore or 0})\n"
    else:
        note_calcolo += f"  Contatori iniziali: B/N: {asset.contatore_iniziale_bn or 0}, Colore: {asset.contatore_iniziale_colore or 0}\n"
    note_calcolo += f"  Nuova lettura: B/N: {lettura.contatore_bn}, Colore: {lettura.contatore_colore or 0}\n"
    note_calcolo += f"  Copie incluse nel periodo ({cadenza}): B/N={copie_incluse_bn_periodo}, Colore={copie_incluse_colore_periodo}\n"
    note_calcolo += f"  Copie stampate nel periodo: B/N={copie_stampate_bn}, Colore={copie_stampate_colore}\n"
    note_calcolo += f"  Copie fuori limite: B/N={copie_fuori_limite_bn}, Colore={copie_fuori_limite_colore}\n"
    if costo_copie_bn > 0 or costo_copie_colore > 0:
        note_calcolo += f"  Costo totale: B/N=€{costo_copie_bn:.2f}, Colore=€{costo_copie_colore:.2f}"
    
    # Crea lettura con data corrente
    lettura_dict = lettura.model_dump()
    lettura_dict['data_lettura'] = data_lettura_corrente  # Usa sempre la data corrente
    # Rimuovi tecnico_id se presente (lo impostiamo sempre a current_user.id)
    lettura_dict.pop('tecnico_id', None)
    if lettura_dict.get('note'):
        lettura_dict['note'] = f"{lettura_dict['note']}\n\n{note_calcolo}"
    else:
        lettura_dict['note'] = note_calcolo
    
    # Log per debug
    print(f"[CREATE LETTURA COPIE] Creazione lettura copie per asset {lettura.asset_id}")
    print(f"[CREATE LETTURA COPIE] intervento_id passato: {lettura.intervento_id}")
    print(f"[CREATE LETTURA COPIE] contatore_bn: {lettura.contatore_bn}, contatore_colore: {lettura.contatore_colore}")
    
    db_lettura = models.LetturaCopie(
        **lettura_dict,
        tecnico_id=current_user.id
    )
    db.add(db_lettura)
    db.commit()
    db.refresh(db_lettura)
    
    # Verifica che l'intervento_id sia stato salvato correttamente
    print(f"[CREATE LETTURA COPIE] Lettura copie creata con ID: {db_lettura.id}")
    print(f"[CREATE LETTURA COPIE] intervento_id salvato: {db_lettura.intervento_id}")
    
    # Se la lettura copie è associata a un intervento, verifica se è un prelievo copie
    # e invia l'email dopo un breve delay per permettere la creazione di tutte le letture copie
    if db_lettura.intervento_id:
        print(f"[CREATE LETTURA COPIE] Verifica intervento {db_lettura.intervento_id} per invio email")
        intervento = db.query(models.Intervento).filter(models.Intervento.id == db_lettura.intervento_id).first()
        if intervento:
            print(f"[CREATE LETTURA COPIE] Intervento trovato: id={intervento.id}, is_prelievo_copie={intervento.is_prelievo_copie}")
        else:
            print(f"[CREATE LETTURA COPIE] ATTENZIONE: Intervento {db_lettura.intervento_id} non trovato!")
        
        if intervento and intervento.is_prelievo_copie:
            print(f"[CREATE LETTURA COPIE] Intervento {intervento.id} è un prelievo copie - Verifica programmazione email")
            
            # Usa un meccanismo di debouncing: programma l'email solo se non è già stata programmata
            # per questo intervento negli ultimi 5 secondi
            global _interventi_email_programmate
            
            # Rimuovi gli interventi più vecchi di 10 secondi dal set
            import time as time_module
            current_time = time_module.time()
            _interventi_email_programmate = {
                (interv_id, timestamp) for interv_id, timestamp in _interventi_email_programmate
                if current_time - timestamp < 10
            }
            
            # Verifica se l'email è già stata programmata per questo intervento
            email_gia_programmata = any(
                interv_id == db_lettura.intervento_id and (current_time - timestamp) < 5
                for interv_id, timestamp in _interventi_email_programmate
            )
            
            if email_gia_programmata:
                print(f"[CREATE LETTURA COPIE] Email già programmata per intervento {db_lettura.intervento_id} - Skip")
            else:
                # Aggiungi l'intervento al set
                _interventi_email_programmate.add((db_lettura.intervento_id, current_time))
                print(f"[CREATE LETTURA COPIE] Intervento {intervento.id} è un prelievo copie - Programmazione invio email")
                
                # Programma l'invio email dopo 3 secondi per permettere la creazione di tutte le letture copie
                def send_email_after_letture_copie(intervento_id: int):
                    """Funzione che viene eseguita dopo un delay per inviare l'email"""
                    print(f"[CREATE LETTURA COPIE EMAIL] Avvio funzione invio email per intervento {intervento_id}")
                    # Crea una nuova sessione DB per questa operazione asincrona
                    from .database import SessionLocal
                    db_email = SessionLocal()
                    try:
                        # Attendi 3 secondi per assicurarsi che tutte le letture copie siano state create
                        import time
                        print(f"[CREATE LETTURA COPIE EMAIL] Attendo 3 secondi...")
                        time.sleep(3)
                        
                        # Verifica se ci sono altre letture copie create negli ultimi 2 secondi
                        # Se sì, aspetta ancora un po' per evitare di inviare email multiple
                        from datetime import timedelta
                        letture_recenti = db_email.query(models.LetturaCopie).filter(
                            models.LetturaCopie.intervento_id == intervento_id,
                            models.LetturaCopie.created_at >= (datetime.now() - timedelta(seconds=2))
                        ).count()
                        
                        if letture_recenti > 0:
                            # Ci sono letture copie create molto recentemente, aspetta ancora 2 secondi
                            print(f"[CREATE LETTURA COPIE EMAIL] Trovate {letture_recenti} letture copie recenti, attendo altri 2 secondi...")
                            time.sleep(2)
                        
                        # Rimuovi l'intervento dal set dopo che l'email è stata inviata
                        global _interventi_email_programmate
                        _interventi_email_programmate = {
                            (interv_id, timestamp) for interv_id, timestamp in _interventi_email_programmate
                            if interv_id != intervento_id
                        }
                        
                        # Ricarica l'intervento
                        db_intervento_email = db_email.query(models.Intervento).filter(models.Intervento.id == intervento_id).first()
                        if not db_intervento_email or not db_intervento_email.is_prelievo_copie:
                            print(f"[CREATE LETTURA COPIE EMAIL] Intervento {intervento_id} non trovato o non è un prelievo copie")
                            return
                        
                        # Verifica se ci sono letture copie associate
                        letture_copie_count = db_email.query(models.LetturaCopie).filter(
                            models.LetturaCopie.intervento_id == intervento_id
                        ).count()
                        
                        if letture_copie_count == 0:
                            print(f"[CREATE LETTURA COPIE EMAIL] Nessuna lettura copie trovata per intervento {intervento_id}")
                            return
                        
                        print(f"[CREATE LETTURA COPIE EMAIL] Trovate {letture_copie_count} letture copie per intervento {intervento_id} - Generazione PDF per email")
                        
                        # Forza il caricamento delle relazioni
                        _ = db_intervento_email.dettagli  # Carica dettagli
                        _ = db_intervento_email.ricambi_utilizzati  # Carica ricambi
                        
                        # Carica tutte le letture copie con informazioni asset
                        db_intervento_email.letture_copie = db_email.query(models.LetturaCopie).filter(
                            models.LetturaCopie.intervento_id == intervento_id
                        ).all()
                        
                        print(f"[CREATE LETTURA COPIE EMAIL] Letture copie caricate: {len(db_intervento_email.letture_copie)}")
                        
                        # Carica informazioni asset per ogni lettura copie
                        for lettura_item in db_intervento_email.letture_copie:
                            if lettura_item.asset_id:
                                asset = db_email.query(models.AssetCliente).filter(models.AssetCliente.id == lettura_item.asset_id).first()
                                if asset:
                                    lettura_item.asset_marca = asset.marca or ''
                                    lettura_item.asset_modello = asset.modello or ''
                                    lettura_item.asset_marca_modello = f"{asset.marca or ''} {asset.modello or ''}".strip() or 'N/A'
                                    print(f"[CREATE LETTURA COPIE EMAIL] Asset caricato per lettura {lettura_item.id}: {lettura_item.asset_marca_modello}")
                        
                        # Ricarica le impostazioni azienda
                        settings_refreshed = get_settings_or_default(db_email)
                        
                        # Genera il PDF usando l'intervento ricaricato
                        pdf_bytes = pdf_service.genera_pdf_intervento(db_intervento_email, settings_refreshed)
                        
                        # Data intervento
                        data_intervento_email = db_intervento_email.data_creazione
                        
                        # Dati azienda per footer email
                        azienda_indirizzo = settings_refreshed.indirizzo_completo or ""
                        azienda_telefono = settings_refreshed.telefono or ""
                        azienda_email_contatto = settings_refreshed.email or ""
                        
                        # Carica cliente
                        cliente = db_email.query(models.Cliente).filter(models.Cliente.id == db_intervento_email.cliente_id).first()
                        
                        # Email al cliente (se ha email amministrazione)
                        if cliente and cliente.email_amministrazione:
                            send_email_background(
                                cliente.email_amministrazione,
                                pdf_bytes,
                                db_intervento_email.numero_relazione,
                                settings_refreshed.nome_azienda,
                                data_intervento_email,
                                azienda_indirizzo,
                                azienda_telefono,
                                azienda_email_contatto,
                                db_email
                            )
                            print(f"[CREATE LETTURA COPIE EMAIL] Email inviata a cliente: {cliente.email_amministrazione}")
                        
                        # Email alla sede di intervento (se presente e ha email)
                        if db_intervento_email.sede_id:
                            sede = db_email.query(models.SedeCliente).filter(models.SedeCliente.id == db_intervento_email.sede_id).first()
                            if sede and sede.email:
                                send_email_background(
                                    sede.email,
                                    pdf_bytes,
                                    db_intervento_email.numero_relazione,
                                    settings_refreshed.nome_azienda,
                                    data_intervento_email,
                                    azienda_indirizzo,
                                    azienda_telefono,
                                    azienda_email_contatto,
                                    db_email
                                )
                                print(f"[CREATE LETTURA COPIE EMAIL] Email inviata a sede: {sede.email}")
                        
                        # Email all'azienda (se configurata)
                        email_azienda = settings_refreshed.email_notifiche_scadenze or settings_refreshed.email
                        if email_azienda:
                            send_email_background(
                                email_azienda,
                                pdf_bytes,
                                db_intervento_email.numero_relazione,
                                settings_refreshed.nome_azienda,
                                data_intervento_email,
                                azienda_indirizzo,
                                azienda_telefono,
                                azienda_email_contatto,
                                db_email
                            )
                            print(f"[CREATE LETTURA COPIE EMAIL] Email inviata ad azienda: {email_azienda}")
                        
                        print(f"[CREATE LETTURA COPIE EMAIL] PDF generato e email inviate per RIT {db_intervento_email.numero_relazione}")
                    except Exception as e:
                        print(f"[CREATE LETTURA COPIE EMAIL] Warning: Errore generazione email durante creazione lettura copie: {e}")
                        import traceback
                        traceback.print_exc()
                    finally:
                        db_email.close()
                
                # Programma l'invio email dopo 3 secondi
                background_tasks.add_task(send_email_after_letture_copie, db_lettura.intervento_id)
    
    return db_lettura

# --- API AUDIT LOG ---
@app.get("/api/audit-logs/", response_model=List[schemas.AuditLogResponse], tags=["Audit Log"])
def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_admin)
):
    """
    Recupera i log di audit con filtri opzionali.
    Solo Admin e SuperAdmin possono accedere ai log.
    """
    query = db.query(models.AuditLog)
    
    # Filtri opzionali
    if entity_type:
        query = query.filter(models.AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(models.AuditLog.entity_id == entity_id)
    if user_id:
        query = query.filter(models.AuditLog.user_id == user_id)
    if action:
        query = query.filter(models.AuditLog.action == action.upper())
    if start_date:
        query = query.filter(models.AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(models.AuditLog.timestamp <= end_date)
    
    # Ordina per timestamp decrescente (più recenti prima)
    logs = query.order_by(desc(models.AuditLog.timestamp)).offset(skip).limit(limit).all()
    return logs

@app.get("/api/audit-logs/stats", tags=["Audit Log"])
def get_audit_logs_stats(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(database.get_db),
    current_user: models.Utente = Depends(auth.require_admin)
):
    """
    Ottiene statistiche sui log di audit.
    Solo Admin e SuperAdmin possono accedere.
    """
    query = db.query(models.AuditLog)
    
    if start_date:
        query = query.filter(models.AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(models.AuditLog.timestamp <= end_date)
    
    total_logs = query.count()
    
    # Statistiche per tipo di entità
    entity_stats = {}
    for entity_type in ['cliente', 'intervento', 'magazzino', 'utente']:
        count = query.filter(models.AuditLog.entity_type == entity_type).count()
        entity_stats[entity_type] = count
    
    # Statistiche per azione
    action_stats = {}
    for action in ['CREATE', 'UPDATE', 'DELETE']:
        count = query.filter(models.AuditLog.action == action).count()
        action_stats[action] = count
    
    # Top 5 utenti più attivi
    from sqlalchemy import func
    top_users = db.query(
        models.AuditLog.user_id,
        models.AuditLog.user_nome,
        func.count(models.AuditLog.id).label('count')
    ).group_by(models.AuditLog.user_id, models.AuditLog.user_nome).order_by(desc('count')).limit(5).all()
    
    top_users_list = [{"user_id": u[0], "user_nome": u[1], "count": u[2]} for u in top_users]
    
    return {
        "total_logs": total_logs,
        "entity_stats": entity_stats,
        "action_stats": action_stats,
        "top_users": top_users_list
    }
