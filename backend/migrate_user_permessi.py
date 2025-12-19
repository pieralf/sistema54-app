"""
Script di migrazione per aggiungere il campo permessi alla tabella utenti
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
        print("🔄 Aggiunta colonna 'permessi' alla tabella 'utenti'...")
        
        # Verifica se la colonna esiste già
        check_column = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='utenti' AND column_name='permessi'
        """)
        result = session.execute(check_column).fetchone()
        
        if result:
            print("✅ Colonna 'permessi' già esistente, skip...")
        else:
            # Aggiungi colonna permessi di tipo JSONB con default {}
            add_column = text("""
                ALTER TABLE utenti 
                ADD COLUMN permessi JSONB DEFAULT '{}'::jsonb
            """)
            session.execute(add_column)
            session.commit()
            print("✅ Colonna 'permessi' aggiunta con successo!")
        
        # Aggiorna tutti gli utenti esistenti con permessi vuoti se NULL
        update_null = text("""
            UPDATE utenti 
            SET permessi = '{}'::jsonb 
            WHERE permessi IS NULL
        """)
        session.execute(update_null)
        session.commit()
        print("✅ Permessi inizializzati per tutti gli utenti esistenti")
        
    except Exception as e:
        session.rollback()
        print(f"❌ Errore durante la migrazione: {e}")
        sys.exit(1)
    finally:
        session.close()

if __name__ == "__main__":
    migrate()



