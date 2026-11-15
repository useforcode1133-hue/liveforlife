#!/usr/bin/env bash
# Local PostgreSQL for development, using the PostgreSQL binaries installed by
# the `embedded-postgres` dev dependency. No system packages or root needed.
set -euo pipefail
cd "$(dirname "$0")/.."

BIN="$PWD/node_modules/@embedded-postgres/linux-x64/native/bin"
DATA="$PWD/.pgdata"
PORT="${PGPORT:-55432}"
export LD_LIBRARY_PATH="$PWD/node_modules/@embedded-postgres/linux-x64/native/lib:${LD_LIBRARY_PATH:-}"

case "${1:-start}" in
  init)
    if [ -d "$DATA" ]; then echo "Data directory already exists at $DATA"; exit 0; fi
    "$BIN/initdb" -D "$DATA" -U pguser --auth=trust --encoding=UTF8 --locale=C
    ;;
  start)
    [ -d "$DATA" ] || "$0" init
    if "$BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
      echo "PostgreSQL already running on port $PORT"; exit 0
    fi
    "$BIN/pg_ctl" -D "$DATA" -l "${PGLOG:-/tmp/pg.log}" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" start
    ;;
  stop)
    "$BIN/pg_ctl" -D "$DATA" stop
    ;;
  status)
    "$BIN/pg_ctl" -D "$DATA" status
    ;;
  *)
    echo "Usage: scripts/db.sh [init|start|stop|status]"; exit 1
    ;;
esac
