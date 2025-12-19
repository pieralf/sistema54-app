from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from . import models, database

# Configurazione
SECRET_KEY = "sistema54-secret-key-change-in-production-use-env-var"  # In produzione usare variabile d'ambiente
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 giorni

# Password hashing - Usa bcrypt direttamente per evitare problemi di compatibilità
def get_password_hash_direct(password: str) -> str:
    """Genera hash della password usando bcrypt direttamente"""
    # Converti password in bytes se è stringa
    if isinstance(password, str):
        password = password.encode('utf-8')
    # Genera salt e hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password, salt)
    return hashed.decode('utf-8')

def verify_password_direct(plain_password: str, hashed_password: str) -> bool:
    """Verifica password usando bcrypt direttamente"""
    if isinstance(plain_password, str):
        plain_password = plain_password.encode('utf-8')
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_password, hashed_password)

# Password hashing (fallback su passlib se disponibile)
try:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    USE_DIRECT_BCRYPT = False
except:
    USE_DIRECT_BCRYPT = True

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una password in chiaro contro un hash"""
    if USE_DIRECT_BCRYPT:
        return verify_password_direct(plain_password, hashed_password)
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except:
        # Fallback su bcrypt diretto
        return verify_password_direct(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Genera hash della password"""
    if USE_DIRECT_BCRYPT:
        return get_password_hash_direct(password)
    try:
        return pwd_context.hash(password)
    except:
        # Fallback su bcrypt diretto
        return get_password_hash_direct(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Crea un JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def authenticate_user(db: Session, email: str, password: str):
    """Autentica un utente con email e password"""
    user = db.query(models.Utente).filter(models.Utente.email == email).first()
    if not user:
        return False
    if not user.is_active:
        return False
    if not user.password_hash:
        return False  # Utente OAuth-only
    if not verify_password(password, user.password_hash):
        return False
    
    # Aggiorna last_login
    user.last_login = datetime.now()
    db.commit()
    
    return user

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    """Ottiene l'utente corrente dal token JWT"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(models.Utente).filter(models.Utente.email == email).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user

def get_current_active_user(current_user: models.Utente = Depends(get_current_user)):
    """Verifica che l'utente sia attivo"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def require_role(allowed_roles: list):
    """Dependency per verificare il ruolo dell'utente"""
    def role_checker(current_user: models.Utente = Depends(get_current_active_user)):
        if current_user.ruolo not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker

# Shortcuts per ruoli comuni
def require_admin(current_user: models.Utente = Depends(get_current_active_user)):
    """Richiede ruolo admin o superadmin"""
    if current_user.ruolo not in [models.RuoloUtente.ADMIN, models.RuoloUtente.SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def require_superadmin(current_user: models.Utente = Depends(get_current_active_user)):
    """Richiede ruolo superadmin"""
    if current_user.ruolo != models.RuoloUtente.SUPERADMIN:
        raise HTTPException(status_code=403, detail="SuperAdmin access required")
    return current_user

