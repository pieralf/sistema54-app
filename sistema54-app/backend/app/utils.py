"""
Utility functions per il sistema
"""
from typing import Dict, Any

def get_default_permessi(ruolo: str) -> Dict[str, Any]:
    """
    Restituisce i permessi di default in base al ruolo
    
    - SuperAdmin: tutti i permessi abilitati
    - Admin: tutti i permessi abilitati tranne impostazioni
    - Altri ruoli: nessun permesso di default (devono essere impostati manualmente)
    """
    if ruolo == "superadmin":
        return {
            # Clienti
            "can_view_clienti": True,
            "can_create_clienti": True,
            "can_edit_clienti": True,
            "can_delete_clienti": True,
            # Interventi
            "can_view_interventi": True,
            "can_create_interventi": True,
            "can_edit_interventi": True,
            "can_delete_interventi": True,
            "can_generate_pdf": True,
            # Magazzino
            "can_view_magazzino": True,
            "can_create_magazzino": True,
            "can_edit_magazzino": True,
            "can_delete_magazzino": True,
            # Utenti
            "can_view_users": True,
            "can_create_users": True,
            "can_edit_users": True,
            "can_delete_users": True,
            # Impostazioni
            "can_view_settings": True,
            "can_edit_settings": True
        }
    elif ruolo == "admin":
        return {
            # Clienti
            "can_view_clienti": True,
            "can_create_clienti": True,
            "can_edit_clienti": True,
            "can_delete_clienti": True,
            # Interventi
            "can_view_interventi": True,
            "can_create_interventi": True,
            "can_edit_interventi": True,
            "can_delete_interventi": True,
            "can_generate_pdf": True,
            # Magazzino
            "can_view_magazzino": True,
            "can_create_magazzino": True,
            "can_edit_magazzino": True,
            "can_delete_magazzino": True,
            # Utenti
            "can_view_users": True,
            "can_create_users": True,
            "can_edit_users": True,
            "can_delete_users": True,
            # Impostazioni - NON abilitate per admin
            "can_view_settings": False,
            "can_edit_settings": False
        }
    else:
        # Per altri ruoli, nessun permesso di default
        return {}



