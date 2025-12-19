#!/usr/bin/env python3
"""
Script per creare/resettare l'utente superadmin
"""
import bcrypt
from app.database import SessionLocal
from app import models

def hash_password(password: str) -> str:
    """Hash password usando bcrypt direttamente"""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    """Verifica password"""
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

def create_or_reset_admin():
    db = SessionLocal()
    try:
        # Cerca utente esistente
        admin = db.query(models.Utente).filter(
            models.Utente.email == "admin@sistema54.it"
        ).first()
        
        password = "admin123"
        password_hash = hash_password(password)
        
        if admin:
            print(f"⚠️ Utente esistente trovato: {admin.email}")
            print(f"   Ruolo: {admin.ruolo}")
            print(f"   Attivo: {admin.is_active}")
            print(f"   Ha password: {bool(admin.password_hash)}")
            
            # Reset password
            admin.password_hash = password_hash
            admin.is_active = True
            admin.ruolo = models.RuoloUtente.SUPERADMIN
            db.commit()
            print(f"✅ Password resettata per: {admin.email}")
        else:
            # Crea nuovo utente
            new_admin = models.Utente(
                email="admin@sistema54.it",
                password_hash=password_hash,
                nome_completo="Super Admin",
                ruolo=models.RuoloUtente.SUPERADMIN,
                is_active=True
            )
            db.add(new_admin)
            db.commit()
            db.refresh(new_admin)
            print(f"✅ Nuovo SuperAdmin creato: {new_admin.email}")
        
        # Verifica
        verify = db.query(models.Utente).filter(
            models.Utente.email == "admin@sistema54.it"
        ).first()
        
        if verify and verify_password("admin123", verify.password_hash):
            print("✅ Verifica password: OK")
            print(f"\n📋 Credenziali di accesso:")
            print(f"   Email: admin@sistema54.it")
            print(f"   Password: admin123")
        else:
            print("❌ Errore: Password non verificata correttamente")
            
    except Exception as e:
        print(f"❌ Errore: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_or_reset_admin()

