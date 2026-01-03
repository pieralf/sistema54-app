import io
from datetime import datetime, timedelta
from pathlib import Path
from jinja2 import Template, Environment, FileSystemLoader
try:
    from PyPDF2 import PdfWriter, PdfReader
    HAS_PYPDF2 = True
except ImportError:
    HAS_PYPDF2 = False
    print("ATTENZIONE: PyPDF2 non installato. Merge PDF non disponibile.")

# TENTATIVO DI IMPORTAZIONE WEASYPRINT (Priorità Alta)
try:
    from weasyprint import HTML, CSS
    HAS_WEASYPRINT = True
except ImportError:
    HAS_WEASYPRINT = False
    print("ATTENZIONE: WeasyPrint non installato. Fallback su FPDF.")

# FALLBACK FPDF (Per compatibilità con il tuo errore attuale)
try:
    from fpdf import FPDF
except ImportError:
    try:
        from fpdf2 import FPDF
    except ImportError:
        FPDF = None
        print("ATTENZIONE: FPDF non installato. Solo WeasyPrint disponibile.")

# --- CLASSE DI COMPATIBILITÀ (FIX PER IL TUO ERRORE) ---
class PDF(FPDF):
    """
    Questa classe esiste SOLO per evitare il crash 'PDF.__init__ takes 1 argument'.
    Accetta qualsiasi argomento in input e lo passa a FPDF.
    """
    def __init__(self, *args, **kwargs):
        # Intercettiamo i parametri di orientamento/formato
        super().__init__(*args, **kwargs)
        self.azienda = {}

    def header(self):
        # Header semplice di emergenza
        self.set_font('Arial', 'B', 12)
        nome = self.azienda.get('nome_azienda', 'Report Tecnico')
        self.cell(0, 10, str(nome), 0, 1, 'C')
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, f'Pagina {self.page_no()}', 0, 0, 'C')

# --- CSS STYLE ---
CSS_STYLE = """
@page { size: A4; margin: 1.5cm; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 0; line-height: 1.3; }
.bold { font-weight: bold; }
.text-right { text-align: right; }
.text-center { text-align: center; }
.uppercase { text-transform: uppercase; }
.clearfix::after { content: ""; clear: both; display: table; }
.box { border: 1px solid #000; padding: 5px; margin-bottom: 5px; background: #fff; }
.label-header { background: #eee; border: 1px solid #000; border-bottom: 0; padding: 2px 5px; font-weight: bold; font-size: 9px; text-transform: uppercase; }
.data-content { border: 1px solid #000; padding: 5px; margin-bottom: 5px; min-height: 15px; }
.header { margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
.header-left { float: left; width: 50%; }
.header-right { float: right; width: 50%; text-align: right; }
.logo-img { max-width: 180px; max-height: 60px; object-fit: contain; }
table.grid { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
table.grid td { vertical-align: top; padding: 0; }
.col-left { padding-right: 5px; }
.col-right { padding-left: 5px; }
.checkbox-container { display: inline-block; margin-right: 15px; }
.check-box { display: inline-block; width: 10px; height: 10px; border: 1px solid #000; margin-right: 3px; vertical-align: middle; text-align: center; line-height: 9px; font-size: 8px; }
table.ricambi { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; }
table.ricambi th { border: 1px solid #000; background: #eee; padding: 4px; font-size: 9px; text-align: left; }
table.ricambi td { border: 1px solid #000; padding: 4px; font-size: 10px; }
.footer-section { margin-top: 10px; page-break-inside: avoid; }
.times-box { float: left; width: 55%; border: 1px solid #000; padding: 5px; font-size: 10px; }
.totals-table { float: right; width: 40%; border-collapse: collapse; }
.totals-table td { border: 1px solid #000; padding: 5px; }
.disclaimer { margin-top: 15px; font-size: 9px; text-align: justify; font-style: italic; color: #333; }
.firme { margin-top: 30px; width: 100%; }
.firma-line { border-top: 1px solid #000; width: 40%; padding-top: 5px; text-align: center; }
"""

