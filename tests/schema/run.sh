#!/usr/bin/env bash
# Draait supabase/schema.sql tegen een echte Postgres en controleert het resultaat.
# Verwacht een draaiende server; standaard de service-container uit CI.
#
#   PGURL="postgres://postgres:postgres@localhost:5432/postgres" tests/schema/run.sh
set -euo pipefail

PGURL="${PGURL:-postgres://postgres:postgres@localhost:5432/postgres}"
HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HIER/../.." && pwd)"
P=(psql "$PGURL" -q -v ON_ERROR_STOP=1 --no-psqlrc)

stap(){ printf '\n\033[1m%s\033[0m\n' "$1"; }

stap "1/5  Supabase nabootsen (publicatie + anon-rol)"
"${P[@]}" -f "$HIER/00-supabase-na-doen.sql"

stap "2/5  schema.sql toepassen"
"${P[@]}" -f "$ROOT/supabase/schema.sql" > /dev/null

stap "3/5  rechten van de publieke sleutel"
"${P[@]}" -f "$HIER/01-rechten.sql"

stap "4/5  schema.sql nog een keer (moet veilig zijn)"
"${P[@]}" -f "$ROOT/supabase/schema.sql" > /dev/null

stap "5/5  data en policies na de tweede run"
"${P[@]}" -f "$HIER/02-idempotent.sql"

printf '\n\033[32mSchema in orde.\033[0m\n'
