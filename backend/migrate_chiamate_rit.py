"""
Migration script per aggiungere i campi delle chiamate contratto alla tabella interventi
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine
from sqlalchemy import text

def migrate():
    """Aggiunge i campi per le chiamate contratto negli interventi"""
    print("=== Migration: Chiamate Contratto RIT ===")
    
    with engine.connect() as conn:
        try:
            # Aggiungi le colonne se non esistono già
            conn.execute(text("""
                ALTER TABLE interventi 
                ADD COLUMN IF NOT EXISTS chiamate_utilizzate_contratto INTEGER NULL,
                ADD COLUMN IF NOT EXISTS chiamate_rimanenti_contratto INTEGER NULL,
                ADD COLUMN IF NOT EXISTS limite_chiamate_contratto INTEGER NULL;
            """))
            conn.commit()
            print("✓ Colonne aggiunte con successo")
        except Exception as e:
            print(f"✗ Errore durante la migration: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    migrate()


