#!/usr/bin/env bash
# Applies the migrations to a throwaway database on a plain Postgres server and
# runs the row-level security checks. Set PG* env vars to point at the server.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="rental_test_$$"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "create database $DB"
trap 'psql -q -d postgres -c "drop database if exists $DB"' EXIT
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/stub_supabase.sql 2>/dev/null
for f in supabase/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"
done
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/rls_test.sql
