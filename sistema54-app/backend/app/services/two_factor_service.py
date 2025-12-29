"""
Servizio per gestire l'autenticazione a due fattori (2FA) con TOTP
Compatibile con Authy, Google Authenticator, Microsoft Authenticator, ecc.
"""
import pyotp
import qrcode
import io
import base64
import secrets
from typing import Tuple, List

def generate_secret() -> str:
    """Genera un secret TOTP casuale"""
    return pyotp.random_base32()

def generate_qr_code(secret: str, email: str, app_name: str = "SISTEMA54") -> str:
    """
    Genera un QR code per configurare l'app di autenticazione
    
    Args:
        secret: Secret TOTP
        email: Email dell'utente
        app_name: Nome dell'applicazione
    
    Returns:
        Base64 encoded PNG image del QR code
    """
    # Crea URI TOTP standard (compatibile con tutte le app)
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=email,
        issuer_name=app_name
    )
    
    # Genera QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(totp_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Converti in base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_base64}"

def verify_totp(secret: str, token: str) -> bool:
    """
    Verifica un codice TOTP
    
    Args:
        secret: Secret TOTP dell'utente
        token: Codice a 6 cifre inserito dall'utente
    
    Returns:
        True se il codice è valido, False altrimenti
    """
    if not secret or not token:
        return False
    
    try:
        totp = pyotp.TOTP(secret)
        # Verifica il codice corrente e i 2 precedenti/posteriori (per compensare drift orario)
        return totp.verify(token, valid_window=2)
    except Exception:
        return False

def generate_backup_codes(count: int = 10) -> List[str]:
    """
    Genera codici di backup per 2FA
    
    Args:
        count: Numero di codici da generare
    
    Returns:
        Lista di codici di backup (stringhe di 8 caratteri)
    """
    codes = []
    for _ in range(count):
        # Genera codice casuale di 8 caratteri alfanumerici
        code = ''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(8))
        codes.append(code)
    return codes

def verify_backup_code(backup_codes: List[str], code: str) -> Tuple[bool, List[str]]:
    """
    Verifica un codice di backup e lo rimuove se valido
    
    Args:
        backup_codes: Lista di codici di backup disponibili
        code: Codice da verificare
    
    Returns:
        Tuple (is_valid, remaining_codes)
    """
    if not backup_codes or not code:
        return False, backup_codes or []
    
    code_upper = code.upper().strip()
    if code_upper in backup_codes:
        # Rimuovi il codice usato
        remaining = [c for c in backup_codes if c != code_upper]
        return True, remaining
    return False, backup_codes



