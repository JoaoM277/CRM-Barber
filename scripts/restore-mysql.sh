#!/usr/bin/env bash
# ==========================================================================
#  Restaura um dump gerado por backup-mysql.sh.
#
#  Uso:
#    ./restore-mysql.sh caminho/para/crm_barber_20260914_030000.sql.gz [nome_do_banco]
#
#  Se [nome_do_banco] não for passado, usa DB_DATABASE (default: crm_barber).
#  ATENÇÃO: isso SOBRESCREVE o banco de destino. Pra testar sem risco, passe
#  um nome de banco diferente (ex.: crm_barber_restore_teste).
# ==========================================================================
set -euo pipefail

DUMP_FILE="${1:?uso: restore-mysql.sh <dump.sql.gz> [nome_do_banco]}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_DATABASE="${2:-${DB_DATABASE:-crm_barber}}"
DB_USERNAME="${DB_USERNAME:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Arquivo não encontrado: $DUMP_FILE" >&2
  exit 1
fi

echo "[$(date -Iseconds)] criando banco '$DB_DATABASE' (se não existir)..."
MYSQL_PWD="$DB_PASSWORD" mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" \
  -e "CREATE DATABASE IF NOT EXISTS \`$DB_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "[$(date -Iseconds)] restaurando $DUMP_FILE em '$DB_DATABASE'..."
gunzip -c "$DUMP_FILE" | MYSQL_PWD="$DB_PASSWORD" mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" "$DB_DATABASE"

echo "[$(date -Iseconds)] restore concluído. Conferindo contagem de linhas das tabelas principais:"
MYSQL_PWD="$DB_PASSWORD" mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USERNAME" "$DB_DATABASE" -e "
SELECT 'barbershops', COUNT(*) FROM barbershops
UNION ALL SELECT 'services', COUNT(*) FROM services
UNION ALL SELECT 'workers', COUNT(*) FROM workers
UNION ALL SELECT 'clients', COUNT(*) FROM clients
UNION ALL SELECT 'schedules', COUNT(*) FROM schedules;
"
