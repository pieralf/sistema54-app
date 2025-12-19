#!/usr/bin/env python3
"""
Script per creare utente operatore di test
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

def create_test_operator():
    db = SessionLocal()
    try:
        # Cerca utente esistente
        operator = db.query(models.Utente).filter(
            models.Utente.email == "operatore@test.it"
        ).first()
        
        password = "test123"
        password_hash = hash_password(password)
        
        if operator:
            print(f"⚠️ Utente operatore già esistente: {operator.email}")
            operator.password_hash = password_hash
            operator.is_active = True
            operator.ruolo = models.RuoloUtente.OPERATORE
            db.commit()
            print(f"✅ Password resettata per: {operator.email}")
        else:
            # Crea nuovo utente
            new_operator = models.Utente(
                email="operatore@test.it",
                password_hash=password_hash,
                nome_completo="Operatore Test",
                ruolo=models.RuoloUtente.OPERATORE,
                is_active=True
            )
            db.add(new_operator)
            db.commit()
            db.refresh(new_operator)
            print(f"✅ Nuovo Operatore creato: {new_operator.email}")
        
        print(f"\n📋 Credenziali Operatore Test:")
        print(f"   Email: operatore@test.it")
        print(f"   Password: test123")
        print(f"   Ruolo: Operatore (vedrà dashboard mobile)")
            
    except Exception as e:
        print(f"❌ Errore: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_operator()

