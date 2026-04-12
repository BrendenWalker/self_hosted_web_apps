import os
from urllib.parse import quote_plus

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker


def _database_url():
    direct = os.getenv("DATABASE_URL")
    if direct:
        return direct
    host = os.getenv("DB_HOST", "postgres")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "pethub")
    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD", "postgres")
    u = quote_plus(user)
    p = quote_plus(password)
    n = quote_plus(name)
    return f"postgresql+psycopg2://{u}:{p}@{host}:{port}/{n}?gssencmode=disable&sslmode=disable"


DATABASE_URL = _database_url()

# Psycopg2-level TCP keepalives (seconds)
CONNECT_ARGS = {
    "keepalives": 1,
    "keepalives_idle": 60,      # idle before first probe
    "keepalives_interval": 30,  # between probes
    "keepalives_count": 5,      # fail after 5 missed probes
    # Optional: tune per your network — lower if you see idles dropping
}

engine = create_engine(
    DATABASE_URL,
    pool_size=5,           # adjust for your traffic
    max_overflow=5,
    pool_pre_ping=True,    # refresh dead conns automatically
    pool_recycle=1800,     # recycle every 30 min to avoid stale sockets
    connect_args=CONNECT_ARGS,
    future=True,           # if you’re on SQLAlchemy 2.x (safe to keep)
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Set per-connection settings: statement_timeout and timezone
@event.listens_for(engine, "connect")
def _set_session_settings(dbapi_conn, _):
    with dbapi_conn.cursor() as cur:
        cur.execute("SET statement_timeout = '15s'")
        cur.execute("SET timezone = 'UTC'")