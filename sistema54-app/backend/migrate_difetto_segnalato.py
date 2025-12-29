#!/usr/bin/env python3
"""Aggiunge il campo difetto_segnalato alla tabella interventi"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        try:
            # Verifica se la colonna esiste già
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='interventi' AND column_name='difetto_segnalato'
            """))
            if result.fetchone():
                print("Colonna difetto_segnalato già esistente")
                return
            
            # Aggiungi la colonna
            conn.execute(text("ALTER TABLE interventi ADD COLUMN difetto_segnalato TEXT"))
            conn.commit()
            print("✓ Colonna difetto_segnalato aggiunta con successo")
        except Exception as e:
            conn.rollback()
            print(f"Errore: {e}")
            raise

if __name__ == "__main__":
    migrate()



