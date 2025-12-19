#!/usr/bin/env python3
"""
Migrazione per aggiungere i nuovi campi per la gestione del noleggio agli assets
"""
import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Configurazione database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:sistema54secure@db:5432/sistema54_db")

def migrate():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("Inizio migrazione assets_cliente per noleggio...")
        
        # Aggiungi colonne per tipo asset e scadenza
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS tipo_asset VARCHAR;
        """))
        
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS data_scadenza_noleggio TIMESTAMP;
        """))
        
        # Campi specifici per Printing
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS is_colore BOOLEAN;
        """))
        
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS contatore_iniziale_bn INTEGER DEFAULT 0;
        """))
        
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS contatore_iniziale_colore INTEGER DEFAULT 0;
        """))
        
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS copie_incluse_bn INTEGER;
        """))
        
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS copie_incluse_colore INTEGER;
        """))
        
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS costo_copia_bn_fuori_limite FLOAT;
        """))
        
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS costo_copia_colore_fuori_limite FLOAT;
        """))
        
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS costo_copia_bn_non_incluse FLOAT;
        """))
        
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS costo_copia_colore_non_incluse FLOAT;
        """))
        
        # Campi specifici per IT
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS codice_prodotto VARCHAR;
        """))
        
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS seriale VARCHAR;
        """))
        
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS descrizione TEXT;
        """))
        
        session.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS is_nuovo BOOLEAN;
        """))
        
        # Aggiungi email_notifiche_scadenze alle impostazioni
        session.execute(text("""
            ALTER TABLE impostazioni_azienda 
            ADD COLUMN IF NOT EXISTS email_notifiche_scadenze VARCHAR;
        """))
        
        # Aggiorna i record esistenti: se hanno marca/modello ma non tipo, imposta come "Printing"
        session.execute(text("""
            UPDATE assets_cliente 
            SET tipo_asset = 'Printing' 
            WHERE tipo_asset IS NULL AND (marca IS NOT NULL OR modello IS NOT NULL);
        """))
        
        session.commit()
        print("Migrazione completata con successo!")
        
    except Exception as e:
        session.rollback()
        print(f"Errore durante la migrazione: {str(e)}")
        raise
    finally:
        session.close()

if __name__ == "__main__":
    migrate()

