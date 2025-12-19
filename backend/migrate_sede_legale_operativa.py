"""
Migrazione: Aggiunge il campo sede_legale_operativa alla tabella clienti
"""
from sqlalchemy import create_engine, text
from app.database import SQLALCHEMY_DATABASE_URL

def migrate():
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    with engine.connect() as conn:
        # Aggiungi la colonna sede_legale_operativa
        conn.execute(text("""
            ALTER TABLE clienti 
            ADD COLUMN IF NOT EXISTS sede_legale_operativa BOOLEAN DEFAULT FALSE;
        """))
        conn.commit()
        print("✅ Colonna sede_legale_operativa aggiunta alla tabella clienti")

if __name__ == "__main__":
    migrate()

