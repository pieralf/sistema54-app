from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Time, Enum as SqlEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base

# --- ENUMERATORI ---
class RuoloUtente(str, enum.Enum):
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    TECNICO = "tecnico"
    OPERATORE = "operatore"
    MAGAZZINIERE = "magazziniere"

class MacroCategoria(str, enum.Enum):
    PRINTING = "Printing & Office"
    IT = "Informatica & IT"
    MANUTENZIONE = "Manutenzione Gen."
    FISCALI = "Sistemi Fiscali"

class CategoriaIT(str, enum.Enum):
    HARDWARE = "Hardware"
    SOFTWARE = "Software"
    NETWORK = "Network"
    GENERICO = "Generico"

# --- MODELLI ANAGRAFICI ---
class Utente(Base):
    __tablename__ = "utenti"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=True)  # Nullable per OAuth
    nome_completo = Column(String)
    ruolo = Column(SqlEnum(RuoloUtente), default=RuoloUtente.OPERATORE)
    is_active = Column(Boolean, default=True)
    oauth_provider = Column(String, nullable=True)  # 'google', 'microsoft', etc.
    oauth_id = Column(String, nullable=True)  # ID utente dal provider OAuth
    permessi = Column(JSONB, default={})  # Permessi granulari: {"can_view_clienti": true, "can_edit_clienti": false, ...}
    # Autenticazione a due fattori (2FA)
    two_factor_enabled = Column(Boolean, default=False)  # Se 2FA è abilitato
    two_factor_secret = Column(String, nullable=True)  # Secret TOTP (solo per superadmin)
    two_factor_backup_codes = Column(JSONB, nullable=True)  # Codici di backup (array di stringhe)
    created_at = Column(DateTime, default=datetime.now)
    last_login = Column(DateTime, nullable=True)

class Cliente(Base):
    __tablename__ = "clienti"
    id = Column(Integer, primary_key=True, index=True)
    ragione_sociale = Column(String, index=True)
    indirizzo = Column(String)
    citta = Column(String)
    cap = Column(String)
    p_iva = Column(String, nullable=True) 
    codice_fiscale = Column(String, nullable=True)
    email_amministrazione = Column(String, nullable=True) 
    
    # Fatturazione Elettronica / PA
    codice_sdi = Column(String, nullable=True)
    is_pa = Column(Boolean, default=False)
    split_payment = Column(Boolean, default=False)
    
    # Contratti
    has_contratto_assistenza = Column(Boolean, default=False)
    has_noleggio = Column(Boolean, default=False)
    has_multisede = Column(Boolean, default=False)
    sede_legale_operativa = Column(Boolean, default=False)  # Se True, la sede legale viene creata come sede operativa con ID
    
    # Dettagli Contratto Assistenza
    data_inizio_contratto_assistenza = Column(DateTime, nullable=True)  # Data inizio contratto
    data_fine_contratto_assistenza = Column(DateTime, nullable=True)  # Data fine contratto
    limite_chiamate_contratto = Column(Integer, nullable=True)  # Numero massimo chiamate incluse (null = illimitato)
    chiamate_utilizzate_contratto = Column(Integer, default=0)  # Contatore chiamate utilizzate
    costo_chiamata_fuori_limite = Column(Float, nullable=True)  # Costo chiamata quando si supera il limite
    
    # Relazioni
    assets_noleggio = relationship("AssetCliente", back_populates="cliente", cascade="all, delete-orphan")
    sedi = relationship("SedeCliente", back_populates="cliente", cascade="all, delete-orphan")
    interventi = relationship("Intervento", back_populates="cliente_rel")

class SedeCliente(Base):
    __tablename__ = "sedi_cliente"
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clienti.id"), nullable=False)
    nome_sede = Column(String, nullable=False)  # Es: "Sede Uffici Salerno", "Magazzino Centrale"
    indirizzo_completo = Column(String, nullable=False)  # Indirizzo completo della sede
    citta = Column(String, nullable=True)
    cap = Column(String, nullable=True)
    telefono = Column(String, nullable=True)
    email = Column(String, nullable=True)
    
    cliente = relationship("Cliente", back_populates="sedi")

