"""
Script per verificare la coerenza tra i modelli SQLAlchemy e la struttura del database
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import models
from sqlalchemy import inspect

def verify_structure():
    db = SessionLocal()
    inspector = inspect(db.bind)
    
    print("=== VERIFICA COERENZA STRUTTURA DATABASE ===\n")
    
    # Mappa nomi tabelle
    table_mapping = {
        'utenti': models.Utente,
        'clienti': models.Cliente,
        'sedi_cliente': models.SedeCliente,
        'assets_cliente': models.AssetCliente,
        'interventi': models.Intervento,
        'dettagli_intervento': models.DettaglioIntervento,
        'magazzino': models.ProdottoMagazzino,
        'movimenti_ricambi': models.MovimentoRicambio,
        'letture_copie': models.LetturaCopie,
        'impostazioni_azienda': models.ImpostazioniAzienda
    }
    
    all_ok = True
    
    for table_name, model_class in table_mapping.items():
        # Ottieni colonne dal database
        try:
            db_cols = {c['name']: c for c in inspector.get_columns(table_name)}
        except Exception as e:
            print(f"❌ ERRORE: Tabella '{table_name}' non trovata nel database!")
            all_ok = False
            continue
        
        # Ottieni colonne dal modello
        model_cols = {c.name: c for c in model_class.__table__.columns}
        
        # Verifica campi mancanti
        missing = [c for c in model_cols.keys() if c not in db_cols.keys()]
        # Verifica campi extra (non critici, ma da segnalare)
        extra = [c for c in db_cols.keys() if c not in model_cols.keys()]
        
        if missing:
            print(f"⚠️  {table_name}:")
            print(f"   MANCANTI: {missing}")
            all_ok = False
        
        if extra:
            print(f"ℹ️  {table_name}:")
            print(f"   EXTRA (non nel modello): {extra}")
    
    if all_ok:
        print("✅ Tutte le tabelle sono coerenti con i modelli!")
    
    db.close()
    return all_ok

if __name__ == "__main__":
    verify_structure()

