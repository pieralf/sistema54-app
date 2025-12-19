"""
Script di test per verificare l'invio delle email di scadenza contratti e letture copie
"""
import sys
import os
from datetime import datetime, timedelta

# Aggiungi il percorso dell'app al PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app import models
from app.main import check_scadenze_contratti, check_scadenze_letture_copie

def test_scadenza_contratto_noleggio():
    """Test invio email scadenza contratto noleggio"""
    print("\n" + "="*60)
    print("TEST: Scadenza Contratto Noleggio")
    print("="*60)
    
    db = SessionLocal()
    try:
        # Trova un cliente esistente o crea uno di test
        cliente = db.query(models.Cliente).first()
        if not cliente:
            print("❌ Nessun cliente trovato nel database. Crea almeno un cliente prima di eseguire il test.")
            return
        
        print(f"✓ Cliente trovato: {cliente.ragione_sociale} (ID: {cliente.id})")
        
        # Verifica che il cliente abbia multisede attivata
        if not cliente.has_multisede:
            print("⚠️  Il cliente non ha multisede. Attivando multisede per il test...")
            cliente.has_multisede = True
            db.commit()
        
        # Crea o trova una sede
        sede = db.query(models.SedeCliente).filter(
            models.SedeCliente.cliente_id == cliente.id
        ).first()
        
        if not sede:
            print("⚠️  Nessuna sede trovata. Creando una sede di test...")
            sede = models.SedeCliente(
                cliente_id=cliente.id,
                nome_sede="Sede Test",
                indirizzo_completo="Via Test 123, Milano",
                email="test-sede@example.com"  # Email di test per la sede
            )
            db.add(sede)
            db.commit()
            db.refresh(sede)
            print(f"✓ Sede creata: {sede.nome_sede} (ID: {sede.id})")
        else:
            print(f"✓ Sede trovata: {sede.nome_sede} (ID: {sede.id})")
        
        # Crea o trova un asset Printing con scadenza tra 7 giorni
        asset = db.query(models.AssetCliente).filter(
            models.AssetCliente.cliente_id == cliente.id,
            models.AssetCliente.tipo_asset == "Printing"
        ).first()
        
        if asset:
            # Aggiorna la data di scadenza a 7 giorni da oggi
            asset.data_scadenza_noleggio = datetime.now() + timedelta(days=7)
            asset.sede_id = sede.id  # Associa alla sede
            db.commit()
            print(f"✓ Asset aggiornato: {asset.marca} {asset.modello} - Scade tra 7 giorni")
        else:
            # Crea un nuovo asset di test
            asset = models.AssetCliente(
                cliente_id=cliente.id,
                sede_id=sede.id,
                tipo_asset="Printing",
                marca="HP",
                modello="LaserJet Pro",
                matricola="TEST123",
                data_scadenza_noleggio=datetime.now() + timedelta(days=7),
                is_colore=False,
                tipo_formato="A4"
            )
            db.add(asset)
            db.commit()
            db.refresh(asset)
            print(f"✓ Asset creato: {asset.marca} {asset.modello} - Scade tra 7 giorni")
        
        # Verifica impostazioni email
        settings = db.query(models.ImpostazioniAzienda).first()
        if not settings or not settings.email_notifiche_scadenze:
            print("⚠️  Email notifiche scadenze non configurata nelle impostazioni.")
            print("   Configura 'email_notifiche_scadenze' nelle impostazioni azienda per ricevere le email.")
        
        print("\n📧 Eseguendo controllo scadenze contratti...")
        print("-" * 60)
        
        # Esegui il controllo scadenze
        check_scadenze_contratti()
        
        print("-" * 60)
        print("✓ Test completato!")
        print("\nVerifica:")
        print(f"  1. Email all'azienda: {settings.email_notifiche_scadenze if settings else 'NON CONFIGURATA'}")
        print(f"  2. Email al cliente: {cliente.email_amministrazione or 'NON CONFIGURATA'}")
        print(f"  3. Email alla sede: {sede.email}")
        
    except Exception as e:
        print(f"❌ Errore durante il test: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def test_scadenza_contratto_assistenza():
    """Test invio email scadenza contratto assistenza"""
    print("\n" + "="*60)
    print("TEST: Scadenza Contratto Assistenza")
    print("="*60)
    
    db = SessionLocal()
    try:
        # Trova un cliente esistente
        cliente = db.query(models.Cliente).first()
        if not cliente:
            print("❌ Nessun cliente trovato nel database.")
            return
        
        print(f"✓ Cliente trovato: {cliente.ragione_sociale} (ID: {cliente.id})")
        
        # Attiva contratto assistenza e imposta scadenza tra 7 giorni
        cliente.has_contratto_assistenza = True
        cliente.data_fine_contratto_assistenza = datetime.now() + timedelta(days=7)
        db.commit()
        print(f"✓ Contratto assistenza attivato - Scade tra 7 giorni")
        
        # Verifica impostazioni email
        settings = db.query(models.ImpostazioniAzienda).first()
        if not settings or not settings.email_notifiche_scadenze:
            print("⚠️  Email notifiche scadenze non configurata nelle impostazioni.")
        
        print("\n📧 Eseguendo controllo scadenze contratti...")
        print("-" * 60)
        
        # Esegui il controllo scadenze
        check_scadenze_contratti()
        
        print("-" * 60)
        print("✓ Test completato!")
        print("\nVerifica:")
        print(f"  1. Email all'azienda: {settings.email_notifiche_scadenze if settings else 'NON CONFIGURATA'}")
        print(f"  2. Email al cliente: {cliente.email_amministrazione or 'NON CONFIGURATA'}")
        
        # Verifica sedi del cliente
        sedi = db.query(models.SedeCliente).filter(
            models.SedeCliente.cliente_id == cliente.id
        ).all()
        if sedi:
            print(f"  3. Email alle sedi ({len(sedi)} sedi con email):")
            for sede in sedi:
                if sede.email:
                    print(f"     - {sede.nome_sede}: {sede.email}")
        
    except Exception as e:
        print(f"❌ Errore durante il test: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def test_scadenza_letture_copie():
    """Test invio email scadenza letture copie"""
    print("\n" + "="*60)
    print("TEST: Scadenza Letture Copie (7 giorni prima dei 3 mesi)")
    print("="*60)
    
    db = SessionLocal()
    try:
        # Trova un asset Printing esistente
        asset = db.query(models.AssetCliente).filter(
            models.AssetCliente.tipo_asset == "Printing"
        ).first()
        
        if not asset:
            print("❌ Nessun asset Printing trovato nel database.")
            print("   Crea almeno un prodotto Printing a noleggio prima di eseguire il test.")
            return
        
        cliente = db.query(models.Cliente).filter(models.Cliente.id == asset.cliente_id).first()
        print(f"✓ Asset trovato: {asset.marca} {asset.modello} (Cliente: {cliente.ragione_sociale})")
        
        # Crea una lettura copie con data di 83 giorni fa (7 giorni prima della scadenza dei 3 mesi)
        # La prossima lettura sarà dovuta tra 7 giorni (completati i 3 mesi)
        data_lettura = datetime.now() - timedelta(days=83)
        
        lettura = models.LetturaCopie(
            asset_id=asset.id,
            data_lettura=data_lettura,
            contatore_bn=1000,
            contatore_colore=500 if asset.is_colore else None,
            tecnico_id=1  # Assumendo che esista almeno un utente con ID 1
        )
        db.add(lettura)
        db.commit()
        db.refresh(lettura)
        
        print(f"✓ Lettura copie creata:")
        print(f"   Data lettura: {data_lettura.strftime('%d/%m/%Y')}")
        print(f"   Contatore B/N: {lettura.contatore_bn}")
        if lettura.contatore_colore:
            print(f"   Contatore Colore: {lettura.contatore_colore}")
        print(f"   Prossima lettura dovuta tra: {(data_lettura + timedelta(days=90)).strftime('%d/%m/%Y')}")
        print(f"   Alert inviato 7 giorni prima: {(data_lettura + timedelta(days=83)).strftime('%d/%m/%Y')} (oggi)")
        
        # Verifica impostazioni email
        settings = db.query(models.ImpostazioniAzienda).first()
        if not settings or not settings.email_avvisi_promemoria:
            print("\n⚠️  Email avvisi e promemoria non configurata nelle impostazioni.")
            print("   Configura 'email_avvisi_promemoria' nelle impostazioni azienda per ricevere le email.")
        
        print("\n📧 Eseguendo controllo scadenze letture copie...")
        print("-" * 60)
        
        # Esegui il controllo scadenze letture copie
        check_scadenze_letture_copie()
        
        print("-" * 60)
        print("✓ Test completato!")
        print("\nVerifica:")
        print(f"  Email avvisi e promemoria: {settings.email_avvisi_promemoria if settings else 'NON CONFIGURATA'}")
        
    except Exception as e:
        print(f"❌ Errore durante il test: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("\n" + "="*60)
    print("TEST INVIO EMAIL SCADENZE")
    print("="*60)
    print("\nQuesto script testerà l'invio delle email per:")
    print("  1. Scadenza contratto noleggio")
    print("  2. Scadenza contratto assistenza")
    print("  3. Scadenza letture copie (7 giorni prima dei 3 mesi)")
    print("\nAssicurati di aver configurato:")
    print("  - Email notifiche scadenze nelle impostazioni azienda")
    print("  - Email avvisi e promemoria nelle impostazioni azienda")
    print("  - Configurazione SMTP nelle impostazioni azienda")
    print("  - Almeno un cliente nel database")
    print("  - Email del cliente principale (email_amministrazione)")
    
    print("\nAvvio dei test in 2 secondi...")
    import time
    time.sleep(2)
    
    # Test 1: Scadenza contratto noleggio
    test_scadenza_contratto_noleggio()
    
    # Test 2: Scadenza contratto assistenza
    test_scadenza_contratto_assistenza()
    
    # Test 3: Scadenza letture copie
    test_scadenza_letture_copie()
    
    print("\n" + "="*60)
    print("TUTTI I TEST COMPLETATI")
    print("="*60)
    print("\nControlla:")
    print("  1. I log del backend per eventuali errori")
    print("  2. Le caselle email configurate per ricevere le notifiche")
    print("  3. La console per messaggi di errore durante l'invio")
    print("\nSe le email non arrivano:")
    print("  - Verifica la configurazione SMTP nelle impostazioni")
    print("  - Controlla i log del backend per errori di connessione SMTP")
    print("  - Verifica che le email di destinazione siano corrette")

