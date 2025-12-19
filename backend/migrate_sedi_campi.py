#!/usr/bin/env python3
"""
Script di migrazione per aggiungere campi opzionali alle sedi
Aggiunge: citta, cap, telefono, email a sedi_cliente
"""

import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

db_host = os.getenv("DATABASE_HOST", "db")
DATABASE_URL = f"postgresql://admin:sistema54secure@{db_host}:5432/sistema54_db"

def migrate():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🔄 Aggiunta campi opzionali alle sedi...")
        
        for campo in ['citta', 'cap', 'telefono', 'email']:
            session.execute(text(f"""
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name='sedi_cliente' AND column_name='{campo}'
                    ) THEN
                        ALTER TABLE sedi_cliente ADD COLUMN {campo} VARCHAR;
                    END IF;
                END $$;
            """))
            print(f"  ✓ Campo {campo} aggiunto")
        
        session.commit()
        print("✅ Migrazione completata!")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Errore: {e}")
        sys.exit(1)
    finally:
        session.close()

if __name__ == "__main__":
    migrate()




