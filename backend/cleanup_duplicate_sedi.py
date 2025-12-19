"""
Script per pulire le sedi duplicate dal database.
Identifica e rimuove le sedi duplicate basandosi su cliente_id, nome_sede e indirizzo_completo.
Mantiene solo la sede più vecchia (prima creata) e aggiorna i riferimenti negli interventi e assets.
"""
import sys
import os
from sqlalchemy.orm import Session
from sqlalchemy import func

# Aggiungi il percorso del modulo 'app' al PYTHONPATH
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import models

def cleanup_duplicate_sedi():
    db: Session = SessionLocal()
    try:
        print("🔍 Ricerca sedi duplicate...")
        
        # Trova tutte le sedi raggruppate per cliente_id, nome_sede e indirizzo_completo
        # e conta quante volte appaiono
        duplicate_query = db.query(
            models.SedeCliente.cliente_id,
            models.SedeCliente.nome_sede,
            models.SedeCliente.indirizzo_completo,
            func.count(models.SedeCliente.id).label('count')
        ).group_by(
            models.SedeCliente.cliente_id,
            models.SedeCliente.nome_sede,
            models.SedeCliente.indirizzo_completo
        ).having(func.count(models.SedeCliente.id) > 1).all()
        
        if not duplicate_query:
            print("✅ Nessuna sede duplicata trovata!")
            return
        
        print(f"📋 Trovate {len(duplicate_query)} gruppi di sedi duplicate")
        
        total_deleted = 0
        
        for cliente_id, nome_sede, indirizzo_completo, count in duplicate_query:
            print(f"\n🔧 Cliente ID {cliente_id}: '{nome_sede}' - {count} duplicati")
            
            # Trova tutte le sedi duplicate per questo gruppo
            sedi_duplicate = db.query(models.SedeCliente).filter(
                models.SedeCliente.cliente_id == cliente_id,
                models.SedeCliente.nome_sede == nome_sede,
                models.SedeCliente.indirizzo_completo == indirizzo_completo
            ).order_by(models.SedeCliente.id.asc()).all()
            
            if len(sedi_duplicate) <= 1:
                continue
            
            # Mantieni la prima sede (più vecchia, ID più basso)
            sede_da_mantenere = sedi_duplicate[0]
            sedi_da_eliminare = sedi_duplicate[1:]
            
            print(f"   ✅ Mantengo sede ID {sede_da_mantenere.id}")
            
            # Per ogni sede da eliminare, aggiorna i riferimenti
            for sede_da_eliminare in sedi_da_eliminare:
                print(f"   🗑️  Elimino sede ID {sede_da_eliminare.id}")
                
                # Aggiorna interventi che referenziano questa sede
                interventi_aggiornati = db.query(models.Intervento).filter(
                    models.Intervento.sede_id == sede_da_eliminare.id
                ).update({models.Intervento.sede_id: sede_da_mantenere.id}, synchronize_session=False)
                
                if interventi_aggiornati > 0:
                    print(f"      ↪️  Aggiornati {interventi_aggiornati} interventi")
                
                # Aggiorna assets che referenziano questa sede
                assets_aggiornati = db.query(models.AssetCliente).filter(
                    models.AssetCliente.sede_id == sede_da_eliminare.id
                ).update({models.AssetCliente.sede_id: sede_da_mantenere.id}, synchronize_session=False)
                
                if assets_aggiornati > 0:
                    print(f"      ↪️  Aggiornati {assets_aggiornati} assets")
                
                # Elimina la sede duplicata
                db.delete(sede_da_eliminare)
                total_deleted += 1
        
        db.commit()
        print(f"\n✅ Pulizia completata! Eliminate {total_deleted} sedi duplicate.")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Errore durante la pulizia: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("PULIZIA SEDI DUPLICATE")
    print("=" * 60)
    cleanup_duplicate_sedi()

