from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from .models import MacroCategoria, RuoloUtente

# --- SCHEMAS UTENTE ---
class UserBase(BaseModel):
    email: str
    nome_completo: str
    ruolo: RuoloUtente
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[str] = None
    nome_completo: Optional[str] = None
    ruolo: Optional[RuoloUtente] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    permessi: Optional[Dict[str, Any]] = {}
    two_factor_enabled: Optional[bool] = None  # Per permettere agli admin di gestire 2FA per altri superadmin

class UserResponse(UserBase):
    id: int
    permessi: Optional[Dict[str, Any]] = {}
    two_factor_enabled: Optional[bool] = False
    class Config:
        from_attributes = True

# --- SCHEMAS AUTENTICAZIONE ---
class Token(BaseModel):
    access_token: str
    token_type: str
    requires_2fa: Optional[bool] = False

class LoginRequest(BaseModel):
    email: str
    password: str
    two_factor_code: Optional[str] = None

class OAuthLoginRequest(BaseModel):
    provider: str
    access_token: str

class TwoFactorSetupResponse(BaseModel):
    secret: str
    qr_code: str
    backup_codes: List[str]

class TwoFactorVerifyRequest(BaseModel):
    code: str

# --- SCHEMAS CLIENTE ---
class ClienteBase(BaseModel):
    ragione_sociale: str
    indirizzo: str
    citta: Optional[str] = None
    cap: Optional[str] = None
    p_iva: Optional[str] = None
    codice_fiscale: Optional[str] = None
    email_amministrazione: Optional[str] = None
    codice_sdi: Optional[str] = ""
    is_pa: Optional[bool] = False
    has_contratto_assistenza: Optional[bool] = False
    has_noleggio: Optional[bool] = False
    has_multisede: Optional[bool] = False
    sede_legale_operativa: Optional[bool] = False  # Se True, la sede legale viene creata come sede operativa con ID
    # Dettagli Contratto Assistenza
    data_inizio_contratto_assistenza: Optional[datetime] = None
    data_fine_contratto_assistenza: Optional[datetime] = None
    limite_chiamate_contratto: Optional[int] = None
    chiamate_utilizzate_contratto: Optional[int] = 0
    costo_chiamata_fuori_limite: Optional[float] = None

class SedeClienteBase(BaseModel):
    nome_sede: str
    indirizzo_completo: str
    citta: Optional[str] = None
    cap: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None

class SedeClienteCreate(SedeClienteBase):
    pass

class SedeClienteResponse(SedeClienteBase):
    id: int
    cliente_id: int
    class Config:
        from_attributes = True

class AssetClienteBase(BaseModel):
    tipo_asset: str  # "Printing" o "IT"
    sede_id: Optional[int] = None  # Sede di ubicazione del prodotto noleggio
    marca: Optional[str] = None
    modello: Optional[str] = None
    matricola: Optional[str] = None
    data_installazione: Optional[datetime] = None
    data_scadenza_noleggio: Optional[datetime] = None
    cadenza_letture_copie: Optional[str] = "trimestrale"  # mensile, bimestrale, trimestrale, semestrale (solo per Printing)
    # Campi specifici per Printing
    is_colore: Optional[bool] = None
    tipo_formato: Optional[str] = None
    contatore_iniziale_bn: Optional[int] = 0
    contatore_iniziale_colore: Optional[int] = 0
    copie_incluse_bn: Optional[int] = None
    copie_incluse_colore: Optional[int] = None
    costo_copia_bn_fuori_limite: Optional[float] = None
    costo_copia_colore_fuori_limite: Optional[float] = None
    costo_copia_bn_non_incluse: Optional[float] = None
    costo_copia_colore_non_incluse: Optional[float] = None
    # Campi specifici per IT
    codice_prodotto: Optional[str] = None
    seriale: Optional[str] = None
    descrizione: Optional[str] = None
    is_nuovo: Optional[bool] = None

class AssetClienteCreate(AssetClienteBase):
    pass

class AssetClienteResponse(AssetClienteBase):
    id: int
    cliente_id: int
    class Config:
        from_attributes = True

class ClienteCreate(ClienteBase):
    sedi: Optional[List[SedeClienteCreate]] = []
    assets_noleggio: Optional[List[AssetClienteCreate]] = []

class ClienteResponse(ClienteBase):
    id: int
    sedi: List[SedeClienteResponse] = []
    assets_noleggio: List[AssetClienteResponse] = []
    class Config:
        from_attributes = True