class AssetCliente(Base):
    __tablename__ = "assets_cliente"
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clienti.id"))
    sede_id = Column(Integer, ForeignKey("sedi_cliente.id"), nullable=True)  # Sede di ubicazione del prodotto noleggio
    
    # Tipo asset: "Printing" o "IT"
    tipo_asset = Column(String, nullable=False)  # "Printing" o "IT"
    
    # Campi comuni
    marca = Column(String, nullable=True)
    modello = Column(String, nullable=True)
    matricola = Column(String, nullable=True)
    data_installazione = Column(DateTime, nullable=True)
    data_scadenza_noleggio = Column(DateTime, nullable=True)  # Scadenza noleggio
    
    # Campi specifici per Printing
    is_colore = Column(Boolean, nullable=True)  # True = colore, False = b/n (solo per Printing)
    tipo_formato = Column(String, nullable=True)  # A4, A3, A0 (solo per Printing)
    cadenza_letture_copie = Column(String, nullable=True, default="trimestrale")  # mensile, bimestrale, trimestrale, semestrale (solo per Printing)
    contatore_iniziale_bn = Column(Integer, default=0)  # Contatore iniziale b/n
    contatore_iniziale_colore = Column(Integer, default=0)  # Contatore iniziale colore
    copie_incluse_bn = Column(Integer, nullable=True)  # Copie incluse b/n (null = nessuna copia inclusa)
    copie_incluse_colore = Column(Integer, nullable=True)  # Copie incluse colore (null = nessuna copia inclusa)
    costo_copia_bn_fuori_limite = Column(Float, nullable=True)  # Costo per copia b/n fuori limite
    costo_copia_colore_fuori_limite = Column(Float, nullable=True)  # Costo per copia colore fuori limite
    costo_copia_bn_non_incluse = Column(Float, nullable=True)  # Costo per copia b/n se non incluse
    costo_copia_colore_non_incluse = Column(Float, nullable=True)  # Costo per copia colore se non incluse
    
    # Campi specifici per IT
    codice_prodotto = Column(String, nullable=True)  # Codice prodotto (solo per IT)
    seriale = Column(String, nullable=True)  # Numero seriale (solo per IT)
    descrizione = Column(Text, nullable=True)  # Descrizione prodotto (solo per IT)
    is_nuovo = Column(Boolean, nullable=True)  # True = nuovo, False = ricondizionato (solo per IT)
    
    cliente = relationship("Cliente", back_populates="assets_noleggio")
    sede = relationship("SedeCliente", backref="assets_noleggio")

class ProdottoMagazzino(Base):
    __tablename__ = "magazzino"
    id = Column(Integer, primary_key=True, index=True)
    codice_articolo = Column(String, unique=True, index=True)
    descrizione = Column(String)
    prezzo_vendita = Column(Float, default=0.0)
    costo_acquisto = Column(Float, default=0.0)
    giacenza = Column(Integer, default=0)
    categoria = Column(String, nullable=True)

# --- MODELLO INTERVENTO ---
class Intervento(Base):
    __tablename__ = "interventi"

    id = Column(Integer, primary_key=True, index=True)
    numero_relazione = Column(String, unique=True, index=True) 
    anno_riferimento = Column(Integer, index=True)
    data_creazione = Column(DateTime, default=datetime.now)
    
    tecnico_id = Column(Integer, ForeignKey("utenti.id"), nullable=True)
    cliente_id = Column(Integer, ForeignKey("clienti.id"), nullable=True)
    sede_id = Column(Integer, ForeignKey("sedi_cliente.id"), nullable=True)  # Sede selezionata per l'intervento
    
    # Snapshot Dati Cliente
    cliente_ragione_sociale = Column(String)
    cliente_indirizzo = Column(String)  # Indirizzo principale del cliente
    sede_indirizzo = Column(String, nullable=True)  # Indirizzo della sede selezionata (se multisede)
    sede_nome = Column(String, nullable=True)  # Nome della sede selezionata
    cliente_piva = Column(String, nullable=True)
    
    macro_categoria = Column(SqlEnum(MacroCategoria), default=MacroCategoria.IT)
    
    # Flags Servizio
    is_contratto = Column(Boolean, default=False)
    is_garanzia = Column(Boolean, default=False)
    is_chiamata = Column(Boolean, default=False)
    is_sopralluogo = Column(Boolean, default=False)
    is_prelievo_copie = Column(Boolean, default=False)  # Prelievo numero copie (solo per Printing)
    
    # Economico
    flag_diritto_chiamata = Column(Boolean, default=True) 
    costo_chiamata_applicato = Column(Float, default=0.0) 
    tariffa_oraria_applicata = Column(Float, default=0.0) 
    costi_extra = Column(Float, default=0.0)
    descrizione_extra = Column(String, nullable=True)
    difetto_segnalato = Column(Text, nullable=True)  # Campo separato per il difetto segnalato
    
    # Dati Contratto Assistenza (snapshot al momento della creazione)
    chiamate_utilizzate_contratto = Column(Integer, nullable=True)  # Chiamate utilizzate al momento del RIT
    chiamate_rimanenti_contratto = Column(Integer, nullable=True)  # Chiamate rimanenti al momento del RIT
    limite_chiamate_contratto = Column(Integer, nullable=True)  # Limite chiamate contratto (snapshot)
    
    # Tempi
    ora_inizio = Column(Time, nullable=True)
    ora_fine = Column(Time, nullable=True)
    
    # Dati Firma (Nuovi) - Salviamo il Base64 direttamente o il path
    firma_tecnico = Column(Text, nullable=True) # Text perché base64 è lungo
    firma_cliente = Column(Text, nullable=True)
    nome_cliente = Column(String, nullable=True)  # Nome del cliente che firma
    cognome_cliente = Column(String, nullable=True)  # Cognome del cliente che firma
    
    # Relazioni
    cliente_rel = relationship("Cliente", back_populates="interventi")
    dettagli = relationship("DettaglioIntervento", back_populates="intervento", cascade="all, delete-orphan")
    ricambi_utilizzati = relationship("MovimentoRicambio", back_populates="intervento", cascade="all, delete-orphan")

