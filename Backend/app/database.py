from psycopg_pool import ConnectionPool
from app.core.settings import settings

pool = ConnectionPool(
    conninfo=(
        f"dbname={settings.db_name} "
        f"user={settings.db_user} "
        f"password={settings.db_password} "
        f"host={settings.db_host} "
        f"port={settings.db_port}"
    ),
    min_size=1,
    max_size=5,
    timeout=30,
    open=False,
)

def get_db_connection():
    with pool.connection() as conn:
        yield conn

