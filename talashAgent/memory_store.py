import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "talash_memory.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 1. User Personalization Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_personalization (
            user_id TEXT,
            memory_key TEXT,
            memory_value TEXT,
            created_at TEXT,
            updated_at TEXT,
            PRIMARY KEY (user_id, memory_key)
        )
    """)
    
    # 2. Session Documents Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS session_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            user_id TEXT,
            file_name TEXT,
            file_url TEXT,
            summary TEXT,
            extracted_text TEXT,
            created_at TEXT
        )
    """)
    
    conn.commit()
    conn.close()

def save_user_memory(user_id: str, key: str, value: str):
    if not user_id or not key:
        return
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO user_personalization (user_id, memory_key, memory_value, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, memory_key) DO UPDATE SET
            memory_value = excluded.memory_value,
            updated_at = excluded.updated_at
    """, (user_id, key, value, now, now))
    conn.commit()
    conn.close()

def get_user_memories(user_id: str) -> dict:
    if not user_id:
        return {}
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT memory_key, memory_value FROM user_personalization WHERE user_id = ?", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return {r[0]: r[1] for r in rows}

def delete_user_memory(user_id: str, key: str = None):
    if not user_id:
        return
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    if key:
        cursor.execute("DELETE FROM user_personalization WHERE user_id = ? AND memory_key = ?", (user_id, key))
    else:
        cursor.execute("DELETE FROM user_personalization WHERE user_id = ?", (user_id,))
    conn.commit()
    conn.close()

def save_session_document(session_id: str, user_id: str, file_name: str, file_url: str, summary: str, extracted_text: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO session_documents (session_id, user_id, file_name, file_url, summary, extracted_text, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (session_id or "", user_id or "", file_name, file_url, summary, extracted_text, now))
    conn.commit()
    conn.close()

def get_session_documents(session_id: str) -> list:
    if not session_id:
        return []
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT file_name, file_url, summary, extracted_text, created_at FROM session_documents WHERE session_id = ?", (session_id,))
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "file_name": r[0],
            "file_url": r[1],
            "summary": r[2],
            "extracted_text": r[3],
            "created_at": r[4]
        } for r in rows
    ]

def get_user_documents(user_id: str) -> list:
    if not user_id:
        return []
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT file_name, file_url, summary, session_id, created_at FROM session_documents WHERE user_id = ?", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "file_name": r[0],
            "file_url": r[1],
            "summary": r[2],
            "session_id": r[3],
            "created_at": r[4]
        } for r in rows
    ]

# Initialize database tables on load
init_db()
