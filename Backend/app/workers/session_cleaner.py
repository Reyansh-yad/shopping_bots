from app.database import pool

def cleanup_sessions():
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM app.session
                WHERE expired_at < NOW();
            """)
            conn.commit()
    print("INFO:\tExpired sessions cleaned up.")




