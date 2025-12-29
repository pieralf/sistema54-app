"""
Migration script per aggiungere il campo cadenza_letture_copie
alla tabella assets_cliente
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        # Aggiungi campo cadenza_letture_copie
        conn.execute(text("""
            ALTER TABLE assets_cliente 
            ADD COLUMN IF NOT EXISTS cadenza_letture_copie VARCHAR(20) DEFAULT 'trimestrale';
        """))
        
        # Aggiorna tutti i prodotti Printing esistenti con valore di default
        conn.execute(text("""
            UPDATE assets_cliente 
            SET cadenza_letture_copie = 'trimestrale' 
            WHERE cadenza_letture_copie IS NULL AND tipo_asset = 'Printing';
        """))
        
        conn.commit()
        print("✅ Migration cadenza_letture_copie completata")

if __name__ == "__main__":
    migrate()


