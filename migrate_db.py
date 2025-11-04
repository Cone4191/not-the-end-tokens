#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script per migrare il database aggiungendo le nuove colonne
"""
import sqlite3
import os
import sys

# Fix encoding for Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Path al database
DB_PATH = 'instance/not_the_end.db'

def migrate_database():
    """Aggiungi le nuove colonne al database esistente"""

    if not os.path.exists(DB_PATH):
        print(f"[X] Database {DB_PATH} non trovato. Verra' creato automaticamente al primo avvio.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Verifica se la colonna is_master esiste già
        cursor.execute("PRAGMA table_info(room_players)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'is_master' not in columns:
            print("[+] Aggiunta colonna 'is_master' a room_players...")
            cursor.execute("ALTER TABLE room_players ADD COLUMN is_master BOOLEAN DEFAULT 0")

            # Imposta il primo giocatore di ogni stanza come master
            cursor.execute("""
                UPDATE room_players
                SET is_master = 1
                WHERE id IN (
                    SELECT MIN(id) FROM room_players GROUP BY room_id
                )
            """)
            print("[OK] Colonna 'is_master' aggiunta e master impostati")
        else:
            print("[OK] Colonna 'is_master' gia' esistente")

        # Verifica se la colonna visible_to_all esiste già
        cursor.execute("PRAGMA table_info(characters)")
        columns = [col[1] for col in cursor.fetchall()]

        if 'visible_to_all' not in columns:
            print("[+] Aggiunta colonna 'visible_to_all' a characters...")
            cursor.execute("ALTER TABLE characters ADD COLUMN visible_to_all BOOLEAN DEFAULT 0")
            print("[OK] Colonna 'visible_to_all' aggiunta")
        else:
            print("[OK] Colonna 'visible_to_all' gia' esistente")

        conn.commit()
        print("\n[SUCCESS] Migrazione completata con successo!")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] Errore durante la migrazione: {str(e)}")
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    print("Inizio migrazione database...\n")
    migrate_database()
