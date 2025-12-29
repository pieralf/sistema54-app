#!/usr/bin/env python3
"""
Script per aggiungere il campo tipo_formato alla tabella assets_cliente
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        try:
            # Verifica se la colonna esiste già
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'assets_cliente' 
                AND column_name = 'tipo_formato'
            """))
            
            if result.fetchone():
                print("Colonna tipo_formato già esistente")
                return
            
            # Aggiungi la colonna
            conn.execute(text("""
                ALTER TABLE assets_cliente 
                ADD COLUMN tipo_formato VARCHAR
            """))
            conn.commit()
            print("Colonna tipo_formato aggiunta con successo")
            
        except Exception as e:
            conn.rollback()
            print(f"Errore durante la migrazione: {str(e)}")
            raise

if __name__ == "__main__":
    migrate()




