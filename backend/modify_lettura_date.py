"""
Script per modificare la data dell'ultima lettura copie del cliente ASIS
a più di 3 mesi fa per permettere test di prelievo successivo
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import models
from datetime import datetime, timedelta
from sqlalchemy import desc

def modify_letture_date():
    db = SessionLocal()
    try:
        # Trova il cliente ASIS
        cliente = db.query(models.Cliente).filter(
            models.Cliente.ragione_sociale.ilike('%asis%')
        ).first()
        
        if not cliente:
            print("❌ Cliente ASIS non trovato")
            return
        
        print(f"✅ Cliente trovato: {cliente.ragione_sociale} (ID: {cliente.id})")
        
        # Trova tutti gli asset Printing del cliente
        assets_printing = db.query(models.AssetCliente).filter(
            models.AssetCliente.cliente_id == cliente.id,
            models.AssetCliente.tipo_asset == "Printing"
        ).all()
        
        if not assets_printing:
            print("❌ Nessun asset Printing trovato per il cliente ASIS")
            return
        
        print(f"✅ Trovati {len(assets_printing)} asset Printing")
        
        # Per ogni asset, trova l'ultima lettura e modifica la data
        for asset in assets_printing:
            ultima_lettura = db.query(models.LetturaCopie).filter(
                models.LetturaCopie.asset_id == asset.id
            ).order_by(desc(models.LetturaCopie.data_lettura)).first()
            
            if ultima_lettura:
                # Calcola la cadenza (default trimestrale = 90 giorni)
                cadenza = asset.cadenza_letture_copie or "trimestrale"
                giorni_cadenza = {
                    "mensile": 30,
                    "bimestrale": 60,
                    "trimestrale": 90,
                    "semestrale": 180
                }.get(cadenza, 90)
                
                # Imposta la data a più di 3 mesi fa (circa 100 giorni fa per sicurezza)
                nuova_data = datetime.now() - timedelta(days=100)
                
                print(f"\n📋 Asset: {asset.marca} {asset.modello} (ID: {asset.id})")
                print(f"   Cadenza configurata: {cadenza} ({giorni_cadenza} giorni)")
                print(f"   Data lettura attuale: {ultima_lettura.data_lettura}")
                print(f"   Nuova data lettura: {nuova_data}")
                
                # Modifica la data
                ultima_lettura.data_lettura = nuova_data
                db.commit()
                
                print(f"   ✅ Data modificata con successo!")
            else:
                print(f"\n⚠️  Nessuna lettura trovata per asset {asset.marca} {asset.modello} (ID: {asset.id})")
        
        print("\n✅ Modifica completata!")
        
    except Exception as e:
        print(f"❌ Errore: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    modify_letture_date()

