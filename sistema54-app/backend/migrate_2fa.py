"""
Script di migrazione per aggiungere i campi 2FA alla tabella utenti
"""
import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Configurazione database
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:sistema54secure@localhost:5432/sistema54_db")

def migrate():
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        print("🔄 Aggiunta colonne 2FA alla tabella 'utenti'...")
        
        # Verifica se le colonne esistono già
        check_columns = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='utenti' AND column_name IN ('two_factor_enabled', 'two_factor_secret', 'two_factor_backup_codes')
        """)
        existing = [row[0] for row in session.execute(check_columns).fetchall()]
        
        # Aggiungi two_factor_enabled
        if 'two_factor_enabled' not in existing:
            add_enabled = text("""
                ALTER TABLE utenti 
                ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE
            """)
            session.execute(add_enabled)
            print("✅ Colonna 'two_factor_enabled' aggiunta")
        else:
            print("ℹ️ Colonna 'two_factor_enabled' già esistente")
        
        # Aggiungi two_factor_secret
        if 'two_factor_secret' not in existing:
            add_secret = text("""
                ALTER TABLE utenti 
                ADD COLUMN two_factor_secret VARCHAR
            """)
            session.execute(add_secret)
            print("✅ Colonna 'two_factor_secret' aggiunta")
        else:
            print("ℹ️ Colonna 'two_factor_secret' già esistente")
        
        # Aggiungi two_factor_backup_codes
        if 'two_factor_backup_codes' not in existing:
            add_backup = text("""
                ALTER TABLE utenti 
                ADD COLUMN two_factor_backup_codes JSONB
            """)
            session.execute(add_backup)
            print("✅ Colonna 'two_factor_backup_codes' aggiunta")
        else:
            print("ℹ️ Colonna 'two_factor_backup_codes' già esistente")
        
        session.commit()
        print("✅ Migrazione 2FA completata con successo!")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Errore durante la migrazione: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        session.close()

if __name__ == "__main__":
    migrate()