def calcola_monte_ore(ora_inizio, ora_fine):
    """
    Calcola il monte ore con frazionamento:
    - Fino a 29 minuti: paga mezz'ora (0.5 ore)
    - Da 30 minuti in poi: arrotondato per eccesso all'ora completa
    """
    if not ora_inizio or not ora_fine:
        return 0.0
    
    # Gestisci sia stringhe che oggetti time
    if isinstance(ora_inizio, str):
        try:
            ora_inizio = datetime.strptime(ora_inizio, '%H:%M').time()
        except:
            return 0.0
    
    if isinstance(ora_fine, str):
        try:
            ora_fine = datetime.strptime(ora_fine, '%H:%M').time()
        except:
            return 0.0
    
    # Converti in minuti
    minuti_inizio = ora_inizio.hour * 60 + ora_inizio.minute
    minuti_fine = ora_fine.hour * 60 + ora_fine.minute
    
    # Se fine < inizio, assume che sia il giorno dopo
    if minuti_fine < minuti_inizio:
        minuti_fine += 24 * 60
    
    # Differenza in minuti
    diff_minuti = minuti_fine - minuti_inizio
    
    # Logica: fino a 29 minuti = 0.5 ore, da 30 minuti = arrotondato per eccesso all'ora
    import math
    if diff_minuti < 30:
        # Fino a 29 minuti: mezz'ora
        monte_ore = 0.5
    else:
        # Da 30 minuti in poi: arrotondato per eccesso all'ora completa
        monte_ore = math.ceil(diff_minuti / 60.0)
    
    return monte_ore

def get_template_environment():
    """Crea l'ambiente Jinja2 con FileSystemLoader per caricare template da file"""
    template_dir = Path(__file__).parent.parent / "templates"
    return Environment(loader=FileSystemLoader(str(template_dir)))

def get_rit_template():
    """Restituisce il template completo del RIT caricato dal file"""
    env = get_template_environment()
    return env.get_template("rit_template.html")

def get_prelievo_copie_template():
    """Restituisce il template semplificato per il prelievo copie"""
    env = get_template_environment()
    return env.get_template("prelievo_copie_template.html")

