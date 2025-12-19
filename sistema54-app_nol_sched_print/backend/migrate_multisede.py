#!/usr/bin/env python3
"""
Script di migrazione per aggiungere supporto multisede
Aggiunge:
- Tabella sedi_cliente
- Campo has_multisede a clienti
- Campi sede_id, sede_indirizzo, sede_nome a interventi
"""

import sys
from sqlalchemy import create_engine, text, Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import sessionmaker

# Configurazione database (usa le stesse credenziali di database.py)
# Prova prima con 'db' (Docker), poi 'localhost' (locale)
import os
db_host = os.getenv("DATABASE_HOST", "db")
DATABASE_URL = f"postgresql://admin:sistema54secure@{db_host}:5432/sistema54_db"

def migrate():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🔄 Inizio migrazione multisede...")
        
        # 1. Crea tabella sedi_cliente se non esiste
        print("📋 Creazione tabella sedi_cliente...")
        session.execute(text("""
            CREATE TABLE IF NOT EXISTS sedi_cliente (
                id SERIAL PRIMARY KEY,
                cliente_id INTEGER NOT NULL REFERENCES clienti(id) ON DELETE CASCADE,
                nome_sede VARCHAR NOT NULL,
                indirizzo_completo VARCHAR NOT NULL
            );
        """))
        
        # 2. Aggiungi campo has_multisede a clienti se non esiste
        print("📋 Aggiunta campo has_multisede a clienti...")
        session.execute(text("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='clienti' AND column_name='has_multisede'
                ) THEN
                    ALTER TABLE clienti ADD COLUMN has_multisede BOOLEAN DEFAULT FALSE;
                END IF;
            END $$;
        """))
        
        # 3. Aggiungi campo sede_id a interventi se non esiste
        print("📋 Aggiunta campo sede_id a interventi...")
        session.execute(text("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='interventi' AND column_name='sede_id'
                ) THEN
                    ALTER TABLE interventi ADD COLUMN sede_id INTEGER REFERENCES sedi_cliente(id);
                END IF;
            END $$;
        """))
        
        # 4. Aggiungi campo sede_indirizzo a interventi se non esiste
        print("📋 Aggiunta campo sede_indirizzo a interventi...")
        session.execute(text("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='interventi' AND column_name='sede_indirizzo'
                ) THEN
                    ALTER TABLE interventi ADD COLUMN sede_indirizzo VARCHAR;
                END IF;
            END $$;
        """))
        
        # 5. Aggiungi campo sede_nome a interventi se non esiste
        print("📋 Aggiunta campo sede_nome a interventi...")
        session.execute(text("""
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='interventi' AND column_name='sede_nome'
                ) THEN
                    ALTER TABLE interventi ADD COLUMN sede_nome VARCHAR;
                END IF;
            END $$;
        """))
        
        session.commit()
        print("✅ Migrazione completata con successo!")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Errore durante la migrazione: {e}")
        sys.exit(1)
    finally:
        session.close()

if __name__ == "__main__":
    migrate()

