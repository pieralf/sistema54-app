"""
Migration script per aggiungere i campi del contratto di assistenza alla tabella clienti
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine
from sqlalchemy import text

def migrate():
    """Aggiunge i campi per il contratto di assistenza"""
    print("=== Migration: Contratto Assistenza ===")
    
    with engine.connect() as conn:
        try:
            # Aggiungi le colonne se non esistono già
            conn.execute(text("""
                ALTER TABLE clienti 
                ADD COLUMN IF NOT EXISTS data_inizio_contratto_assistenza TIMESTAMP NULL,
                ADD COLUMN IF NOT EXISTS data_fine_contratto_assistenza TIMESTAMP NULL,
                ADD COLUMN IF NOT EXISTS limite_chiamate_contratto INTEGER NULL,
                ADD COLUMN IF NOT EXISTS chiamate_utilizzate_contratto INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS costo_chiamata_fuori_limite DOUBLE PRECISION NULL;
            """))
            conn.commit()
            print("✓ Colonne aggiunte con successo")
        except Exception as e:
            print(f"✗ Errore durante la migration: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    migrate()