class DettaglioIntervento(Base):
    __tablename__ = "dettagli_intervento"
    id = Column(Integer, primary_key=True, index=True)
    intervento_id = Column(Integer, ForeignKey("interventi.id"))
    categoria_it = Column(SqlEnum(CategoriaIT), default=CategoriaIT.GENERICO)
    marca_modello = Column(String)
    serial_number = Column(String, nullable=True)
    part_number = Column(String, nullable=True)  # Part number del prodotto
    descrizione_lavoro = Column(Text)
    dati_tecnici = Column(JSONB, default={})
    intervento = relationship("Intervento", back_populates="dettagli")

class MovimentoRicambio(Base):
    __tablename__ = "movimenti_ricambi"
    id = Column(Integer, primary_key=True, index=True)
    intervento_id = Column(Integer, ForeignKey("interventi.id"))
    prodotto_id = Column(Integer, ForeignKey("magazzino.id"), nullable=True)
    descrizione = Column(String) 
    quantita = Column(Integer, default=1)
    prezzo_unitario = Column(Float)
    prezzo_applicato = Column(Float)
    intervento = relationship("Intervento", back_populates="ricambi_utilizzati")

class LetturaCopie(Base):
    __tablename__ = "letture_copie"
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets_cliente.id", ondelete="CASCADE"), nullable=False)
    intervento_id = Column(Integer, ForeignKey("interventi.id", ondelete="SET NULL"), nullable=True)
    data_lettura = Column(DateTime, nullable=False, default=datetime.now)
    contatore_bn = Column(Integer, nullable=False, default=0)
    contatore_colore = Column(Integer, nullable=True, default=0)
    tecnico_id = Column(Integer, ForeignKey("utenti.id"), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    
    asset = relationship("AssetCliente", backref="letture_copie")
    intervento = relationship("Intervento", backref="letture_copie")
    tecnico = relationship("Utente")

class ImpostazioniAzienda(Base):
    __tablename__ = "impostazioni_azienda"
    id = Column(Integer, primary_key=True, index=True)
    nome_azienda = Column(String, default="SISTEMA54")
    indirizzo_completo = Column(String)
    p_iva = Column(String)
    logo_url = Column(String)
    colore_primario = Column(String, default="#4F46E5")
    testo_privacy = Column(Text)
    testo_footer = Column(String)
    telefono = Column(String)
    email = Column(String)
    email_notifiche_scadenze = Column(String, nullable=True)  # Email per notifiche scadenze noleggi
    email_avvisi_promemoria = Column(String, nullable=True)  # Email per avvisi e promemoria (es. letture copie)
    # Configurazione SMTP
    smtp_server = Column(String, nullable=True)  # Es: smtp.gmail.com
    smtp_port = Column(Integer, nullable=True)  # Es: 587
    smtp_username = Column(String, nullable=True)  # Email mittente
    smtp_password = Column(String, nullable=True)  # Password app (Gmail)
    smtp_use_tls = Column(Boolean, default=True)  # Usa TLS/SSL
    costo_orario_standard = Column(Float, default=50.00)
    diritto_chiamata_standard = Column(Float, default=30.00)
    tariffe_categorie = Column(JSONB, default={})
    # Configurazioni avanzate SuperAdmin
    configurazioni_avanzate = Column(JSONB, default={})  # Parametri personalizzabili
    template_pdf_config = Column(JSONB, default={})  # Configurazione template PDF
    oauth_config = Column(JSONB, default={})  # Configurazione OAuth providers

# --- MODELLO AUDIT LOG ---
class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("utenti.id"), nullable=False, index=True)
    user_email = Column(String, nullable=False)  # Snapshot email utente
    user_nome = Column(String, nullable=False)  # Snapshot nome utente
    action = Column(String, nullable=False, index=True)  # CREATE, UPDATE, DELETE
    entity_type = Column(String, nullable=False, index=True)  # 'cliente', 'intervento', 'magazzino', 'utente'
    entity_id = Column(Integer, nullable=False, index=True)  # ID dell'entità modificata
    entity_name = Column(String, nullable=True)  # Nome descrittivo dell'entità (es: ragione_sociale, numero_relazione, codice_articolo)
    changes = Column(JSONB, nullable=True)  # Dettagli delle modifiche: {"campo": {"old": valore_vecchio, "new": valore_nuovo}}
    ip_address = Column(String, nullable=True)  # IP dell'utente
    timestamp = Column(DateTime, default=datetime.now, nullable=False, index=True)
    
    user = relationship("Utente", backref="audit_logs")