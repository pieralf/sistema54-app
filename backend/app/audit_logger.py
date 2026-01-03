"""
Utility per registrare operazioni di audit log
"""
from sqlalchemy.orm import Session
from . import models
from datetime import datetime
from typing import Optional, Dict, Any


def log_action(
    db: Session,
    user: models.Utente,
    action: str,  # CREATE, UPDATE, DELETE
    entity_type: str,  # 'cliente', 'intervento', 'magazzino', 'utente'
    entity_id: int,
    entity_name: Optional[str] = None,
    changes: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None
):
    """
    Registra un'operazione nel log di audit
    
    Args:
        db: Sessione database
        user: Utente che ha eseguito l'operazione
        action: Tipo di azione (CREATE, UPDATE, DELETE)
        entity_type: Tipo di entità modificata
        entity_id: ID dell'entità modificata
        entity_name: Nome descrittivo dell'entità (opzionale)
        changes: Dizionario con le modifiche {"campo": {"old": vecchio, "new": nuovo}} (opzionale)
        ip_address: Indirizzo IP dell'utente (opzionale)
    """
    try:
        audit_log = models.AuditLog(
            user_id=user.id,
            user_email=user.email,
            user_nome=user.nome_completo,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
            changes=changes or {},
            ip_address=ip_address,
            timestamp=datetime.now()
        )
        db.add(audit_log)
        db.commit()
    except Exception as e:
        # Non bloccare l'operazione principale se il logging fallisce
        db.rollback()
        print(f"Errore durante il logging audit: {str(e)}")


def get_changes_dict(old_obj: Any, new_obj: Any, fields_to_track: list) -> Dict[str, Dict[str, Any]]:
    """
    Confronta due oggetti e restituisce un dizionario con le modifiche
    
    Args:
        old_obj: Oggetto originale
        new_obj: Oggetto modificato
        fields_to_track: Lista di campi da tracciare
    
    Returns:
        Dizionario con le modifiche: {"campo": {"old": valore_vecchio, "new": valore_nuovo}}
    """
    changes = {}
    
    for field in fields_to_track:
        old_value = getattr(old_obj, field, None)
        new_value = getattr(new_obj, field, None)
        
        # Confronta i valori (gestisce anche None)
        if old_value != new_value:
            changes[field] = {
                "old": old_value,
                "new": new_value
            }
    
    return changes