def genera_pdf_intervento(intervento, azienda_settings) -> bytes:
    """
    Genera il PDF. Tenta di usare WeasyPrint (HTML).
    Se fallisce o non installato, usa FPDF (Old Style) per evitare crash.
    """
    # 1. Normalizzazione Dati Azienda (evita NoneType error)
    safe_azienda = azienda_settings if azienda_settings else {}
    if not isinstance(safe_azienda, dict):
        # Se arriva come oggetto Pydantic, convertilo
        try:
            safe_azienda = azienda_settings.model_dump() 
        except:
            # Se è un oggetto SQLAlchemy, convertilo manualmente in dizionario
            if hasattr(azienda_settings, '__table__'):
                # È un modello SQLAlchemy, estrai tutti i campi
                safe_azienda = {}
                for column in azienda_settings.__table__.columns:
                    value = getattr(azienda_settings, column.name, None)
                    safe_azienda[column.name] = value
            elif hasattr(azienda_settings, '__dict__'):
                # Oggetto Python normale
                safe_azienda = {k: v for k, v in azienda_settings.__dict__.items() if not k.startswith('_')}
            else:
                safe_azienda = {}

    # 2. Calcoli per il PDF
    # Normalizza ora_inizio e ora_fine (gestisci stringhe)
    ora_inizio_norm = intervento.ora_inizio
    ora_fine_norm = intervento.ora_fine
    
    if isinstance(ora_inizio_norm, str):
        try:
            ora_inizio_norm = datetime.strptime(ora_inizio_norm, '%H:%M').time()
        except:
            ora_inizio_norm = None
    
    if isinstance(ora_fine_norm, str):
        try:
            ora_fine_norm = datetime.strptime(ora_fine_norm, '%H:%M').time()
        except:
            ora_fine_norm = None
    
    # Monte ore (usa la nuova logica: fino a 29 min = 0.5h, da 30 min = arrotondato per eccesso)
    monte_ore = calcola_monte_ore(ora_inizio_norm, ora_fine_norm)
    
    # Calcolo minuti per descrizione
    diff_minuti = 0
    if ora_inizio_norm and ora_fine_norm:
        minuti_inizio = ora_inizio_norm.hour * 60 + ora_inizio_norm.minute
        minuti_fine = ora_fine_norm.hour * 60 + ora_fine_norm.minute
        if minuti_fine < minuti_inizio:
            minuti_fine += 24 * 60
        diff_minuti = minuti_fine - minuti_inizio
    
    # Costo orario dalla tariffa applicata
    costo_orario = intervento.tariffa_oraria_applicata or 0.0
    
    # Costo ore lavorate
    costo_ore = monte_ore * costo_orario
    
    # Costi extra manuali (quelli inseriti manualmente, escludendo le ore)
    costi_extra_manuale = intervento.costi_extra or 0.0
    
    # Se è un contratto o prelievo copie, le ore non devono essere conteggiate nel totale economico
    # Le ore vengono comunque mostrate nel PDF per riferimento, ma non vengono incluse nel calcolo
    is_contratto_o_prelievo = intervento.is_contratto or intervento.is_prelievo_copie
    
    # Costi extra finali (manuali + ore se NON è contratto/prelievo)
    costi_extra_finale = costi_extra_manuale + (costo_ore if not is_contratto_o_prelievo else 0.0)
    
    # Totale ricambi
    totale_ricambi = sum(r.quantita * r.prezzo_unitario for r in intervento.ricambi_utilizzati) if intervento.ricambi_utilizzati else 0.0
    
    # Imponibile = ricambi + costi extra finali + chiamata
    imponibile = totale_ricambi + costi_extra_finale + (intervento.costo_chiamata_applicato if intervento.flag_diritto_chiamata else 0.0)
    
    # IVA 22%
    iva = imponibile * 0.22
    
    # Totale
    totale = imponibile + iva

    # 3. PROVIAMO WEASYPRINT (La via Maestra)
    if HAS_WEASYPRINT:
        try:
            print(f"Generazione PDF con WeasyPrint per RIT: {intervento.numero_relazione}")
            # Debug: verifica che i dati azienda siano presenti
            print(f"[PDF DEBUG] Dati azienda per RIT {intervento.numero_relazione}:")
            print(f"  - nome_azienda: {safe_azienda.get('nome_azienda', 'NON PRESENTE')}")
            print(f"  - indirizzo_completo: {safe_azienda.get('indirizzo_completo', 'NON PRESENTE')}")
            print(f"  - p_iva: {safe_azienda.get('p_iva', 'NON PRESENTE')}")
            print(f"  - telefono: {safe_azienda.get('telefono', 'NON PRESENTE')}")
            print(f"  - email: {safe_azienda.get('email', 'NON PRESENTE')}")
            print(f"  - logo_url: {safe_azienda.get('logo_url', 'NON PRESENTE')}")
            
            # Normalizza logo_url per WeasyPrint (deve essere un path assoluto o URL)
            if safe_azienda.get('logo_url') and safe_azienda['logo_url'].startswith('/uploads/'):
                # Nel container Docker, i file sono in /app/uploads/
                logo_filename = safe_azienda['logo_url'].replace('/uploads/', '')
                # Prova diversi path possibili
                possible_paths = [
                    Path('/app') / safe_azienda['logo_url'].lstrip('/'),  # Path assoluto nel container: /app/uploads/logos/logo.png
                    Path('/app/uploads') / logo_filename,  # Path diretto: /app/uploads/logos/logo.png
                ]
                
                logo_path = None
                for path in possible_paths:
                    if path.exists():
                        logo_path = path
                        break
                
                if logo_path:
                    # Usa file:// per WeasyPrint
                    abs_path = str(logo_path.absolute()).replace('\\', '/')
                    safe_azienda['logo_url'] = f"file://{abs_path}"
                    print(f"✅ Logo trovato: {safe_azienda['logo_url']}")
                else:
                    print(f"⚠️ ATTENZIONE: Logo non trovato. Path cercati: {[str(p) for p in possible_paths]}")
                    safe_azienda['logo_url'] = None
            elif safe_azienda.get('logo_url'):
                print(f"ℹ️ Logo URL presente ma non in formato /uploads/: {safe_azienda.get('logo_url')}")
            else:
                print(f"ℹ️ Nessun logo URL configurato")
            
            # Carica letture copie se è un prelievo copie
            # Le informazioni dell'asset dovrebbero essere già incluse nelle letture copie
            # quando vengono caricate prima di chiamare questa funzione
            letture_copie_dettagli = []
            if intervento.is_prelievo_copie:
                print(f"[PDF GENERATION] Prelievo copie rilevato per RIT {intervento.numero_relazione}")
                print(f"[PDF GENERATION] hasattr(intervento, 'letture_copie'): {hasattr(intervento, 'letture_copie')}")
                if hasattr(intervento, 'letture_copie') and intervento.letture_copie:
                    print(f"[PDF GENERATION] Trovate {len(intervento.letture_copie)} letture copie")
                    for lettura in intervento.letture_copie:
                        # Parse delle note per estrarre i dettagli del calcolo
                        note = lettura.note or ""
                        
                        # Estrai informazioni asset se disponibili (aggiunte durante il caricamento)
                        asset_marca = getattr(lettura, 'asset_marca', '') or ''
                        asset_modello = getattr(lettura, 'asset_modello', '') or ''
                        asset_marca_modello = getattr(lettura, 'asset_marca_modello', '') or ''
                        
                        print(f"[PDF GENERATION] Lettura {lettura.id}: asset_id={lettura.asset_id}, asset_marca_modello={asset_marca_modello}")
                        
                        # Se non disponibili, prova a costruirle da marca e modello
                        if not asset_marca_modello and (asset_marca or asset_modello):
                            asset_marca_modello = f"{asset_marca} {asset_modello}".strip() or 'N/A'
                        
                        letture_copie_dettagli.append({
                            'asset_id': lettura.asset_id,
                            'data_lettura': lettura.data_lettura,
                            'contatore_bn': lettura.contatore_bn,
                            'contatore_colore': lettura.contatore_colore,
                            'note': note,
                            'asset_marca': asset_marca,
                            'asset_modello': asset_modello,
                            'asset_marca_modello': asset_marca_modello or 'N/A'
                        })
                else:
                    print(f"[PDF GENERATION] ATTENZIONE: Nessuna lettura copie trovata per prelievo copie!")
            
            print(f"[PDF GENERATION] Totale letture_copie_dettagli preparate: {len(letture_copie_dettagli)}")
            
            # Verifica se è solo prelievo copie (nessun dettaglio o ricambi significativi)
            has_manutenzione = False
            if hasattr(intervento, 'dettagli') and intervento.dettagli:
                # Controlla se ci sono dettagli con descrizione lavoro significativa
                for det in intervento.dettagli:
                    if det.descrizione_lavoro and det.descrizione_lavoro.strip() and det.descrizione_lavoro.strip() != '-':
                        has_manutenzione = True
                        break
            
            if hasattr(intervento, 'ricambi_utilizzati') and intervento.ricambi_utilizzati:
                # Se ci sono ricambi utilizzati, c'è manutenzione
                has_manutenzione = True
            
            # Se è solo prelievo copie, genera PDF semplificato
            if intervento.is_prelievo_copie and not has_manutenzione:
                print(f"Generazione PDF semplificato per prelievo copie: {intervento.numero_relazione}")
                template_prelievo = get_prelievo_copie_template()
                html_prelievo = template_prelievo.render(
                    rit=intervento,
                    azienda=safe_azienda,
                    datetime=datetime,
                    letture_copie_dettagli=letture_copie_dettagli,
                    hide_firme=False
                )
                pdf_file = io.BytesIO()
                HTML(string=html_prelievo).write_pdf(pdf_file, stylesheets=[CSS(string=CSS_STYLE)])
                pdf_file.seek(0)
                return pdf_file.read()
            
            # Se c'è anche manutenzione, genera entrambi i PDF e uniscili
            elif intervento.is_prelievo_copie and has_manutenzione:
                print(f"Generazione PDF combinato (prelievo copie + manutenzione): {intervento.numero_relazione}")
                
                # 1. Genera PDF prelievo copie (senza firme)
                template_prelievo = get_prelievo_copie_template()
                html_prelievo = template_prelievo.render(
                    rit=intervento,
                    azienda=safe_azienda,
                    datetime=datetime,
                    letture_copie_dettagli=letture_copie_dettagli,
                    hide_firme=True  # Nascondi firme nel PDF prelievo
                )
                pdf_prelievo_file = io.BytesIO()
                HTML(string=html_prelievo).write_pdf(pdf_prelievo_file, stylesheets=[CSS(string=CSS_STYLE)])
                pdf_prelievo_file.seek(0)
                
                # 2. Genera PDF RIT completo (con firme)
                template_rit = get_rit_template()
                html_rit = template_rit.render(
                    rit=intervento, 
                    azienda=safe_azienda,
                    datetime=datetime,
                    monte_ore=monte_ore,
                    diff_minuti=diff_minuti,
                    costo_orario=costo_orario,
                    costo_ore=costo_ore,
                    costi_extra_manuale=costi_extra_manuale,
                    costi_extra_finale=costi_extra_finale,
                    imponibile=imponibile,
                    iva=iva,
                    totale=totale,
                    is_contratto_o_prelievo=is_contratto_o_prelievo,
                    letture_copie_dettagli=letture_copie_dettagli
                )
                pdf_rit_file = io.BytesIO()
                HTML(string=html_rit).write_pdf(pdf_rit_file, stylesheets=[CSS(string=CSS_STYLE)])
                pdf_rit_file.seek(0)
                
                # 3. Unisci i PDF (prelievo copie + RIT completo)
                if HAS_PYPDF2:
                    try:
                        merger = PdfWriter()
                        # Aggiungi PDF prelievo copie
                        merger.append(PdfReader(pdf_prelievo_file))
                        # Aggiungi PDF RIT completo (con firme)
                        merger.append(PdfReader(pdf_rit_file))
                        # Scrivi PDF unito
                        pdf_merged = io.BytesIO()
                        merger.write(pdf_merged)
                        pdf_merged.seek(0)
                        return pdf_merged.read()
                    except Exception as e:
                        print(f"Errore merge PDF: {e}. Restituisco solo PDF RIT completo.")
                        pdf_rit_file.seek(0)
                        return pdf_rit_file.read()
                else:
                    # Se PyPDF2 non è disponibile, restituisci solo il PDF RIT completo
                    print("PyPDF2 non disponibile. Restituisco solo PDF RIT completo.")
                    pdf_rit_file.seek(0)
                    return pdf_rit_file.read()
            
            # Se non è prelievo copie, genera PDF RIT normale
            else:
                template = get_rit_template()
                html_content = template.render(
                    rit=intervento, 
                    azienda=safe_azienda,
                    datetime=datetime,
                    monte_ore=monte_ore,
                    diff_minuti=diff_minuti,
                    costo_orario=costo_orario,
                    costo_ore=costo_ore,
                    costi_extra_manuale=costi_extra_manuale,
                    costi_extra_finale=costi_extra_finale,
                    imponibile=imponibile,
                    iva=iva,
                    totale=totale,
                    is_contratto_o_prelievo=is_contratto_o_prelievo,
                    letture_copie_dettagli=letture_copie_dettagli
                )
                pdf_file = io.BytesIO()
                HTML(string=html_content).write_pdf(pdf_file, stylesheets=[CSS(string=CSS_STYLE)])
                pdf_file.seek(0)
                return pdf_file.read()
        except Exception as e:
            print(f"Errore WeasyPrint: {e}. Passo al fallback FPDF.")
            import traceback
            traceback.print_exc()
    
    # 4. FALLBACK FPDF (Se WeasyPrint fallisce o mancano librerie di sistema)
    if FPDF is None:
        raise Exception("Nessun motore PDF disponibile. Installare WeasyPrint o fpdf2.")
    
    # Questo codice viene eseguito SOLO se WeasyPrint non va.
    # Istanziamo la classe FIXATA che accetta argomenti.
    pdf = PDF(orientation='P', unit='mm', format='A4')
    pdf.azienda = safe_azienda
    pdf.add_page()
    
    # Contenuto base FPDF
    pdf.set_font("Arial", size=12)
    pdf.cell(0, 10, f"RIT: {intervento.numero_relazione}", ln=True)
    pdf.cell(0, 10, f"Cliente: {intervento.cliente_ragione_sociale}", ln=True)
    
    pdf.ln(10)
    pdf.set_font("Arial", 'B', 10)
    pdf.cell(0, 10, "Dettagli Lavori (Modalità Compatibilità)", ln=True)
    pdf.set_font("Arial", size=10)
    
    for det in intervento.dettagli:
        pdf.multi_cell(0, 10, f"- {det.marca_modello}: {det.descrizione_lavoro}")

    # Gestione corretta del return FPDF (gestisce bytes, bytearray e string)
    pdf_bytes = pdf.output(dest='S')
    if isinstance(pdf_bytes, str):
        return pdf_bytes.encode('latin-1')
    elif isinstance(pdf_bytes, bytearray):
        return bytes(pdf_bytes)
    return pdf_bytes
