"""
Migration script per aggiungere la tabella letture_copie
e il campo is_prelievo_copie nella tabella interventi
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        # Crea tabella letture_copie
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS letture_copie (
                id SERIAL PRIMARY KEY,
                asset_id INTEGER NOT NULL REFERENCES assets_cliente(id) ON DELETE CASCADE,
                intervento_id INTEGER REFERENCES interventi(id) ON DELETE SET NULL,
                data_lettura TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                contatore_bn INTEGER NOT NULL DEFAULT 0,
                contatore_colore INTEGER DEFAULT 0,
                tecnico_id INTEGER REFERENCES utenti(id),
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(asset_id, data_lettura)
            );
        """))
        
        # Crea indice per ricerca rapida
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_letture_copie_asset_id ON letture_copie(asset_id);
            CREATE INDEX IF NOT EXISTS idx_letture_copie_data_lettura ON letture_copie(data_lettura);
        """))
        
        # Aggiungi campo is_prelievo_copie alla tabella interventi
        conn.execute(text("""
            ALTER TABLE interventi 
            ADD COLUMN IF NOT EXISTS is_prelievo_copie BOOLEAN DEFAULT FALSE;
        """))
        
        conn.commit()
        print("✅ Migration completata: tabella letture_copie creata e campo is_prelievo_copie aggiunto")

if __name__ == "__main__":
    migrate()


