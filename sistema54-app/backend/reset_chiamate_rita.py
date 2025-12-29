"""
Script per azzerare i contatori delle chiamate del contratto assistenza
per il cliente I.C. Rita Levi Montalcini Salerno
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import models

def reset_chiamate():
    db = SessionLocal()
    try:
        # Trova il cliente
        cliente = db.query(models.Cliente).filter(
            models.Cliente.ragione_sociale.ilike('%Rita Levi Montalcini%')
        ).first()
        
        if not cliente:
            print("❌ Cliente I.C. Rita Levi Montalcini non trovato!")
            return
        
        print(f"✅ Cliente trovato: {cliente.ragione_sociale} (ID: {cliente.id})")
        print(f"   Chiamate utilizzate attuali: {cliente.chiamate_utilizzate_contratto or 0}")
        print(f"   Limite chiamate: {cliente.limite_chiamate_contratto}")
        
        # Azzera i contatori
        cliente.chiamate_utilizzate_contratto = 0
        db.add(cliente)
        db.commit()
        
        print(f"✅ Contatori azzerati!")
        print(f"   Nuove chiamate utilizzate: {cliente.chiamate_utilizzate_contratto}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Errore: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    reset_chiamate()

