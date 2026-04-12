#!/bin/sh
set -e

echo "Starting container entrypoint"

# Resolve DATABASE_URL from DB_* when not provided (matches db.py / Alembic)
if [ -z "$DATABASE_URL" ] && [ -n "$DB_HOST" ]; then
  export DATABASE_URL="$(python - <<'PY'
import os
from urllib.parse import quote_plus
host = os.getenv("DB_HOST", "postgres")
port = os.getenv("DB_PORT", "5432")
name = os.getenv("DB_NAME", "pethub")
user = os.getenv("DB_USER", "postgres")
password = os.getenv("DB_PASSWORD", "postgres")
u, p, n = quote_plus(user), quote_plus(password), quote_plus(name)
print(f"postgresql+psycopg2://{u}:{p}@{host}:{port}/{n}?gssencmode=disable&sslmode=disable")
PY
)"
fi

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set; skipping migrations"
else
  if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
    echo "Waiting for database to become available..."
    python - <<'PY'
import os, time, sys
from sqlalchemy import create_engine
url = os.getenv('DATABASE_URL')
if not url:
    print('No DATABASE_URL; exiting')
    sys.exit(1)
for i in range(30):
    try:
        engine = create_engine(url)
        conn = engine.connect()
        conn.close()
        print('Database is available')
        sys.exit(0)
    except Exception as e:
        print('Database unavailable, retrying...', e)
        time.sleep(2)
print('Database did not become available in time')
sys.exit(1)
PY

    if [ -f /app/alembic.ini ] && [ -d /app/alembic ]; then
      echo "Running Alembic migrations"
      alembic upgrade head
    else
      echo "Alembic config not found; skipping migrations"
    fi
  else
    echo "RUN_MIGRATIONS not enabled; skipping migrations"
  fi
fi

exec "$@"


