#!/usr/bin/env python3
"""
Script di migrazione per aggiungere nome_cliente e cognome_cliente a interventi
"""

import sys
import os
from sqlalchemy import create_engine, text

db_host = os.getenv("DATABASE_HOST", "db")
DATABASE_URL = f"postgresql://admin:sistema54secure@{db_host}:5432/sistema54_db"

def migrate():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🔄 Aggiunta campi nome_cliente e cognome_cliente...")
        
        session.execute(text("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='interventi' AND column_name='nome_cliente'
                ) THEN
                    ALTER TABLE interventi ADD COLUMN nome_cliente VARCHAR;
                END IF;
            END $$;
        """))
        
        session.execute(text("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='interventi' AND column_name='cognome_cliente'
                ) THEN
                    ALTER TABLE interventi ADD COLUMN cognome_cliente VARCHAR;
                END IF;
            END $$;
        """))
        
        session.commit()
        print("✅ Migrazione completata!")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Errore: {e}")
        sys.exit(1)
    finally:
        session.close()

if __name__ == "__main__":
    from sqlalchemy.orm import sessionmaker
    migrate()