# --- SCHEMAS INTERVENTO ---
class DettaglioAssetBase(BaseModel):
    categoria_it: Optional[str] = None
    marca_modello: str
    serial_number: Optional[str] = None
    part_number: Optional[str] = None
    descrizione_lavoro: str

class DettaglioAssetCreate(DettaglioAssetBase):
    pass

class DettaglioAssetResponse(DettaglioAssetBase):
    id: int
    class Config:
        from_attributes = True

class RicambioBase(BaseModel):
    descrizione: str
    quantita: int
    prezzo_unitario: float
    prodotto_id: Optional[int] = None

class RicambioCreate(RicambioBase):
    pass

class RicambioResponse(RicambioBase):
    id: int
    prezzo_applicato: float
    class Config:
        from_attributes = True

class InterventoBase(BaseModel):
    macro_categoria: MacroCategoria
    cliente_id: int
    cliente_ragione_sociale: str 
    cliente_indirizzo: Optional[str] = ""
    cliente_piva: Optional[str] = None  # P.IVA opzionale (per PA può essere None)
    numero_relazione: Optional[str] = ""
    sede_id: Optional[int] = None
    # Flags
    is_contratto: bool = False
    is_garanzia: bool = False
    is_chiamata: bool = False
    flag_diritto_chiamata: bool = True
    # Firme (Base64)
    firma_tecnico: Optional[str] = None
    firma_cliente: Optional[str] = None
    nome_cliente: Optional[str] = None
    cognome_cliente: Optional[str] = None
    costi_extra: Optional[float] = 0.0
    descrizione_extra: Optional[str] = None
    difetto_segnalato: Optional[str] = None
    ora_inizio: Optional[str] = None
    ora_fine: Optional[str] = None
    # Dati Contratto Assistenza (snapshot)
    chiamate_utilizzate_contratto: Optional[int] = None
    chiamate_rimanenti_contratto: Optional[int] = None
    limite_chiamate_contratto: Optional[int] = None
    # Prelievo copie (solo per Printing)
    is_prelievo_copie: Optional[bool] = False

class InterventoCreate(InterventoBase):
    dettagli: List[DettaglioAssetCreate] = []
    ricambi: List[RicambioCreate] = []

class InterventoResponse(InterventoBase):
    id: int
    data_creazione: datetime
    dettagli: List[DettaglioAssetResponse] = []
    ricambi_utilizzati: List[RicambioResponse] = []
    class Config:
        from_attributes = True

# --- SCHEMAS MAGAZZINO ---
class ProdottoBase(BaseModel):
    descrizione: str
    prezzo_vendita: float
    giacenza: int
    categoria: Optional[str] = None

class ProdottoCreate(ProdottoBase):
    pass

class ProdottoUpdate(BaseModel):
    descrizione: Optional[str] = None
    prezzo_vendita: Optional[float] = None
    giacenza: Optional[int] = None
    categoria: Optional[str] = None

class ProdottoResponse(ProdottoBase):
    id: int
    class Config:
        from_attributes = True

# --- SCHEMAS IMPOSTAZIONI ---
class ImpostazioniAziendaBase(BaseModel):
    nome_azienda: str
    indirizzo_completo: str
    p_iva: Optional[str] = None
    logo_url: Optional[str] = None
    colore_primario: Optional[str] = "#4F46E5"
    testo_privacy: Optional[str] = None
    testo_footer: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    email_notifiche_scadenze: Optional[str] = None
    email_avvisi_promemoria: Optional[str] = None
    smtp_server: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: Optional[bool] = True
    costo_orario_standard: Optional[float] = 50.00
    diritto_chiamata_standard: Optional[float] = 30.00
    tariffe_categorie: Optional[Dict[str, Any]] = {}

class ImpostazioniAziendaCreate(ImpostazioniAziendaBase):
    pass

class ImpostazioniAziendaResponse(ImpostazioniAziendaBase):
    id: int
    class Config:
        from_attributes = True

# Alias per compatibilità
ImpostazioniResponse = ImpostazioniAziendaResponse
ImpostazioniCreate = ImpostazioniAziendaCreate

# --- SCHEMAS LETTURE COPIE ---
class LetturaCopieBase(BaseModel):
    asset_id: int
    intervento_id: Optional[int] = None
    data_lettura: datetime
    contatore_bn: int
    contatore_colore: Optional[int] = 0
    tecnico_id: Optional[int] = None
    note: Optional[str] = None

class LetturaCopieCreate(LetturaCopieBase):
    pass

class LetturaCopieResponse(LetturaCopieBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True
