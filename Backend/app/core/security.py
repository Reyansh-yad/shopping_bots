
import uuid
from app.database import pool

def validate_session(session_id: str) -> bool:
    """
    Return True if the session exists and has not expired.
    Expired sessions are deleted on-read (lazy cleanup) in addition to
    the scheduled sweep in session_cleaner.py.
    """
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT expired_at FROM app.session
                WHERE session_id = %s;
            """, (session_id,))
            row = cur.fetchone()
            if row is None:
                return False
            expired_at = row[0]
            # Evaluate expiry in Python so we don't depend on DB timezone config
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc)
            # expired_at may be timezone-naive (PostgreSQL TIMESTAMP without TZ)
            if expired_at.tzinfo is None:
                from datetime import timezone as _tz
                expired_at = expired_at.replace(tzinfo=_tz.utc)
            if expired_at < now:
                # Lazy delete — session is expired
                cur.execute(
                    "DELETE FROM app.session WHERE session_id = %s",
                    (session_id,)
                )
                conn.commit()
                return False
            return True

def get_session() -> str:
    with pool.connection() as conn:
        with conn.cursor() as cur:
            while True:
                new_session_id = str(uuid.uuid4())
                cur.execute(
                    "SELECT session_id FROM app.session WHERE session_id = %s",
                    (new_session_id,)
                )
                if not cur.fetchone():
                    break
            return new_session_id